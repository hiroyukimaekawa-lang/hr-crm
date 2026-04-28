/**
 * KPI Service — business logic layer.
 *
 * Computes target vs actual, CVRs, gap, achievementRate, and derived
 * (reverse-calculated) requirements. This is the ONLY place where KPI
 * maths lives.
 *
 * === Revenue-Driven KPI Architecture ===
 * Revenue Target (top) → ÷ Unit Price → Deal Count → ÷ CVR → Interview Count
 * → ÷ CVR → Entry Count → Channel Allocation (Event / Agent)
 */
import {
    KpiFilters,
    GoalRow,
    getCanonicalFunnelCounts,
    getDailyApplicationTrend,
    getGoals,
    upsertGoals,
    getEventKpiData,
    getSalesActuals as getSalesData,
    getChannelActuals as getChannelData,
    ensureKpiTable,
} from '../repositories/kpiRepository';

// ─────────────────────── Types ───────────────────────

interface KpiMetric {
    target: number;
    actual: number;
    gap: number;
    achievementRate: number; // 0-100+
}

// === Revenue Decomposition Types ===

export interface RevenueDecompositionInput {
    revenue_target: number;
    unit_price: number;
    deal_cvr: number;        // interview → deal (%) — maps to kpi_interview_to_reservation_rate
    interview_cvr: number;   // entry → interview (%) — maps to kpi_entry_to_interview_rate
}

export interface RevenueDecompositionResult {
    revenue_target: number;
    unit_price: number;
    deal_count: number;        // = revenue / unit_price
    deal_cvr: number;
    interview_count: number;   // = deal_count / (deal_cvr / 100)
    interview_cvr: number;
    entry_count: number;       // = interview_count / (interview_cvr / 100)
}

export interface ChannelAllocation {
    channel_type: 'event' | 'agent_interview';
    project_id: number;
    project_title: string;
    allocated_entries: number;
    allocated_interviews: number;
    allocated_deals: number;
    allocated_revenue: number;
    unit_price: number;
    deal_cvr: number;
    interview_cvr: number;
    is_manual_override: boolean;
}

export interface ChannelAllocationResult {
    decomposition: RevenueDecompositionResult;
    allocations: ChannelAllocation[];
    totals: {
        event_revenue: number;
        agent_revenue: number;
        event_entries: number;
        agent_entries: number;
        unallocated_revenue: number;
    };
    warnings: string[];
}

interface MonthlyOverview {
    sales: KpiMetric;
    seats: KpiMetric;
    entries: KpiMetric;
    interviews: KpiMetric;
    interviewSettings: KpiMetric;
    inflow: KpiMetric;
    rates: {
        seatToEntry: number;
        entryToInterview: number;
        interviewToSetting: number;
        inflowToSetting: number;
    };
    salesBreakdown?: any[];
    decomposition?: RevenueDecompositionResult;
    channelActuals?: any;
}

interface WeeklyOverview {
    weekLabel: string;
    sales: KpiMetric;
    seats: KpiMetric;
    entries: KpiMetric;
    interviews: KpiMetric;
    salesBreakdown?: any[];
}

interface DailyOverview {
    date: string;
    sales: KpiMetric;
    seats: KpiMetric;
    entries: KpiMetric;
    interviews: KpiMetric;
    trend: Array<{ day: string; count: number }>;
    requiredDaily?: {
        entries: number;
        interviews: number;
        deals: number;
        revenue: number;
    };
}

export interface KpiOverviewResult {
    monthly?: MonthlyOverview;
    weekly?: WeeklyOverview;
    daily?: DailyOverview;
    funnel: {
        applications: number;
        reservations: number;
        interview_scheduled: number;
        interview_completed: number;
    };
    perStaff?: any[];
    perSource?: any[];
    decomposition?: RevenueDecompositionResult;
    channelActuals?: any;
}

