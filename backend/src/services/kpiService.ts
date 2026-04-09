/**
 * KPI Service — business logic layer.
 *
 * Computes target vs actual, CVRs, gap, achievementRate, and derived
 * (reverse-calculated) requirements. This is the ONLY place where KPI
 * maths lives.
 */
import {
    KpiFilters,
    GoalRow,
    getCanonicalFunnelCounts,
    getDailyApplicationTrend,
    getGoals,
    upsertGoals,
    getEventKpiData,
    getMonthlySalesActuals,
    ensureKpiTable,
} from '../repositories/kpiRepository';

// ─────────────────────── Types ───────────────────────

interface KpiMetric {
    target: number;
    actual: number;
    gap: number;
    achievementRate: number; // 0-100+
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
}

interface WeeklyOverview {
    weekLabel: string;
    sales: KpiMetric;
    seats: KpiMetric;
    entries: KpiMetric;
    interviews: KpiMetric;
}

interface DailyOverview {
    date: string;
    sales: KpiMetric;
    seats: KpiMetric;
    entries: KpiMetric;
    interviews: KpiMetric;
    trend: Array<{ day: string; count: number }>;
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
        const salesData = await getMonthlySalesActuals(filters.month);

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

        monthly = {
            sales: metric(salesTarget, salesData.totalSales),
            seats: metric(seatsTarget, salesData.totalAttendance),
            entries: metric(entriesTarget, funnel.applications),
            interviews: metric(interviewsTarget, funnel.interview_completed),
            interviewSettings: metric(settingsTarget, funnel.interview_scheduled),
            inflow: metric(inflowTarget, funnel.reservations),
            rates: { seatToEntry, entryToInterview, interviewToSetting, inflowToSetting },
        };
    }

    // 4. Weekly overview
    let weekly: WeeklyOverview | undefined;
    if (filters.week) {
        weekly = {
            weekLabel: filters.week,
            sales: metric(0, 0),
            seats: metric(0, 0),
            entries: metric(0, funnel.applications),
            interviews: metric(0, funnel.interview_completed),
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
            daily = {
                date: new Date().toISOString().slice(0, 10),
                sales: metric(
                    daysRemaining > 0 ? Math.ceil(Math.max(monthly.sales.target - monthly.sales.actual, 0) / daysRemaining) : 0,
                    0
                ),
                seats: metric(
                    daysRemaining > 0 ? Math.ceil(Math.max(monthly.seats.target - monthly.seats.actual, 0) / daysRemaining) : 0,
                    0
                ),
                entries: metric(
                    daysRemaining > 0 ? Math.ceil(Math.max(monthly.entries.target - monthly.entries.actual, 0) / daysRemaining) : 0,
                    0
                ),
                interviews: metric(
                    daysRemaining > 0 ? Math.ceil(Math.max(monthly.interviews.target - monthly.interviews.actual, 0) / daysRemaining) : 0,
                    0
                ),
                trend,
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

export const getEventKpi = async (): Promise<EventKpiResult[]> => {
    const events = await getEventKpiData();

    return events.map(e => {
        const seatToEntry = safeRate(e.kpi_seat_to_entry_rate, 70) / 100;
        const entryToInterview = safeRate(e.kpi_entry_to_interview_rate, 60) / 100;
        const interviewToInflow = safeRate(e.kpi_interview_to_inflow_rate, 50) / 100;

        const targetSeats = e.target_seats;
        const targetEntries = targetSeats > 0 ? Math.ceil(targetSeats / seatToEntry) : 0;
        const targetInterviews = targetEntries > 0 ? Math.ceil(targetEntries / entryToInterview) : 0;
        const targetInflow = targetInterviews > 0 ? Math.ceil(targetInterviews / interviewToInflow) : 0;

        const days = Math.max(e.days_remaining, 0);
        const remainingEntries = Math.max(targetEntries - e.current_entries, 0);

        const dailyEntries = days > 0 ? Math.round((remainingEntries / days) * 10) / 10 : 0;
        const dailyInterviews = days > 0 ? Math.round((remainingEntries / entryToInterview / days) * 10) / 10 : 0;
        const dailyInflow = days > 0 ? Math.round((targetInflow / days) * 10) / 10 : 0;

        const targetSales = e.unit_price * targetSeats;
        const currentSales = e.unit_price * e.current_seats;
        const achievementRate = targetSeats > 0 ? Math.round((e.current_seats / targetSeats) * 1000) / 10 : 0;

        return {
            event_id: e.event_id,
            event_title: e.event_title,
            deadline: e.deadline,
            days_remaining: e.days_remaining,
            target_seats: targetSeats,
            current_seats: e.current_seats,
            target_entries: targetEntries,
            current_entries: e.current_entries,
            target_interviews: targetInterviews,
            target_inflow: targetInflow,
            daily_required_entries: dailyEntries,
            daily_required_interviews: dailyInterviews,
            daily_required_inflow: dailyInflow,
            target_sales: targetSales,
            current_sales: currentSales,
            achievementRate,
            kpi_seat_to_entry_rate: e.kpi_seat_to_entry_rate,
            kpi_entry_to_interview_rate: e.kpi_entry_to_interview_rate,
            kpi_interview_to_inflow_rate: e.kpi_interview_to_inflow_rate,
            kpi_custom_steps: e.kpi_custom_steps,
            status_breakdown: e.status_breakdown,
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
