"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertKpiGoals = exports.getKpiGoals = exports.getEventKpi = exports.getOverview = void 0;
/**
 * KPI Service — business logic layer.
 *
 * Computes target vs actual, CVRs, gap, achievementRate, and derived
 * (reverse-calculated) requirements. This is the ONLY place where KPI
 * maths lives.
 */
const kpiRepository_1 = require("../repositories/kpiRepository");
// ─────────────────────── Helpers ───────────────────────
const metric = (target, actual) => ({
    target,
    actual,
    gap: actual - target,
    achievementRate: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
});
const safeRate = (v, fallback = 70) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : fallback;
};
/**
 * Compute remaining business days in month from a given date.
 * Simplified: counts all calendar days remaining.
 */
const remainingDaysInMonth = (monthStr) => {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jstNow.toISOString().slice(0, 10);
    const year = parseInt(monthStr.slice(0, 4));
    const month = parseInt(monthStr.slice(5, 7));
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    if (today > endDate)
        return 0;
    if (today < `${monthStr}-01`)
        return lastDay;
    const todayDay = parseInt(today.slice(8, 10));
    return lastDay - todayDay;
};
/**
 * Build goal map from goal rows: { metric_key: target_value }
 */
const buildGoalMap = (goals) => {
    const map = {};
    for (const g of goals) {
        map[g.metric_key] = Number(g.target_value);
    }
    return map;
};
// ─────────────────────── Overview ───────────────────────
const getOverview = (filters) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Get funnel counts
    const funnel = yield (0, kpiRepository_1.getCanonicalFunnelCounts)(filters);
    // 2. Get per-group data if requested
    let perStaff;
    let perSource;
    if (filters.groupBy === 'staff') {
        const grouped = yield (0, kpiRepository_1.getCanonicalFunnelCounts)(Object.assign(Object.assign({}, filters), { groupBy: 'staff' }));
        perStaff = grouped.per_staff;
    }
    if (filters.groupBy === 'source') {
        const grouped = yield (0, kpiRepository_1.getCanonicalFunnelCounts)(Object.assign(Object.assign({}, filters), { groupBy: 'source' }));
        perSource = grouped.per_source;
    }
    // 3. Get goals for monthly
    let monthly;
    if (filters.month) {
        const goals = yield (0, kpiRepository_1.getGoals)({
            scopeType: filters.staffId ? 'staff' : (filters.sourceCompany ? 'source' : 'global'),
            staffId: filters.staffId,
            sourceCompany: filters.sourceCompany,
            periodType: 'monthly',
            month: filters.month,
        });
        const goalMap = buildGoalMap(goals);
        // Get sales actuals
        const salesData = yield (0, kpiRepository_1.getSalesActuals)(filters);
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
    let weekly;
    if (filters.week) {
        const goals = yield (0, kpiRepository_1.getGoals)({
            scopeType: filters.staffId ? 'staff' : (filters.sourceCompany ? 'source' : 'global'),
            staffId: filters.staffId,
            sourceCompany: filters.sourceCompany,
            periodType: 'weekly',
            month: filters.week, // Note: Repository uses period_start to match week
        });
        const goalMap = buildGoalMap(goals);
        const salesData = yield (0, kpiRepository_1.getSalesActuals)(filters);
        weekly = {
            weekLabel: filters.week,
            sales: metric(goalMap['sales_target'] || 0, salesData.totalSales),
            seats: metric(goalMap['required_seats'] || 0, salesData.totalAttendance),
            entries: metric(goalMap['required_entries'] || 0, funnel.applications),
            interviews: metric(goalMap['required_interviews'] || 0, funnel.interview_completed),
        };
    }
    // 5. Daily overview
    let daily;
    if (filters.date || filters.month) {
        const trend = yield (0, kpiRepository_1.getDailyApplicationTrend)(filters, 62);
        if (filters.date) {
            daily = {
                date: filters.date,
                sales: metric(0, 0),
                seats: metric(0, 0),
                entries: metric(0, funnel.applications),
                interviews: metric(0, funnel.interview_completed),
                trend,
            };
        }
        else if (filters.month && monthly) {
            const daysRemaining = remainingDaysInMonth(filters.month);
            daily = {
                date: new Date().toISOString().slice(0, 10),
                sales: metric(daysRemaining > 0 ? Math.ceil(Math.max(monthly.sales.target - monthly.sales.actual, 0) / daysRemaining) : 0, 0),
                seats: metric(daysRemaining > 0 ? Math.ceil(Math.max(monthly.seats.target - monthly.seats.actual, 0) / daysRemaining) : 0, 0),
                entries: metric(daysRemaining > 0 ? Math.ceil(Math.max(monthly.entries.target - monthly.entries.actual, 0) / daysRemaining) : 0, 0),
                interviews: metric(daysRemaining > 0 ? Math.ceil(Math.max(monthly.interviews.target - monthly.interviews.actual, 0) / daysRemaining) : 0, 0),
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
});
exports.getOverview = getOverview;
// ─────────────────────── Event KPI ───────────────────────
const getEventKpi = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (filters = {}) {
    const events = yield (0, kpiRepository_1.getEventKpiData)();
    // 1. Get period-specific goals for events if we have a context (month, week, or date)
    let periodGoals = {};
    if (filters.month || filters.week || filters.date) {
        const goalRows = yield (0, kpiRepository_1.getGoals)({
            scopeType: 'event',
            periodType: filters.periodType || (filters.month ? 'monthly' : filters.week ? 'weekly' : 'daily'),
            month: filters.month,
            date: filters.date,
            // note: getGoals handles week by passing filters.month-01 internally if month exists,
            // we should ensure it handles week correctly.
        });
        for (const g of goalRows) {
            if (g.scope_id) {
                if (!periodGoals[g.scope_id])
                    periodGoals[g.scope_id] = {};
                if (g.metric_key === 'target_seats') {
                    periodGoals[g.scope_id].target = Number(g.target_value);
                }
                if (g.metric_key === 'guaranteed_sales') {
                    periodGoals[g.scope_id].guaranteed_sales = Number(g.target_value);
                }
                if (g.metric_key === 'cvr_seat_to_entry') {
                    periodGoals[g.scope_id].cvr_seat_to_entry = Number(g.target_value);
                }
                if (g.metric_key === 'unit_price') {
                    periodGoals[g.scope_id].unit_price = Number(g.target_value);
                }
                if (g.metric_key === 'allocation_weight') {
                    periodGoals[g.scope_id].allocation_weight = Number(g.target_value);
                }
                if (g.period_end) {
                    periodGoals[g.scope_id].deadline = g.period_end.slice(0, 10);
                }
            }
        }
    }
    const todayDate = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
    return events.map(e => {
        var _a, _b;
        // 2. Override with period-specific goals if they exist
        const override = periodGoals[e.event_id];
        const targetSeats = (_a = override === null || override === void 0 ? void 0 : override.target) !== null && _a !== void 0 ? _a : e.target_seats;
        const deadline = (_b = override === null || override === void 0 ? void 0 : override.deadline) !== null && _b !== void 0 ? _b : e.deadline;
        const monthlyCvrOverride = override === null || override === void 0 ? void 0 : override.cvr_seat_to_entry;
        const monthlyGuaranteedSales = override === null || override === void 0 ? void 0 : override.guaranteed_sales;
        const monthlyUnitPriceOverride = override === null || override === void 0 ? void 0 : override.unit_price;
        const unitPrice = monthlyUnitPriceOverride !== null && monthlyUnitPriceOverride !== void 0 ? monthlyUnitPriceOverride : e.unit_price;
        // Recalculate days_remaining based on (potentially overridden) deadline
        let daysRemaining = e.days_remaining;
        if (deadline) {
            const deadlineDate = new Date(deadline + 'T00:00:00');
            daysRemaining = Math.floor((deadlineDate.getTime() - todayDate.getTime()) / 86400000);
        }
        // 歩留まり率 (Conversion Rates) - Use monthly override if present
        const seatToEntry = safeRate(monthlyCvrOverride !== null && monthlyCvrOverride !== void 0 ? monthlyCvrOverride : e.kpi_seat_to_entry_rate, 70) / 100;
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
        const calcAction = (target, current) => {
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
        const targetSales = monthlyGuaranteedSales !== null && monthlyGuaranteedSales !== void 0 ? monthlyGuaranteedSales : (targetSeats * unitPrice);
        const currentSales = e.current_seats * unitPrice;
        const achievementRate = targetSales > 0 ? Math.round((currentSales / targetSales) * 1000) / 10 : 0;
        return Object.assign(Object.assign({}, e), { target_seats: targetSeats, target_sales: targetSales, current_sales: currentSales, unit_price: unitPrice, days_remaining: daysRemaining, 
            // Goals
            target_entries: targetEntries, target_interviews: targetInterviews, target_reservations: targetReservations, target_applications: targetApplications, 
            // Current
            current_seats: e.current_seats, current_entries: e.current_entries, 
            // Actions (Daily/Weekly Required)
            daily_required_seats: seatsAction.daily, weekly_required_seats: seatsAction.weekly, daily_required_entries: entriesAction.daily, weekly_required_entries: entriesAction.weekly, daily_required_interviews: interviewsAction.daily, weekly_required_interviews: interviewsAction.weekly, daily_required_reservations: reservationsAction.daily, weekly_required_reservations: reservationsAction.weekly, daily_required_applications: applicationsAction.daily, weekly_required_applications: applicationsAction.weekly, achievementRate, kpi_seat_to_entry_rate: e.kpi_seat_to_entry_rate, kpi_entry_to_interview_rate: e.kpi_entry_to_interview_rate, kpi_interview_to_inflow_rate: e.kpi_interview_to_inflow_rate, kpi_custom_steps: e.kpi_custom_steps, status_breakdown: e.status_breakdown, 
            // Schedule-level breakdown (Decomposition)
            schedule_breakdown: (e.event_slots || []).map((slot) => {
                const slotDateStr = slot.datetime ? slot.datetime.slice(0, 19) : '';
                const actual = (e.slots || []).find((s) => { var _a; return ((_a = s.date) === null || _a === void 0 ? void 0 : _a.slice(0, 19)) === slotDateStr; }) || { entries: 0, seats: 0 };
                // Decomposition Logic
                const totalCap = (e.event_slots || []).reduce((sum, s) => sum + (Number(s.capacity) || 0), 0);
                const slotCap = Number(slot.capacity) || 0;
                let slotTargetSeats = 0;
                if (totalCap > 0 && slotCap > 0) {
                    slotTargetSeats = Math.ceil(targetSeats * (slotCap / totalCap));
                }
                else {
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
            }), slots: e.slots || [] });
    });
});
exports.getEventKpi = getEventKpi;
// ─────────────────────── Goals Passthrough ───────────────────────
const getKpiGoals = (filters) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, kpiRepository_1.ensureKpiTable)();
    return (0, kpiRepository_1.getGoals)(filters);
});
exports.getKpiGoals = getKpiGoals;
const upsertKpiGoals = (goals) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, kpiRepository_1.ensureKpiTable)();
    return (0, kpiRepository_1.upsertGoals)(goals);
});
exports.upsertKpiGoals = upsertKpiGoals;