export interface EventKpiResult {
    event_id: number;
    event_title: string;
    deadline: string | null;
    days_remaining: number;
    target_seats: number;
    current_seats: number;
    target_entries: number;
    current_entries: number;
    target_interviews: number;
    target_inflow: number;
    daily_required_entries: number;
    daily_required_interviews: number;
    daily_required_inflow: number;
    target_sales: number;
    current_sales: number;
    achievementRate: number;
    kpi_seat_to_entry_rate: number;
    kpi_entry_to_interview_rate: number;
    kpi_interview_to_inflow_rate: number;
    kpi_custom_steps: any[];
    status_breakdown: Record<string, number>;
}

// ─────────────────────── Helpers ───────────────────────

const metric = (target: number, actual: number): KpiMetric => ({
    target,
    actual,
    gap: actual - target,
    achievementRate: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
});

const safeRate = (v: number | null | undefined, fallback = 70): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : fallback;
};

/**
 * Compute remaining business days in month from a given date.
 * Simplified: counts all calendar days remaining.
 */
const remainingDaysInMonth = (monthStr: string): number => {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jstNow.toISOString().slice(0, 10);

    const year = parseInt(monthStr.slice(0, 4));
    const month = parseInt(monthStr.slice(5, 7));
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    if (today > endDate) return 0;
    if (today < `${monthStr}-01`) return lastDay;

    const todayDay = parseInt(today.slice(8, 10));
    return lastDay - todayDay;
};

/**
 * Build goal map from goal rows: { metric_key: target_value }
 */
const buildGoalMap = (goals: GoalRow[]): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const g of goals) {
        map[g.metric_key] = Number(g.target_value);
    }
    return map;
};

// ─────────────────────── Revenue Decomposition ───────────────────────

/**
 * Core revenue → KPI decomposition engine.
 * Revenue Target → ÷ Unit Price → Deal Count → ÷ CVR → Interview Count → ÷ CVR → Entry Count
 *
 * AI role: calculation & proposal ONLY. Human makes final decisions.
 */
export const decomposeFromRevenue = (input: RevenueDecompositionInput): RevenueDecompositionResult => {
    const { revenue_target, unit_price, deal_cvr, interview_cvr } = input;

    // Guard against division by zero
    const safeUnitPrice = unit_price > 0 ? unit_price : 1;
    const safeDealCvr = deal_cvr > 0 ? Math.min(deal_cvr, 100) : 50;
    const safeInterviewCvr = interview_cvr > 0 ? Math.min(interview_cvr, 100) : 60;

    const deal_count = Math.ceil(revenue_target / safeUnitPrice);
    const interview_count = Math.ceil(deal_count / (safeDealCvr / 100));
    const entry_count = Math.ceil(interview_count / (safeInterviewCvr / 100));

    return {
        revenue_target,
        unit_price: safeUnitPrice,
        deal_count,
        deal_cvr: safeDealCvr,
        interview_count,
        interview_cvr: safeInterviewCvr,
        entry_count,
    };
};

/**
 * Suggest channel allocation across event/agent projects.
 * Uses each project's own unit_price and CVRs from the projects table.
 * Human can override any allocation; remaining is auto-redistributed.
 */
