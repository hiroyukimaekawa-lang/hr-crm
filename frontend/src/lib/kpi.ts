/**
 * KPI API Client — typed helpers for the unified /api/kpi/* endpoints.
 *
 * Front-end code should NEVER compute KPIs locally.
 * All values come pre-computed from the backend.
 */
import { api } from './api';

// ─── Types ───

export interface KpiMetric {
  target: number;
  actual: number;
  gap: number;
  achievementRate: number;
}

export interface MonthlyOverview {
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

export interface DailyOverview {
  date: string;
  sales: KpiMetric;
  seats: KpiMetric;
  entries: KpiMetric;
  interviews: KpiMetric;
  trend: Array<{ day: string; count: number }>;
}

export interface WeeklyOverview {
  weekLabel: string;
  sales: KpiMetric;
  seats: KpiMetric;
  entries: KpiMetric;
  interviews: KpiMetric;
}

export interface FunnelCounts {
  applications: number;
  reservations: number;
  interview_scheduled: number;
  interview_completed: number;
}

export interface KpiOverviewResponse {
  monthly?: MonthlyOverview;
  weekly?: WeeklyOverview;
  daily?: DailyOverview;
  funnel: FunnelCounts;
  perStaff?: any[];
  perSource?: any[];
}

export interface EventKpiSlot {
  date: string;
  capacity?: number;
  targets?: {
    seats: number;
    entries: number;
    interviews: number;
    inflow: number;
  };
  actuals?: {
    seats: number;
    entries: number;
  };
  entries?: number;
  seats?: number;
  status_breakdown: Record<string, number>;
}

export interface EventKpiItem {
  event_id: number;
  event_title: string;
  deadline: string | null;
  days_remaining: number;
  
  // Goals
  target_seats: number;
  target_entries: number;
  target_interviews: number;
  target_reservations: number;
  target_applications: number;

  // Current
  current_seats: number;
  current_entries: number;

  // Actions
  daily_required_seats: number;
  weekly_required_seats: number;
  daily_required_entries: number;
  weekly_required_entries: number;
  daily_required_interviews: number;
  weekly_required_interviews: number;
  daily_required_reservations: number;
  weekly_required_reservations: number;
  daily_required_applications: number;
  weekly_required_applications: number;

  target_sales: number;
  current_sales: number;
  achievementRate: number;
  kpi_seat_to_entry_rate: number;
  kpi_entry_to_interview_rate: number;
  kpi_interview_to_inflow_rate: number;
  kpi_custom_steps: any[];
  status_breakdown: Record<string, number>;
  schedule_breakdown?: EventKpiSlot[];
  slots: EventKpiSlot[];
  unit_price: number;
}

export interface GoalSetting {
  scope_type: string;
  scope_id?: number | null;
  source_company?: string | null;
  period_type: string;
  period_start: string;
  period_end?: string | null;
  metric_key: string;
  metric_label?: string;
  target_value: number;
  meta?: any;
}

// ─── Helpers ───

const authHeaders = () => ({
  headers: { Authorization: localStorage.getItem('token') || '' }
});

// ─── API Client ───

export const kpiApi = {
  /**
   * Get KPI overview (monthly / weekly / daily / funnel).
   */
  getOverview: (params: {
    month?: string;
    week?: string;
    date?: string;
    staff_id?: number;
    source_company?: string;
    graduation_year?: number;
    group_by?: string;
  } = {}) =>
    api.get<KpiOverviewResponse>('/api/kpi/overview', { ...authHeaders(), params }),

  /**
   * Get event-level KPI (all events).
   */
  getEvents: (params: {
    month?: string;
    week?: string;
    date?: string;
    period_type?: string;
  } = {}) =>
    api.get<EventKpiItem[]>('/api/kpi/events', { ...authHeaders(), params }),

  /**
   * Get goal settings.
   */
  getGoals: (params: {
    scope_type?: string;
    staff_id?: number;
    source_company?: string;
    event_id?: number;
    period_type?: string;
    period_start?: string;
    month?: string;
    date?: string;
    week?: string;
  } = {}) =>
    api.get<GoalSetting[]>('/api/kpi/goals', { ...authHeaders(), params }),

  /**
   * Bulk upsert goal settings.
   */
  updateGoals: (goals: GoalSetting[]) =>
    api.put('/api/kpi/goals/bulk', { goals }, authHeaders()),

  /**
   * Get funnel-only data.
   */
  getFunnel: (params: {
    month?: string;
    staff_id?: number;
    source_company?: string;
  } = {}) =>
    api.get<FunnelCounts>('/api/kpi/funnel', { ...authHeaders(), params }),
  
  /**
   * Update specific event KPI settings.
   */
  updateEventKpi: (id: number, data: any) =>
    api.put(`/api/events/${id}/kpi`, data, authHeaders()),
};

// ─── Display Helpers (front-end formatting only, NO computation) ───

export const rateColor = (rate: number): string => {
  if (rate >= 80) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

export const rateBgColor = (rate: number): string => {
  if (rate >= 80) return 'bg-emerald-50 border-emerald-200';
  if (rate >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
};

export const gapColor = (gap: number): string => {
  if (gap >= 0) return 'text-green-600';
  if (gap >= -3) return 'text-yellow-600';
  return 'text-red-600';
};

export const formatCurrency = (n: number): string =>
  n.toLocaleString('ja-JP');