export const suggestChannelAllocation = async (
    decomposition: RevenueDecompositionResult,
    month: string,
    manualOverrides: Record<number, { allocated_revenue?: number }> = {}
): Promise<ChannelAllocationResult> => {
    const events = await getEventKpiData({ month });
    const warnings: string[] = [];

    // Filter to projects that are relevant (have deadlines in the month or are active)
    const relevantProjects = events.filter(e => {
        if (!e.deadline) return true; // No deadline = always relevant
        const dl = e.deadline.slice(0, 7); // YYYY-MM
        return dl >= month;
    });

    if (relevantProjects.length === 0) {
        warnings.push('対象月に有効なイベント/エージェント案件がありません。');
        return {
            decomposition,
            allocations: [],
            totals: {
                event_revenue: 0,
                agent_revenue: 0,
                event_entries: 0,
                agent_entries: 0,
                unallocated_revenue: decomposition.revenue_target,
            },
            warnings,
        };
    }

    let remainingRevenue = decomposition.revenue_target;
    const allocations: ChannelAllocation[] = [];

    // 1. Apply manual overrides first
    for (const proj of relevantProjects) {
        const override = manualOverrides[proj.event_id];
        if (override?.allocated_revenue != null) {
            const projUnitPrice = proj.unit_price > 0 ? proj.unit_price : decomposition.unit_price;
            const projDealCvr = safeRate(proj.kpi_interview_to_reservation_rate, decomposition.deal_cvr);
            const projInterviewCvr = safeRate(proj.kpi_entry_to_interview_rate, decomposition.interview_cvr);

            const allocRevenue = Math.min(override.allocated_revenue, remainingRevenue);
            const allocDeals = Math.ceil(allocRevenue / projUnitPrice);
            const allocInterviews = Math.ceil(allocDeals / (projDealCvr / 100));
            const allocEntries = Math.ceil(allocInterviews / (projInterviewCvr / 100));

            allocations.push({
                channel_type: (proj as any).type === 'agent_interview' ? 'agent_interview' : 'event',
                project_id: proj.event_id,
                project_title: proj.event_title,
                allocated_entries: allocEntries,
                allocated_interviews: allocInterviews,
                allocated_deals: allocDeals,
                allocated_revenue: allocRevenue,
                unit_price: projUnitPrice,
                deal_cvr: projDealCvr,
                interview_cvr: projInterviewCvr,
                is_manual_override: true,
            });

            remainingRevenue -= allocRevenue;
        }
    }

    // 2. Auto-distribute remaining revenue proportionally by capacity
    const unallocatedProjects = relevantProjects.filter(
        p => !manualOverrides[p.event_id]?.allocated_revenue
    );

    if (unallocatedProjects.length > 0 && remainingRevenue > 0) {
        const totalCapacity = unallocatedProjects.reduce(
            (sum, p) => sum + Math.max(p.target_seats, 1), 0
        );

        for (const proj of unallocatedProjects) {
            const weight = Math.max(proj.target_seats, 1) / totalCapacity;
            const projUnitPrice = proj.unit_price > 0 ? proj.unit_price : decomposition.unit_price;
            const projDealCvr = safeRate(proj.kpi_interview_to_reservation_rate, decomposition.deal_cvr);
            const projInterviewCvr = safeRate(proj.kpi_entry_to_interview_rate, decomposition.interview_cvr);

            const allocRevenue = Math.round(remainingRevenue * weight);
            const allocDeals = Math.ceil(allocRevenue / projUnitPrice);
            const allocInterviews = Math.ceil(allocDeals / (projDealCvr / 100));
            const allocEntries = Math.ceil(allocInterviews / (projInterviewCvr / 100));

            allocations.push({
                channel_type: (proj as any).type === 'agent_interview' ? 'agent_interview' : 'event',
                project_id: proj.event_id,
                project_title: proj.event_title,
                allocated_entries: allocEntries,
                allocated_interviews: allocInterviews,
                allocated_deals: allocDeals,
                allocated_revenue: allocRevenue,
                unit_price: projUnitPrice,
                deal_cvr: projDealCvr,
                interview_cvr: projInterviewCvr,
                is_manual_override: false,
            });
        }
    }

    // Compute totals
    const eventAllocs = allocations.filter(a => a.channel_type === 'event');
    const agentAllocs = allocations.filter(a => a.channel_type === 'agent_interview');
    const allocatedTotal = allocations.reduce((s, a) => s + a.allocated_revenue, 0);

    if (allocatedTotal < decomposition.revenue_target * 0.95) {
        warnings.push(`配分合計(¥${allocatedTotal.toLocaleString()})が売上目標(¥${decomposition.revenue_target.toLocaleString()})の95%を下回っています。`);
    }

    return {
        decomposition,
        allocations,
        totals: {
            event_revenue: eventAllocs.reduce((s, a) => s + a.allocated_revenue, 0),
            agent_revenue: agentAllocs.reduce((s, a) => s + a.allocated_revenue, 0),
            event_entries: eventAllocs.reduce((s, a) => s + a.allocated_entries, 0),
            agent_entries: agentAllocs.reduce((s, a) => s + a.allocated_entries, 0),
            unallocated_revenue: Math.max(decomposition.revenue_target - allocatedTotal, 0),
        },
        warnings,
    };
};

// ─────────────────────── Overview ───────────────────────

export const getOverview = async (filters: KpiFilters): Promise<KpiOverviewResult> => {
    // 1. Get funnel counts
    const funnel = await getCanonicalFunnelCounts(filters);

    // 2. Get per-group data if requested
    let perStaff: any[] | undefined;
    let perSource: any[] | undefined;
    if (filters.groupBy === 'staff') {
        const grouped = await getCanonicalFunnelCounts({ ...filters, groupBy: 'staff' });
        perStaff = grouped.per_staff;
    }
    if (filters.groupBy === 'source') {
        const grouped = await getCanonicalFunnelCounts({ ...filters, groupBy: 'source' });
        perSource = grouped.per_source;
    }

    // 3. Get goals for monthly
    let monthly: MonthlyOverview | undefined;
    if (filters.month) {
        const goals = await getGoals({
            scopeType: filters.staffId ? 'staff' : (filters.sourceCompany ? 'source' : 'global'),
            staffId: filters.staffId,
            sourceCompany: filters.sourceCompany,
            periodType: 'monthly',
            month: filters.month,
        });
        const goalMap = buildGoalMap(goals);

        // Get sales actuals
        const salesData = await getSalesData(filters);

        const salesTarget = goalMap['sales_target'] || 0;
        const seatsTarget = goalMap['required_seats'] || 0;
        const entriesTarget = goalMap['required_entries'] || 0;
        const interviewsTarget = goalMap['required_interviews'] || 0;
        const settingsTarget = goalMap['required_interview_settings'] || 0;
        const inflowTarget = goalMap['required_inflow'] || 0;

        // CVRs from goals or defaults
        const seatToEntry = goalMap['cvr_seat_to_entry'] || 70;
        const entryToInterview = goalMap['cvr_entry_to_interview'] || 60;
        const interviewToSetting = goalMap['cvr_interview_to_setting'] || 50;
        const inflowToSetting = goalMap['cvr_inflow_to_setting'] || 40;

        // Revenue decomposition (if revenue target is set)
        let decomposition: RevenueDecompositionResult | undefined;
        if (salesTarget > 0) {
            const avgUnitPrice = goalMap['unit_price'] || (salesData.totalAttendance > 0 ? Math.round(salesData.totalSales / salesData.totalAttendance) : 0);
            decomposition = decomposeFromRevenue({
                revenue_target: salesTarget,
                unit_price: avgUnitPrice > 0 ? avgUnitPrice : 1,
                deal_cvr: goalMap['deal_cvr'] || interviewToSetting,
                interview_cvr: goalMap['interview_cvr'] || entryToInterview,
            });
        }

        // Channel actuals
        let channelActuals;
        try {
            channelActuals = await getChannelData(filters);
        } catch { /* non-critical */ }

        monthly = {
            sales: metric(salesTarget, salesData.totalSales),
            seats: metric(seatsTarget, salesData.totalAttendance),
            entries: metric(entriesTarget, funnel.applications),
            interviews: metric(interviewsTarget, funnel.interview_completed),
            interviewSettings: metric(settingsTarget, funnel.interview_scheduled),
            inflow: metric(inflowTarget, funnel.reservations),
            rates: { seatToEntry, entryToInterview, interviewToSetting, inflowToSetting },
            salesBreakdown: salesData.events,
            decomposition,
            channelActuals,
        };
    }

    // 4. Weekly overview
    let weekly: WeeklyOverview | undefined;
    if (filters.week) {
        const goals = await getGoals({
            scopeType: filters.staffId ? 'staff' : (filters.sourceCompany ? 'source' : 'global'),
            staffId: filters.staffId,
            sourceCompany: filters.sourceCompany,
            periodType: 'weekly',
            month: filters.week, // Note: Repository uses period_start to match week
        });
        const goalMap = buildGoalMap(goals);
        const salesData = await getSalesData(filters);

        weekly = {
            weekLabel: filters.week,
            sales: metric(goalMap['sales_target'] || 0, salesData.totalSales),
            seats: metric(goalMap['required_seats'] || 0, salesData.totalAttendance),
            entries: metric(goalMap['required_entries'] || 0, funnel.applications),
            interviews: metric(goalMap['required_interviews'] || 0, funnel.interview_completed),
            salesBreakdown: salesData.events,
        };
    }

    // 5. Daily overview
    let daily: DailyOverview | undefined;
    if (filters.date || filters.month) {
        const trend = await getDailyApplicationTrend(filters, 62);
        if (filters.date) {
            daily = {
                date: filters.date,
                sales: metric(0, 0),
                seats: metric(0, 0),
                entries: metric(0, funnel.applications),
                interviews: metric(0, funnel.interview_completed),
                trend,
            };
        } else if (filters.month && monthly) {
            const daysRemaining = remainingDaysInMonth(filters.month);

            const dailyRevenue = daysRemaining > 0 ? Math.ceil(Math.max(monthly.sales.target - monthly.sales.actual, 0) / daysRemaining) : 0;
            const dailyEntries = daysRemaining > 0 ? Math.ceil(Math.max(monthly.entries.target - monthly.entries.actual, 0) / daysRemaining) : 0;
            const dailyInterviews = daysRemaining > 0 ? Math.ceil(Math.max(monthly.interviews.target - monthly.interviews.actual, 0) / daysRemaining) : 0;

            // Compute daily required deals from decomposition if available
            let dailyDeals = 0;
            if (monthly.decomposition) {
                const remainingDeals = Math.max(monthly.decomposition.deal_count - monthly.seats.actual, 0);
                dailyDeals = daysRemaining > 0 ? Math.ceil(remainingDeals / daysRemaining) : 0;
            }

            daily = {
                date: new Date().toISOString().slice(0, 10),
                sales: metric(dailyRevenue, 0),
                seats: metric(
                    daysRemaining > 0 ? Math.ceil(Math.max(monthly.seats.target - monthly.seats.actual, 0) / daysRemaining) : 0,
                    0
                ),
                entries: metric(dailyEntries, 0),
                interviews: metric(dailyInterviews, 0),
                trend,
                requiredDaily: {
                    entries: dailyEntries,
                    interviews: dailyInterviews,
                    deals: dailyDeals,
                    revenue: dailyRevenue,
                },
            };
        }
    }

    return {
        monthly,
        weekly,
        daily,
        funnel: {
            applications: funnel.applications,
            reservations: funnel.reservations,
            interview_scheduled: funnel.interview_scheduled,
            interview_completed: funnel.interview_completed,
        },
        perStaff,
        perSource,
    };
};

// ─────────────────────── Event KPI ───────────────────────

export const getEventKpi = async (filters: KpiFilters = {}): Promise<any[]> => {
    const events = await getEventKpiData(filters);

    // 1. Get period-specific goals for events if we have a context (month, week, or date)
    let periodGoals: Record<string, { target?: number; deadline?: string }> = {};
    
    if (filters.month || filters.week || filters.date) {
        const goalRows = await getGoals({
            periodType: filters.periodType || (filters.month ? 'monthly' : filters.week ? 'weekly' : 'daily'),
            month: filters.month,
            date: filters.date,
        });

        for (const g of goalRows) {
            if (g.scope_id && (g.scope_type === 'event' || g.scope_type === 'project')) {
                const key = `${g.scope_type}-${g.scope_id}`;
                if (!periodGoals[key]) periodGoals[key] = {};
                if (g.metric_key === 'target_seats') {
                    periodGoals[key].target = Number(g.target_value);
                }
                if (g.metric_key === 'guaranteed_sales') {
                    (periodGoals[key] as any).guaranteed_sales = Number(g.target_value);
                }
                if (g.metric_key === 'cvr_seat_to_entry') {
                    (periodGoals[key] as any).cvr_seat_to_entry = Number(g.target_value);
                }
                if (g.metric_key === 'unit_price') {
                    (periodGoals[key] as any).unit_price = Number(g.target_value);
                }
                if (g.metric_key === 'allocation_weight') {
                    (periodGoals[key] as any).allocation_weight = Number(g.target_value);
                }
                if (g.period_end) {
                    periodGoals[key].deadline = g.period_end.slice(0, 10);
                }
            }
        }
    }

    const todayDate = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');

    return events.map(e => {
        // 2. Override with period-specific goals if they exist
        const key = `${e.source}-${e.event_id}`;
        const override = periodGoals[key];
        const targetSeats = override?.target ?? e.target_seats;
        const deadline = override?.deadline ?? e.deadline;
        const monthlyCvrOverride = (override as any)?.cvr_seat_to_entry;
        const monthlyGuaranteedSales = (override as any)?.guaranteed_sales;
        const monthlyUnitPriceOverride = (override as any)?.unit_price;

        const unitPrice = monthlyUnitPriceOverride ?? e.unit_price;

        // Recalculate days_remaining based on (potentially overridden) deadline
        let daysRemaining = e.days_remaining;
        if (deadline) {
            const deadlineDate = new Date(deadline + 'T00:00:00');
            daysRemaining = Math.floor((deadlineDate.getTime() - todayDate.getTime()) / 86400000);
        }

        // 歩留まり率 (Conversion Rates) - Use monthly override if present
        const seatToEntry = safeRate(monthlyCvrOverride ?? e.kpi_seat_to_entry_rate, 70) / 100;
        const entryToInterview = safeRate(e.kpi_entry_to_interview_rate, 60) / 100;
        const interviewToReservation = safeRate(e.kpi_interview_to_reservation_rate, 50) / 100;
        const reservationToApplication = safeRate(e.kpi_reservation_to_application_rate, 40) / 100;

        // 目標値の逆算 (Back-calculating targets)
        const targetEntries = targetSeats > 0 ? Math.ceil(targetSeats / seatToEntry) : 0;
        const targetInterviews = targetEntries > 0 ? Math.ceil(targetEntries / entryToInterview) : 0;
        const targetReservations = targetInterviews > 0 ? Math.ceil(targetInterviews / interviewToReservation) : 0;
        const targetApplications = targetReservations > 0 ? Math.ceil(targetReservations / reservationToApplication) : 0;

        const days = Math.max(daysRemaining, 0);

        // 必要アクション数計算ヘルパー
        const calcAction = (target: number, current: number) => {
            const remaining = Math.max(target - current, 0);
            const daily = days > 0 ? Math.round((remaining / days) * 10) / 10 : 0;
            const weekly = Math.round(daily * 7 * 10) / 10;
            return { daily, weekly, remaining };
        };

        const seatsAction = calcAction(targetSeats, e.current_seats);
        const entriesAction = calcAction(targetEntries, e.current_entries);
        const interviewsAction = calcAction(targetInterviews, 0); 
        const reservationsAction = calcAction(targetReservations, 0);
        const applicationsAction = calcAction(targetApplications, 0);

        const targetSales = monthlyGuaranteedSales ?? (targetSeats * unitPrice);
        const currentSales = e.current_seats * unitPrice;
        const achievementRate = targetSales > 0 ? Math.round((currentSales / targetSales) * 1000) / 10 : 0;

        return {
            ...e,
            target_seats: targetSeats,
            target_sales: targetSales,
            current_sales: currentSales,
            unit_price: unitPrice,
            days_remaining: daysRemaining,
            
            // Goals
            target_entries: targetEntries,
            target_interviews: targetInterviews,
            target_reservations: targetReservations,
            target_applications: targetApplications,

            // Current
            current_seats: e.current_seats,
            current_entries: e.current_entries,

            // Actions (Daily/Weekly Required)
            daily_required_seats: seatsAction.daily,
            weekly_required_seats: seatsAction.weekly,
            daily_required_entries: entriesAction.daily,
            weekly_required_entries: entriesAction.weekly,
            daily_required_interviews: interviewsAction.daily,
            weekly_required_interviews: interviewsAction.weekly,
            daily_required_reservations: reservationsAction.daily,
            weekly_required_reservations: reservationsAction.weekly,
            daily_required_applications: applicationsAction.daily,
            weekly_required_applications: applicationsAction.weekly,

            achievementRate,
            
            kpi_seat_to_entry_rate: e.kpi_seat_to_entry_rate,
            kpi_entry_to_interview_rate: e.kpi_entry_to_interview_rate,
            kpi_interview_to_inflow_rate: e.kpi_interview_to_inflow_rate,
            kpi_custom_steps: e.kpi_custom_steps,
            status_breakdown: e.status_breakdown,
            
            // Schedule-level breakdown (Decomposition)
            schedule_breakdown: (e.event_slots || []).map((slot: any) => {
                const slotDateStr = slot.datetime ? slot.datetime.slice(0, 19) : '';
                const actual = (e.slots || []).find((s: any) => s.date?.slice(0, 19) === slotDateStr) || { entries: 0, seats: 0 };
                
                // Decomposition Logic
                const totalCap = (e.event_slots || []).reduce((sum: number, s: any) => sum + (Number(s.capacity) || 0), 0);
                const slotCap = Number(slot.capacity) || 0;
                
                let slotTargetSeats = 0;
                if (totalCap > 0 && slotCap > 0) {
                    slotTargetSeats = Math.ceil(targetSeats * (slotCap / totalCap));
                } else {
                    slotTargetSeats = Math.ceil(targetSeats / Math.max((e.event_slots || []).length, 1));
                }
                
                // Back-calculate funnel for this slot
                const slotTargetEntries = slotTargetSeats > 0 ? Math.ceil(slotTargetSeats / seatToEntry) : 0;
                const slotTargetInterviews = slotTargetEntries > 0 ? Math.ceil(slotTargetEntries / entryToInterview) : 0;
                const slotTargetInflow = slotTargetInterviews > 0 ? Math.ceil(slotTargetInterviews / (safeRate(e.kpi_interview_to_inflow_rate, 50) / 100)) : 0;
                
                return {
                    date: slot.datetime,
                    capacity: slotCap,
                    targets: {
                        seats: slotTargetSeats,
                        entries: slotTargetEntries,
                        interviews: slotTargetInterviews,
                        inflow: slotTargetInflow
                    },
                    actuals: {
                        seats: actual.seats,
                        entries: actual.entries
                    }
                };
            }),
            slots: e.slots || []
        };
    });
};

// ─────────────────────── Goals Passthrough ───────────────────────

export const getKpiGoals = async (filters: KpiFilters): Promise<GoalRow[]> => {
    await ensureKpiTable();
    return getGoals(filters);
};

export const upsertKpiGoals = async (goals: GoalRow[]): Promise<void> => {
    await ensureKpiTable();
    return upsertGoals(goals);
};
