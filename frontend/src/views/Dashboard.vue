<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { ArrowRight, CheckCircle } from 'lucide-vue-next';

interface Student {
  id: number;
  name: string;
  status?: string;
  is_favorite?: boolean;
  referral_outreach_status?: string;
  referral_count?: number;
  referral_expected_reach_count?: number;
  referral_expected_count?: number;
  university?: string;
  graduation_year?: number;
  staff_name?: string;
  created_at?: string;
}

interface EventItem {
  id: number;
  title: string;
  event_date?: string;
  event_dates?: string[];
  description?: string;
  location?: string;
  lp_url?: string;
  target_seats?: number;
  registered_count?: number;
  unit_price?: number;
  total_count?: number;
  attended_count?: number;
  a_entry_count?: number;
  b_waiting_count?: number;
  c_waiting_count?: number;
  xa_cancel_count?: number;
  event_slots?: any[];
}

interface EventParticipant {
  student_event_id?: number;
  student_id: number;
  status: string;
  created_at: string;
  selected_event_date?: string | null;
  name: string;
  university?: string;
  staff_name?: string;
  graduation_year?: number;
  next_task_content?: string | null;
  next_task_date?: string | null;
}

interface KgiProgress {
  event_id: number;
  event_title: string;
  deadline: string | null;
  days_remaining: number;
  target_entry: number;
  kpi_target_entry: number;
  kpi_rate: number;
  kpi_entry_to_interview_rate: number;
  kpi_interview_to_inflow_rate: number;
  kpi_custom_steps: Array<{ label: string; rate: number; position: number }>;
  current_entry: number;
  remaining_entry: number;
  target_seats: number;
  current_seats: number;
  daily_required_interview: number | null;
  daily_entry_gap: number;
}

const students = ref<Student[]>([]);
const dashboardTab = ref<'MAIN' | 'REFERRAL'>('MAIN');
const events = ref<EventItem[]>([]);
const user = ref<any>(JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}'));

// Sync user profile to ensure latest admin role is respected
onMounted(async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await api.get('/api/auth/me', {
      headers: { Authorization: token }
    });
    if (res.data.user) {
      user.value = res.data.user;
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }
  } catch (err) {
    console.error('Failed to sync user profile:', err);
  }
});

const selectedYomiEvent = ref<EventItem | null>(null);
const yomiParticipants = ref<EventParticipant[]>([]);
const yomiLoading = ref(false);

const rescheduleModalOpen = ref(false);
const rescheduleTarget = ref<EventParticipant | null>(null);
const rescheduleSelectedDate = ref('');
const actionMenuTarget = ref<EventParticipant | null>(null);
const showMonthlyAttendanceModal = ref(false);
const selectedMonthlyParticipants = ref<Array<EventParticipant & { event_title?: string; held_date?: string; single_event_date?: string | null }>>([]);
const monthlyFilters = ref({
  event_title: '',
  name: '',
  university: '',
  staff_name: '',
  created_at: '',
  selected_event_date: '',
  status: ''
});
const monthlySortField = ref<string | null>(null);
const monthlySortOrder = ref<'asc' | 'desc'>('asc');
const STATUS_ORDER_MAP: Record<string, number> = {
  A_ENTRY: 1, registered: 1,
  B_WAITING: 2,
  C_WAITING: 3,
  attended: 4,
  D_PASS: 5,
  E_FAIL: 6,
  XA_CANCEL: 7,
  canceled: 8
};
type YomiKey = 'A' | 'B' | 'C' | 'XA';
const interviewMetrics = ref({
  first_lead_time_days_avg: null as number | null,
  first_total: 0,
  first_rescheduled: 0,
  first_reschedule_rate: null as number | null,
  followup_lead_time_days_avg: null as number | null,
  followup_total: 0,
  followup_rescheduled: 0,
  followup_reschedule_rate: null as number | null,
  settings_by_date: [] as Array<{
    setting_date: string;
    source_company: string;
    setting_count: number;
  }>,
  interviews_by_date: [] as Array<{
    interview_date: string;
    source_company: string;
    interview_round: 'first' | 'second' | string;
    interview_count: number;
  }>,
  account_summary: {
    settings_count: 0,
    first_interviews_count: 0,
    second_interviews_count: 0,
    interviews_count: 0,
    setting_to_first_interview_lead_time_days_avg: null as number | null,
    first_interview_executed_count: 0,
    first_interview_execution_rate: null as number | null
  }
});
const interviewMetricsBySource = ref<Array<{
  source_company: string;
  first_lead_time_days_avg: number | null;
  first_total: number;
  first_rescheduled: number;
  first_reschedule_rate: number | null;
  followup_lead_time_days_avg: number | null;
  followup_total: number;
  followup_rescheduled: number;
  followup_reschedule_rate: number | null;
  settings_count?: number;
  first_interviews_count?: number;
  second_interviews_count?: number;
  interviews_count?: number;
  setting_to_first_interview_lead_time_days_avg?: number | null;
  first_interview_executed_count?: number;
  first_interview_execution_rate?: number | null;
}>>([]);
const interviewExecutionByStaff = ref<Array<{
  staff_id: number | null;
  staff_name: string;
  settings_count: number;
  first_interview_executed_count: number;
  first_interview_execution_rate: number | null;
}>>([]);
const sourceCompanyFilter = ref('ALL');
const funnelKpi = ref<{
  daily_applications: any[];
  applicationToReservationRate: number;
  reservationToInterviewRate: number;
  interviewToProposalRate: number;
  proposalToJoinRate: number;
  apply_to_reservation_lead_time_days_avg: number | null;
  reservation_to_interview_lead_time_days_avg: number | null;
  counts: any;
  graduation_year_breakdown: Array<{
    graduation_year: number;
    applications: number;
    reservations: number;
    interviews: number;
  }>;
}>({
  daily_applications: [],
  applicationToReservationRate: 0,
  reservationToInterviewRate: 0,
  interviewToProposalRate: 0,
  proposalToJoinRate: 0,
  apply_to_reservation_lead_time_days_avg: null,
  reservation_to_interview_lead_time_days_avg: null,
  counts: {},
  graduation_year_breakdown: []
});

// 卒業年度フィルタ用
const selectedGraduationYear = ref<number | null>(null);
const availableGraduationYears = ref<number[]>([]);

const kgiProgress = ref<KgiProgress[]>([]);
const kpiOverviewData = ref<any>(null);

// Period selection state
const periodType = ref<'monthly' | 'weekly' | 'daily'>('monthly');
const selectedWeekKey = ref('');
const selectedDayKey = ref(new Date().toISOString().slice(0, 10));

const getJSTDate = (date: Date = new Date()) => {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
};

const getISOWeek = (date: Date) => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

// Initialize default week
onMounted(() => {
  const jstNow = getJSTDate();
  selectedWeekKey.value = getISOWeek(jstNow);
  selectedDayKey.value = jstNow.toISOString().slice(0, 10);
});
const funnelTheme = computed(() => {
  if (selectedGraduationYear.value === 2027) return {
    bg: 'bg-blue-50/50',
    border: 'border-blue-100/50',
    text: 'text-blue-600',
    pill: 'text-blue-900 bg-blue-50 border-blue-100'
  };
  if (selectedGraduationYear.value === 2028) return {
    bg: 'bg-rose-50/50',
    border: 'border-rose-100/50',
    text: 'text-rose-600',
    pill: 'text-rose-900 bg-rose-50 border-rose-100'
  };
  return {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-100/50',
    text: 'text-emerald-600',
    pill: 'text-emerald-900 bg-emerald-50 border-emerald-100'
  };
});

const reservationToInterviewRate = computed(() => {
  return funnelKpi.value?.reservationToInterviewRate ?? 0;
});

const activeKgiProgress = computed(() =>
  kgiProgress.value.filter(row =>
    row.days_remaining !== null &&
    row.days_remaining !== undefined &&
    row.days_remaining >= 0
  )
);

const grad27Counts = computed(() => {
  const item = funnelKpi.value.graduation_year_breakdown.find(b => b.graduation_year === 2027);
  return item || { applications: 0, reservations: 0, interviews: 0 };
});

const grad28Counts = computed(() => {
  const item = funnelKpi.value.graduation_year_breakdown.find(b => b.graduation_year === 2028);
  return item || { applications: 0, reservations: 0, interviews: 0 };
});

const fetchKgiProgress = async () => {
  const token = localStorage.getItem('token');
  try {
    const [eventKgi, projectKgi] = await Promise.all([
      api.get('/api/events/kgi-progress', { headers: { Authorization: token } }),
      api.get('/api/projects/kgi-progress', { headers: { Authorization: token } })
    ]);
    kgiProgress.value = [
      ...(Array.isArray(eventKgi.data) ? eventKgi.data : []),
      ...(Array.isArray(projectKgi.data) ? projectKgi.data : [])
    ];
  } catch (err) {
    console.error('KGI fetch error', err);
  }
};

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const [studentRes, eventRes, projectRes] = await Promise.all([
      api.get('/api/students', { headers: { Authorization: token } }),
      api.get('/api/events', { headers: { Authorization: token } }),
      api.get('/api/projects', { headers: { Authorization: token } })
    ]);
    students.value = studentRes.data;
    
    // Unify active events and projects
    const allActive = [
      ...eventRes.data.map((e: any) => ({ ...e, source: 'event' })),
      ...projectRes.data.map((p: any) => ({ ...p, source: 'project' }))
    ];
    events.value = allActive;
    
    fetchInterviewMetrics().catch((err) => console.error(err));
    fetchFunnelKpi().catch((err) => console.error(err));
    fetchKgiProgress().catch((err) => console.error(err));
  } catch (err) {
    console.error(err);
  }
};


const fetchFunnelKpi = async () => {
  const token = localStorage.getItem('token');
  const params: any = {};
  if (selectedGraduationYear.value) {
    params.graduation_year = selectedGraduationYear.value;
  }
  
  // Apply period filters
  if (periodType.value === 'monthly') {
    params.month = selectedMonthKey.value;
  } else if (periodType.value === 'weekly') {
    params.week = selectedWeekKey.value;
  } else if (periodType.value === 'daily') {
    params.date = selectedDayKey.value;
  }
  
  const [res, overviewRes] = await Promise.all([
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token }, params }),
    api.get('/api/kpi/overview', { headers: { Authorization: token }, params })
  ]);
  
  kpiOverviewData.value = overviewRes.data;
  funnelKpi.value = {
    daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
    applicationToReservationRate: Number(res.data?.application_to_reservation_rate || 0),
    reservationToInterviewRate: Number(res.data?.reservation_to_interview_rate || 0),
    interviewToProposalRate: Number(res.data?.interview_to_proposal_rate || 0),
    proposalToJoinRate: Number(res.data?.proposal_to_join_rate || 0),
    apply_to_reservation_lead_time_days_avg: res.data?.apply_to_reservation_lead_time_days_avg ?? null,
    reservation_to_interview_lead_time_days_avg: res.data?.reservation_to_interview_lead_time_days_avg ?? null,
    counts: res.data?.counts || {},
    graduation_year_breakdown: res.data?.graduation_year_breakdown || []
  };
  
  // Override funnel counts and rates with the canonical KPI values
  const overview = overviewRes.data;
  if (overview.funnel) {
    funnelKpi.value.counts.applications_students = overview.funnel.applications || 0;
    funnelKpi.value.counts.reserved_students = overview.funnel.reservations || 0;
    funnelKpi.value.counts.interview_scheduled_students = overview.funnel.interview_scheduled || 0;
    funnelKpi.value.counts.interviewed_students = overview.funnel.interview_completed || 0;
    
    const app = overview.funnel.applications;
    const resv = overview.funnel.reservations;
    const intv = overview.funnel.interview_completed;
    
    // Also update funnelKpi with period-specific data if available
    const periodData = overview[periodType.value];
    if (periodData) {
      funnelKpi.value.counts.applications_students = periodData.entries?.actual || 0;
      funnelKpi.value.counts.reserved_students = periodData.inflow?.actual || 0;
      funnelKpi.value.counts.interviewed_students = periodData.interviews?.actual || 0;
    }
    funnelKpi.value.applicationToReservationRate = app > 0 ? Number(((resv / app) * 100).toFixed(2)) : 0;
    funnelKpi.value.reservationToInterviewRate = resv > 0 ? Number(((intv / resv) * 100).toFixed(2)) : 0;
  }
  
  if (Array.isArray(res.data?.graduation_years)) {
    availableGraduationYears.value = res.data.graduation_years;
  }
};

const fetchInterviewMetrics = async () => {
  const token = localStorage.getItem('token');
  const params: Record<string, string> = {};
  if (sourceCompanyFilter.value !== 'ALL') params.source_company = sourceCompanyFilter.value;
  const [metricsRes, bySourceRes, byStaffRes] = await Promise.all([
    api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params }),
    api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params: { group_by_source: '1', ...(sourceCompanyFilter.value !== 'ALL' ? { source_company: sourceCompanyFilter.value } : {}) } }),
    api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params: { group_by_staff: '1', ...(sourceCompanyFilter.value !== 'ALL' ? { source_company: sourceCompanyFilter.value } : {}) } })
  ]);
  interviewMetrics.value = {
    first_lead_time_days_avg: metricsRes.data?.first_lead_time_days_avg ?? null,
    first_total: Number(metricsRes.data?.first_total || 0),
    first_rescheduled: Number(metricsRes.data?.first_rescheduled || 0),
    first_reschedule_rate: metricsRes.data?.first_reschedule_rate ?? null,
    followup_lead_time_days_avg: metricsRes.data?.followup_lead_time_days_avg ?? null,
    followup_total: Number(metricsRes.data?.followup_total || 0),
    followup_rescheduled: Number(metricsRes.data?.followup_rescheduled || 0),
    followup_reschedule_rate: metricsRes.data?.followup_reschedule_rate ?? null,
    settings_by_date: Array.isArray(metricsRes.data?.settings_by_date)
      ? metricsRes.data.settings_by_date.map((r: any) => ({
          setting_date: String(r.setting_date || ''),
          source_company: String(r.source_company || '未設定'),
          setting_count: Number(r.setting_count || 0)
        }))
      : [],
    interviews_by_date: Array.isArray(metricsRes.data?.interviews_by_date)
      ? metricsRes.data.interviews_by_date.map((r: any) => ({
          interview_date: String(r.interview_date || ''),
          source_company: String(r.source_company || '未設定'),
          interview_round: String(r.interview_round || 'first'),
          interview_count: Number(r.interview_count || 0)
        }))
      : [],
    account_summary: {
      settings_count: Number(metricsRes.data?.account_summary?.settings_count || 0),
      first_interviews_count: Number(metricsRes.data?.account_summary?.first_interviews_count || 0),
      second_interviews_count: Number(metricsRes.data?.account_summary?.second_interviews_count || 0),
      interviews_count: Number(metricsRes.data?.account_summary?.interviews_count || 0),
      setting_to_first_interview_lead_time_days_avg: metricsRes.data?.account_summary?.setting_to_first_interview_lead_time_days_avg ?? null,
      first_interview_executed_count: Number(metricsRes.data?.account_summary?.first_interview_executed_count || 0),
      first_interview_execution_rate: metricsRes.data?.account_summary?.first_interview_execution_rate ?? null
    }
  };
  interviewMetricsBySource.value = Array.isArray(bySourceRes.data) ? bySourceRes.data.map((r: any) => ({
    source_company: r.source_company || '未設定',
    first_lead_time_days_avg: r.first_lead_time_days_avg ?? null,
    first_total: Number(r.first_total || 0),
    first_rescheduled: Number(r.first_rescheduled || 0),
    first_reschedule_rate: r.first_reschedule_rate ?? null,
    followup_lead_time_days_avg: r.followup_lead_time_days_avg ?? null,
    followup_total: Number(r.followup_total || 0),
    followup_rescheduled: Number(r.followup_rescheduled || 0),
    followup_reschedule_rate: r.followup_reschedule_rate ?? null,
    settings_count: Number(r.settings_count || 0),
    first_interviews_count: Number(r.first_interviews_count || 0),
    second_interviews_count: Number(r.second_interviews_count || 0),
    interviews_count: Number(r.interviews_count || 0),
    setting_to_first_interview_lead_time_days_avg: r.setting_to_first_interview_lead_time_days_avg ?? null,
    first_interview_executed_count: Number(r.first_interview_executed_count || 0),
    first_interview_execution_rate: r.first_interview_execution_rate ?? null
  })) : [];
  interviewExecutionByStaff.value = Array.isArray(byStaffRes.data)
    ? byStaffRes.data.map((r: any) => ({
        staff_id: r.staff_id ?? null,
        staff_name: String(r.staff_name || '未割当'),
        settings_count: Number(r.settings_count || 0),
        first_interview_executed_count: Number(r.first_interview_executed_count || 0),
        first_interview_execution_rate: r.first_interview_execution_rate ?? null
      }))
    : [];
};

const upcomingEvents = computed(() => {
  const now = new Date();
  return events.value.filter(e => e.event_date && new Date(e.event_date) > now).length;
});

const today = new Date();
today.setHours(0, 0, 0, 0);

const eventYomiRows = computed(() =>
  [...events.value]
    .filter((e) => {
      // event_slotsがある場合は最終日程が今日以降のものだけ表示
      if (Array.isArray(e.event_slots) && e.event_slots.length > 0) {
        const lastSlot = e.event_slots
          .map((s: any) => new Date(s.datetime || 0))
          .filter((d: Date) => !isNaN(d.getTime()))
          .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
        return lastSlot ? lastSlot >= today : true;
      }
      // event_dateがある場合は今日以降のものだけ表示
      if (e.event_date) {
        return new Date(e.event_date) >= today;
      }
      return true;
    })
    .sort((a, b) => new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime())
    .map((e) => ({
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      event_slots: e.event_slots,
      a: Number(e.a_entry_count || 0),
      b: Number(e.b_waiting_count || 0),
      c: Number(e.c_waiting_count || 0),
      xa: Number(e.xa_cancel_count || 0),
      total: Number(e.total_count || 0)
    }))
);

const yomiStatusLabel = (status?: string) => {
  switch (status) {
    case 'A_ENTRY':
    case 'registered':
      return 'A:エントリー';
    case 'B_WAITING':
      return 'B:回答待ち';
    case 'C_WAITING':
      return 'C:回答待ち';
    case 'XA_CANCEL':
    case 'canceled':
      return 'XA:エントリーキャンセル';
    case 'attended':
      return '出席';
    default:
      return status || '-';
  }
};

const yomiStatusClass = (status?: string) => {
  switch (status) {
    case 'A_ENTRY':
    case 'registered':
      return 'bg-blue-100 text-blue-700';
    case 'B_WAITING':
      return 'bg-amber-100 text-amber-700';
    case 'C_WAITING':
      return 'bg-purple-100 text-purple-700';
    case 'XA_CANCEL':
    case 'canceled':
      return 'bg-red-100 text-red-700';
    case 'attended':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const openYomiEventDetail = async (eventId: number) => {
  const found = events.value.find((e) => e.id === eventId) || null;
  selectedYomiEvent.value = found;
  yomiParticipants.value = [];
  yomiLoading.value = true;
  try {
    const token = localStorage.getItem('token');
    const source = (found as any)?.source === 'project' ? 'projects' : 'events';
    const res = await api.get(`/api/${source}/${eventId}`, { headers: { Authorization: token } });
    console.log('API Response Participants:', res.data.participants);
    yomiParticipants.value = res.data.participants || [];
    console.log('yomiParticipants value:', yomiParticipants.value);
  } catch (err) {
    console.error(err);
  } finally {
    yomiLoading.value = false;
  }
};

const closeYomiEventDetail = () => {
  selectedYomiEvent.value = null;
  yomiParticipants.value = [];
};

const openMonthlyAttendanceModal = async () => {
  showMonthlyAttendanceModal.value = true;
  selectedMonthlyParticipants.value = [];
  yomiLoading.value = true;
  
  try {
    const token = localStorage.getItem('token');
    const month = selectedMonthKey.value;
    
    // Get all events in this month
    const monthEvents = events.value.filter(e => {
      // event_date が対象月に含まれる場合
      if (e.event_date && String(e.event_date).slice(0, 7) === month) return true;
      // event_slots のいずれかの日程が対象月に含まれる場合
      if (Array.isArray(e.event_slots) && e.event_slots.length > 0) {
        return e.event_slots.some((slot: any) =>
          slot?.datetime && String(slot.datetime).slice(0, 7) === month
        );
      }
      return false;
    });
    
    // Fetch participants for each event
    const participantPromises = monthEvents.map(e => {
      // Determine single event date
      let singleDate: string | null = null;
      if (Array.isArray(e.event_dates) && e.event_dates.length === 1) {
        singleDate = e.event_dates[0] || null;
      } else if (!Array.isArray(e.event_dates) && e.event_date) {
        singleDate = e.event_date;
      }
      
      return api.get(`/api/projects/${e.id}`, { headers: { Authorization: token } })
         .then(res => {
           return (res.data.participants || []).map((p: any) => ({
             ...p,
             event_title: e.title,
             held_date: e.event_date,
             single_event_date: singleDate
           }));
         })
         .catch(() => []);
    });
    
    const results = await Promise.all(participantPromises);
    selectedMonthlyParticipants.value = results.flat();
    monthlyFilters.value = { event_title: '', name: '', university: '', staff_name: '', created_at: '', selected_event_date: '', status: '' };
  } catch (err) {
    console.error(err);
  } finally {
    yomiLoading.value = false;
  }
};

const closeMonthlyAttendanceModal = () => {
  showMonthlyAttendanceModal.value = false;
  selectedMonthlyParticipants.value = [];
};

const normalizedYomiKey = (status?: string): 'A' | 'B' | 'C' | 'XA' | 'OTHER' => {
  if (status === 'A_ENTRY' || status === 'registered') return 'A';
  if (status === 'B_WAITING') return 'B';
  if (status === 'C_WAITING') return 'C';
  if (status === 'XA_CANCEL' || status === 'canceled') return 'XA';
  if (status) console.log('Unexpected status in normalizedYomiKey:', status);
  return 'OTHER';
};

const formatDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatEventSlot = (datetime?: string | null, location?: string | null) => {
  if (!datetime) return '-';
  const raw = String(datetime).replace('Z', '').replace('+09:00', '').replace('+09', '');
  const d = new Date(raw);
  if (isNaN(d.getTime())) return datetime;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const base = `${m}/${day} ${hh}:${mm}`;
  return location ? `${base} ${location}` : base;
};

const EXCLUDED_STATUSES = ['attended', 'E_FAIL', 'D_PASS'];

const attendedCount = computed(() =>
  yomiParticipants.value.filter(p => p.status === 'attended').length
);

const xaCount = computed(() =>
  yomiParticipants.value.filter(p =>
    p.status === 'XA_CANCEL' || p.status === 'canceled'
  ).length
);

const yomiCounts = computed(() => ({
  A: yomiParticipants.value.filter((p) =>
    normalizedYomiKey(p.status) === 'A' && !EXCLUDED_STATUSES.includes(p.status)
  ).length,
  B: yomiParticipants.value.filter((p) =>
    normalizedYomiKey(p.status) === 'B' && !EXCLUDED_STATUSES.includes(p.status)
  ).length,
  C: yomiParticipants.value.filter((p) =>
    normalizedYomiKey(p.status) === 'C' && !EXCLUDED_STATUSES.includes(p.status)
  ).length,
  XA: yomiParticipants.value.filter((p) =>
    normalizedYomiKey(p.status) === 'XA' && !EXCLUDED_STATUSES.includes(p.status)
  ).length
}));

const yomiAmounts = computed(() => {
  const unitPrice = Number(selectedYomiEvent.value?.unit_price || 0);
  return {
    A: yomiCounts.value.A * unitPrice,
    B: yomiCounts.value.B * unitPrice,
    C: yomiCounts.value.C * unitPrice,
    XA: yomiCounts.value.XA * unitPrice
  };
});

const yomiGroups = computed<Record<YomiKey, EventParticipant[]>>(() => {
  const result = {
    A: yomiParticipants.value.filter((p) =>
      normalizedYomiKey(p.status) === 'A' && !EXCLUDED_STATUSES.includes(p.status)
    ),
    B: yomiParticipants.value.filter((p) =>
      normalizedYomiKey(p.status) === 'B' && !EXCLUDED_STATUSES.includes(p.status)
    ),
    C: yomiParticipants.value.filter((p) =>
      normalizedYomiKey(p.status) === 'C' && !EXCLUDED_STATUSES.includes(p.status)
    ),
    XA: yomiParticipants.value.filter((p) =>
      normalizedYomiKey(p.status) === 'XA' && !EXCLUDED_STATUSES.includes(p.status)
    )
  };
  console.log('yomiGroups result:', result);
  return result;
});

const markAttended = async (participant: EventParticipant) => {
  if (!selectedYomiEvent.value) return;
  const studentEventId = participant.student_event_id;

  if (!studentEventId) {
    console.error('student_event_id が取得できません');
    return;
  }

  try {
    // 楽観的UI更新（即時ヨミ表から消える）
    const target = yomiParticipants.value.find(
      p => p.student_event_id === studentEventId
    );
    if (target) {
      target.status = 'attended';
    }

    const token = localStorage.getItem('token');
    const source = (selectedYomiEvent.value as any).source === 'project' ? 'projects' : 'events';
    await api.put(
      `/api/${source}/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
      { status: 'attended' },
      { headers: { Authorization: token } }
    );
    fetchData();
  } catch (err) {
    console.error('出席更新エラー:', err);
    // エラー時はリロードして元に戻す
    fetchData();
  }
};

const markNoShow = async (participant: EventParticipant) => {
  if (!selectedYomiEvent.value) return;
  const studentEventId = participant.student_event_id;
  if (!studentEventId) {
    console.error('student_event_id が取得できません');
    return;
  }
  try {
    const target = yomiParticipants.value.find(
      p => p.student_event_id === studentEventId
    );
    if (target) target.status = 'E_FAIL';
    const token = localStorage.getItem('token');
    const source = (selectedYomiEvent.value as any).source === 'project' ? 'projects' : 'events';
    await api.put(
      `/api/${source}/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
      { status: 'E_FAIL' },
      { headers: { Authorization: token } }
    );
    fetchData();
  } catch (err) {
    console.error('不参加更新エラー:', err);
    fetchData();
  }
};

const markReschedule = (participant: EventParticipant) => {
  rescheduleTarget.value = participant;
  // 現在の参加日程を初期選択値にセット
  rescheduleSelectedDate.value = participant.selected_event_date || '';
  rescheduleModalOpen.value = true;
};

const confirmReschedule = async () => {
  if (!rescheduleTarget.value || !selectedYomiEvent.value) return;
  const studentEventId = rescheduleTarget.value.student_event_id;
  if (!studentEventId) return;

  try {
    const target = yomiParticipants.value.find(
      p => p.student_event_id === studentEventId
    );
    if (target) {
      target.status = 'B_WAITING';
      target.selected_event_date = rescheduleSelectedDate.value;
    }

    const token = localStorage.getItem('token');
    const source = (selectedYomiEvent.value as any).source === 'project' ? 'projects' : 'events';
    await api.put(
      `/api/${source}/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
      {
        status: 'B_WAITING',
        selected_event_date: rescheduleSelectedDate.value || null
      },
      { headers: { Authorization: token } }
    );
    rescheduleModalOpen.value = false;
    rescheduleTarget.value = null;
    rescheduleSelectedDate.value = '';
    fetchData();
  } catch (err) {
    console.error('リスケ更新エラー:', err);
    fetchData();
  }
};

const yomiSections: Array<{ key: YomiKey; label: string; accent: string }> = [
  { key: 'A', label: 'A:エントリー', accent: 'text-blue-700 border-blue-200 bg-blue-50' },
  { key: 'B', label: 'B:回答待ち', accent: 'text-amber-700 border-amber-200 bg-amber-50' },
  { key: 'C', label: 'C:回答待ち', accent: 'text-purple-700 border-purple-200 bg-purple-50' },
  { key: 'XA', label: 'XA:エントリーキャンセル', accent: 'text-red-700 border-red-200 bg-red-50' }
];

const draggingParticipant = ref<EventParticipant | null>(null);
const dragOverZone = ref<string | null>(null);

const onDragStart = (e: DragEvent, participant: EventParticipant) => {
  draggingParticipant.value = participant;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
};

const onDragEnd = () => {
  draggingParticipant.value = null;
  dragOverZone.value = null;
};

const onDrop = async (e: DragEvent, newStatusKey: string) => {
  e.preventDefault();
  if (!draggingParticipant.value || !selectedYomiEvent.value) return;

  const currentKey = normalizedYomiKey(draggingParticipant.value.status);
  if (currentKey === newStatusKey) {
    onDragEnd();
    return;
  }

  // Map key back to primary status
  const keyToStatus: Record<string, string> = {
    A: 'A_ENTRY',
    B: 'B_WAITING',
    C: 'C_WAITING',
    XA: 'XA_CANCEL'
  };
  const newStatus = keyToStatus[newStatusKey];
  if (!newStatus) {
    onDragEnd();
    return;
  }

  // 楽観的UI更新（即時反映）
  const dragId = draggingParticipant.value.student_event_id || draggingParticipant.value.student_id;
  const target = yomiParticipants.value.find(p => (p.student_event_id || p.student_id) === dragId);
  if (target) {
    target.status = newStatus;
  }

  // API更新
  try {
    const token = localStorage.getItem('token');
    const studentEventId = draggingParticipant.value.student_event_id;
    if (!studentEventId) {
        console.error('student_event_id が取得できませんでした');
        onDragEnd();
        return;
    }
    if (studentEventId) {
      await api.put(
        `/api/projects/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
        { status: newStatus },
        { headers: { Authorization: token } }
      );
    }
    fetchData();
  } catch (err) {
    console.error(err);
  }

  onDragEnd();
};

const updateYomiParticipantStatus = async (
  eventId: number,
  studentEventId: number,
  status: 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL'
) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(
      `/api/projects/${eventId}/participants/${studentEventId}`,
      { status },
      { headers: { Authorization: token } }
    );
    await openYomiEventDetail(eventId);
    await fetchData();
  } catch (err) {
    console.error(err);
  }
};

const toggleActionMenu = (participant: EventParticipant) => {
  if (actionMenuTarget.value?.student_event_id === participant.student_event_id) {
    actionMenuTarget.value = null;
  } else {
    actionMenuTarget.value = participant;
  }
};

const calendarBaseMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

const calendarTitle = computed(() =>
  `${calendarBaseMonth.value.getFullYear()}年${calendarBaseMonth.value.getMonth() + 1}月`
);

const settingCountByDate = computed(() => {
  const m: Record<string, number> = {};
  interviewMetrics.value.settings_by_date.forEach((r) => {
    const key = String(r.setting_date || '').slice(0, 10);
    m[key] = (m[key] || 0) + Number(r.setting_count || 0);
  });
  return m;
});

const interviewCountByDate = computed(() => {
  const m: Record<string, number> = {};
  interviewMetrics.value.interviews_by_date.forEach((r) => {
    const key = String(r.interview_date || '').slice(0, 10);
    m[key] = (m[key] || 0) + Number(r.interview_count || 0);
  });
  return m;
});

const applicationCountByDate = computed(() => {
  const m: Record<string, number> = {};
  funnelKpi.value.daily_applications.forEach((r) => {
    const key = String(r.day || '').slice(0, 10);
    m[key] = (m[key] || 0) + Number(r.count || 0);
  });
  return m;
});

const calendarCells = computed(() => {
  const base = calendarBaseMonth.value;
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; day: number | null; date: string | null }> = [];

  for (let i = 0; i < firstDay; i++) cells.push({ key: `empty-${i}`, day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = date.toISOString().slice(0, 10);
    cells.push({ key, day: d, date: key });
  }
  while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, day: null, date: null });
  return cells;
});

const prevMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() - 1, 1);
};

const nextMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() + 1, 1);
};

const selectedMonthKey = computed(() => {
  const y = calendarBaseMonth.value.getFullYear();
  const m = String(calendarBaseMonth.value.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
});

const monthlyInterviewBySource = computed(() => {
  const map: Record<string, { first: number; second: number; total: number }> = {};
  interviewMetrics.value.interviews_by_date.forEach((r) => {
    const key = String(r.interview_date || '').slice(0, 7);
    if (key !== selectedMonthKey.value) return;
    const source = String(r.source_company || '未設定');
    if (!map[source]) map[source] = { first: 0, second: 0, total: 0 };
    const count = Number(r.interview_count || 0);
    if (r.interview_round === 'second') map[source].second += count;
    else map[source].first += count;
    map[source].total += count;
  });
  return Object.entries(map)
    .map(([source_company, counts]) => ({ source_company, ...counts }))
    .sort((a, b) => b.total - a.total);
});

const monthlyInterviewTotal = computed(() =>
  monthlyInterviewBySource.value.reduce((sum, r) => sum + r.total, 0)
);

const sourceCompanyOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach((s: any) => {
    const key = String(s.source_company || '').trim();
    if (key) set.add(key);
  });
  return ['ALL', ...Array.from(set).sort()];
});

const monthlyYomiByEvent = computed(() => {
  const month = selectedMonthKey.value;
  return eventYomiRows.value
    .filter((row) => {
      if (row.event_date) {
        return String(row.event_date).slice(0, 7) === month;
      }
      if (row.event_slots && Array.isArray(row.event_slots) && row.event_slots.length > 0) {
        return row.event_slots.some((slot: any) =>
          String(slot.datetime || '').slice(0, 7) === month
        );
      }
      return false;
    })
    .map((row) => ({
      ...row,
      heldDate: row.event_date ? new Date(row.event_date).toLocaleDateString('ja-JP') : '-'
    }));
});

const uniqueEventTitles = computed(() =>
  [...new Set(selectedMonthlyParticipants.value.map(p => p.event_title).filter(Boolean))].sort()
);

const uniqueStaffNames = computed(() =>
  [...new Set(selectedMonthlyParticipants.value.map(p => p.staff_name).filter(Boolean))].sort()
);

const toggleSort = (field: string) => {
  if (monthlySortField.value === field) {
    if (monthlySortOrder.value === 'asc') {
      monthlySortOrder.value = 'desc';
    } else {
      monthlySortField.value = null;
      monthlySortOrder.value = 'asc';
    }
  } else {
    monthlySortField.value = field;
    monthlySortOrder.value = 'asc';
  }
};

const monthlyAttendanceCount = computed(() =>
  monthlyYomiByEvent.value.reduce((sum, row) => sum + Number(row.total || 0), 0)
);

const exportMonthlyParticipantsCsv = () => {
  const headers = ['案件名', '学生名', '大学', '担当', '申込日', '参加日程', 'ステータス'];
  const rows = filteredMonthlyParticipants.value.map(p => [
    p.event_title || '',
    p.name || '',
    p.university || '',
    p.staff_name || '',
    formatDateKey(p.created_at),
    formatDateKey(p.selected_event_date || p.single_event_date),
    yomiStatusLabel(p.status)
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const month = `${calendarBaseMonth.value.getFullYear()}${String(calendarBaseMonth.value.getMonth() + 1).padStart(2, '0')}`;
  a.download = `参加者一覧_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const filteredMonthlyParticipants = computed(() => {
  const filtered = selectedMonthlyParticipants.value.filter(p => {
    const pDate = formatDateKey(p.selected_event_date || p.single_event_date);
    const cDate = formatDateKey(p.created_at);
    const matchEvent = !monthlyFilters.value.event_title || (p.event_title || '').includes(monthlyFilters.value.event_title);
    const matchName = !monthlyFilters.value.name || p.name.includes(monthlyFilters.value.name);
    const matchUniv = !monthlyFilters.value.university || (p.university || '').includes(monthlyFilters.value.university);
    const matchStaff = !monthlyFilters.value.staff_name || (p.staff_name || '').includes(monthlyFilters.value.staff_name);
    const matchCreatedAt = !monthlyFilters.value.created_at || cDate.includes(monthlyFilters.value.created_at);
    const matchEventDate = !monthlyFilters.value.selected_event_date || pDate.includes(monthlyFilters.value.selected_event_date);
    const matchStatus = !monthlyFilters.value.status || monthlyFilters.value.status === 'ALL' || normalizedYomiKey(p.status) === monthlyFilters.value.status;
    return matchEvent && matchName && matchUniv && matchStaff && matchCreatedAt && matchEventDate && matchStatus;
  });
  if (!monthlySortField.value) return filtered;
  return [...filtered].sort((a, b) => {
    const field = monthlySortField.value!;
    if (field === 'status') {
      const aOrder = STATUS_ORDER_MAP[a.status] ?? 99;
      const bOrder = STATUS_ORDER_MAP[b.status] ?? 99;
      return monthlySortOrder.value === 'asc' ? aOrder - bOrder : bOrder - aOrder;
    }
    const aVal = String((a as any)[field] || '');
    const bVal = String((b as any)[field] || '');
    return monthlySortOrder.value === 'asc'
      ? aVal.localeCompare(bVal, 'ja')
      : bVal.localeCompare(aVal, 'ja');
  });
});

const referralStats = computed(() => {
  const favoriteStudents = students.value.filter(s => s.is_favorite);
  return {
    targetCount: favoriteStudents.length,
    expectedReach: favoriteStudents.reduce((sum, s) => sum + Number(s.referral_expected_reach_count || 0), 0),
    expectedReferrals: favoriteStudents.reduce((sum, s) => sum + Number(s.referral_expected_count || 0), 0),
    actualReferrals: favoriteStudents.reduce((sum, s) => sum + Number(s.referral_count || 0), 0)
  };
});

const updateReferralOutreachStatus = async (studentId: number, status: string) => {
  try {
    const token = localStorage.getItem('token');
    await api.patch(`/api/students/${studentId}/referral-status`, { referral_outreach_status: status }, {
      headers: { Authorization: token }
    });
    // Update local state
    const student = students.value.find(s => s.id === studentId);
    if (student) {
      student.referral_outreach_status = status;
    }
  } catch (err) {
    console.error(err);
  }
};

const updateReferralCounts = async (studentId: number, field: 'referral_expected_reach_count' | 'referral_expected_count', value: number) => {
  try {
    const token = localStorage.getItem('token');
    const updateData: any = {};
    updateData[field] = value;
    
    await api.patch(`/api/students/${studentId}/referral-counts`, updateData, {
      headers: { Authorization: token }
    });
    
    const student = students.value.find(s => s.id === studentId);
    if (student) {
      student[field] = value;
    }
  } catch (err) {
    console.error('Failed to update referral counts:', err);
  }
};

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

onMounted(() => {
  fetchData();
  checkMobile();
  window.addEventListener('resize', checkMobile);
  document.addEventListener('click', () => {
    actionMenuTarget.value = null;
  });
});
watch(sourceCompanyFilter, fetchInterviewMetrics);
watch(selectedGraduationYear, fetchFunnelKpi);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-black text-gray-900 tracking-tight">ダッシュボード</h1>
        <p class="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider opacity-60">Latest performance & metrics</p>
      </div>

      <!-- Tab Switcher -->
      <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
        <button
          @click="dashboardTab = 'MAIN'"
          class="px-6 py-2 rounded-lg text-sm font-black transition-all"
          :class="dashboardTab === 'MAIN' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          メイン分析
        </button>
        <button
          @click="dashboardTab = 'REFERRAL'"
          class="px-6 py-2 rounded-lg text-sm font-black transition-all"
          :class="dashboardTab === 'REFERRAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          紹介打診管理
        </button>
      </div>
      
      <!-- Period Selector -->
      <div class="flex flex-wrap items-center gap-4 mb-8">
        <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            @click="periodType = 'monthly'; fetchFunnelKpi()"
            class="px-5 py-1.5 rounded-lg text-sm font-bold transition-all"
            :class="periodType === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            月間
          </button>
          <button
            @click="periodType = 'weekly'; fetchFunnelKpi()"
            class="px-5 py-1.5 rounded-lg text-sm font-bold transition-all"
            :class="periodType === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            週間
          </button>
          <button
            @click="periodType = 'daily'; fetchFunnelKpi()"
            class="px-5 py-1.5 rounded-lg text-sm font-bold transition-all"
            :class="periodType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            日間
          </button>
        </div>

        <!-- Period Logic Control -->
        <div v-if="periodType === 'weekly'" class="flex items-center gap-2">
          <input 
            type="text" 
            v-model="selectedWeekKey" 
            class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 w-32"
            placeholder="2026-W15"
          />
          <button @click="fetchFunnelKpi()" class="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <CheckCircle class="w-4 h-4" />
          </button>
        </div>

        <div v-else-if="periodType === 'daily'" class="flex items-center gap-2">
          <input 
            type="date" 
            v-model="selectedDayKey" 
            class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button @click="fetchFunnelKpi()" class="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <CheckCircle class="w-4 h-4" />
          </button>
        </div>

        <div v-else class="flex items-center gap-2">
          <button @click="prevMonth(); fetchFunnelKpi()" class="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">←</button>
          <span class="text-sm font-bold text-gray-700 min-w-[100px] text-center">{{ calendarTitle }}</span>
          <button @click="nextMonth(); fetchFunnelKpi()" class="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">→</button>
        </div>
      </div>

      <div v-if="dashboardTab === 'MAIN'">

      <!-- KPI Summary Cards -->
      <div v-if="kpiOverviewData" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <!-- Sales Card -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 relative z-10">売上 (Actual/Goal)</p>
          <h3 class="text-2xl font-black text-gray-900 relative z-10">
            ¥{{ (kpiOverviewData[periodType]?.sales?.actual || 0).toLocaleString() }}
          </h3>
          <div class="mt-4 flex items-end justify-between relative z-10">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Target</span>
              <span class="text-sm font-bold text-gray-600">¥{{ (kpiOverviewData[periodType]?.sales?.target || 0).toLocaleString() }}</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black" :class="(kpiOverviewData[periodType]?.sales?.rate || 0) >= 100 ? 'text-emerald-600' : 'text-blue-600'">
                {{ (kpiOverviewData[periodType]?.sales?.rate || 0).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
            <div 
              class="h-full bg-blue-600 rounded-full transition-all duration-1000" 
              :style="{ width: Math.min(kpiOverviewData[periodType]?.sales?.rate || 0, 100) + '%' }"
            ></div>
          </div>
        </div>

        <!-- Seats Card -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 relative z-10">着座数 (Seats)</p>
          <h3 class="text-2xl font-black text-gray-900 relative z-10">
            {{ (kpiOverviewData[periodType]?.seats?.actual || 0) }}名
          </h3>
          <div class="mt-4 flex items-end justify-between relative z-10">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Target</span>
              <span class="text-sm font-bold text-gray-600">{{ (kpiOverviewData[periodType]?.seats?.target || 0) }}名</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black" :class="(kpiOverviewData[periodType]?.seats?.rate || 0) >= 100 ? 'text-emerald-600' : 'text-purple-600'">
                {{ (kpiOverviewData[periodType]?.seats?.rate || 0).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
            <div 
              class="h-full bg-purple-600 rounded-full transition-all duration-1000" 
              :style="{ width: Math.min(kpiOverviewData[periodType]?.seats?.rate || 0, 100) + '%' }"
            ></div>
          </div>
        </div>

        <!-- Entries Card -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 relative z-10">エントリー (Entries)</p>
          <h3 class="text-2xl font-black text-gray-900 relative z-10">
            {{ (kpiOverviewData[periodType]?.entries?.actual || 0) }}件
          </h3>
          <div class="mt-4 flex items-end justify-between relative z-10">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Target</span>
              <span class="text-sm font-bold text-gray-600">{{ (kpiOverviewData[periodType]?.entries?.target || 0) }}件</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black" :class="(kpiOverviewData[periodType]?.entries?.rate || 0) >= 100 ? 'text-emerald-600' : 'text-indigo-600'">
                {{ (kpiOverviewData[periodType]?.entries?.rate || 0).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
            <div 
              class="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
              :style="{ width: Math.min(kpiOverviewData[periodType]?.entries?.rate || 0, 100) + '%' }"
            ></div>
          </div>
        </div>

        <!-- Interviews Card -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 relative z-10">面談実施 (Interviews)</p>
          <h3 class="text-2xl font-black text-gray-900 relative z-10">
            {{ (kpiOverviewData[periodType]?.interviews?.actual || 0) }}件
          </h3>
          <div class="mt-4 flex items-end justify-between relative z-10">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Target</span>
              <span class="text-sm font-bold text-gray-600">{{ (kpiOverviewData[periodType]?.interviews?.target || 0) }}件</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black" :class="(kpiOverviewData[periodType]?.interviews?.rate || 0) >= 100 ? 'text-emerald-600' : 'text-emerald-600'">
                {{ (kpiOverviewData[periodType]?.interviews?.rate || 0).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
            <div 
              class="h-full bg-emerald-600 rounded-full transition-all duration-1000" 
              :style="{ width: Math.min(kpiOverviewData[periodType]?.interviews?.rate || 0, 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- KGI Daily Progress Widget -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <h2 class="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          デイリーKGI進捗
        </h2>
        <div class="overflow-x-auto scroll-smooth">
          <table class="w-full text-sm min-w-[1000px]">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr>
                <th class="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">案件名</th>
                <th class="px-3 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">締日</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">残日数</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-blue-600 uppercase tracking-wider">目標着座</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-blue-400 uppercase tracking-wider">現着座</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider">目標エントリー</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-indigo-400 uppercase tracking-wider">現エントリー</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">残り必要エントリー数</th>
                <th class="px-3 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">デイリー必要面談数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template v-for="row in activeKgiProgress" :key="`kgi-${row.event_id}`">
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-4 text-slate-900 font-bold max-w-[200px] truncate" :title="row.event_title">{{ row.event_title }}</td>
                  <td class="px-3 py-4 text-center text-slate-600 whitespace-nowrap">
                    <span :class="row.days_remaining <= 0 ? 'text-slate-300' : ''">
                      {{ row.deadline ? new Date(row.deadline).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-' }}
                    </span>
                  </td>
                  <td class="px-3 py-4 text-right whitespace-nowrap">
                    <span :class="row.days_remaining <= 0 ? 'text-slate-300' : 'font-black text-slate-700'">{{ row.deadline ? row.days_remaining : '-' }}</span>
                  </td>
                  <td class="px-3 py-4 text-right text-indigo-700/60 font-bold italic">{{ row.target_seats || '-' }}</td>
                  <td class="px-3 py-4 text-right text-indigo-400/60 font-bold italic">{{ row.current_seats }}</td>
                  <td class="px-3 py-4 text-right text-indigo-700 font-black">{{ row.kpi_target_entry || '-' }}</td>
                  <td class="px-3 py-4 text-right text-indigo-400 font-black">{{ row.current_entry }}</td>
                  <td class="px-3 py-4 text-right font-black whitespace-nowrap" :class="{
                    'text-emerald-600': row.remaining_entry === 0,
                    'text-amber-600': row.remaining_entry > 0 && row.remaining_entry <= 3,
                    'text-rose-600': row.remaining_entry > 3
                  }">
                    {{ row.remaining_entry === 0 ? '達成' : row.remaining_entry }}
                  </td>
                  <td class="px-3 py-4 text-right whitespace-nowrap">
                    <span
                      class="font-black"
                      :class="{
                        'text-slate-300': row.daily_required_interview === null,
                        'text-emerald-600': row.daily_required_interview !== null && row.daily_required_interview <= 0,
                        'text-amber-600': row.daily_required_interview !== null && row.daily_required_interview > 0 && row.daily_required_interview <= 3,
                        'text-rose-600': row.daily_required_interview !== null && row.daily_required_interview > 3
                      }"
                    >{{ row.daily_required_interview === null ? '締切済' : row.daily_required_interview }}</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>


      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
            案件別ヨミ表 (A/B/C)
          </h2>
            <div v-if="selectedYomiEvent" class="flex flex-wrap gap-4 text-xs font-bold text-slate-500 mb-2 md:mb-0">
              <span class="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                出席：{{ attendedCount }}名
              </span>
              <span class="flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-1 rounded-lg border border-rose-100">
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                欠席：{{ xaCount }}名
              </span>
            </div>
            <button 
              @click="openMonthlyAttendanceModal"
              class="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-base md:text-sm min-h-[44px] font-black hover:bg-emerald-100 transition-all flex items-center gap-2 w-fit"
            >
              {{ calendarBaseMonth.getMonth() + 1 }}月の参加: {{ monthlyAttendanceCount }}名
              <ArrowRight class="w-4 h-4" />
            </button>
          <span class="text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full w-fit">開催予定: {{ upcomingEvents }}件</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="row in eventYomiRows" :key="row.id" class="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 transition-all hover:shadow-lg hover:border-blue-200 hover:bg-white group">
            <h3 class="font-black text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[3rem] text-lg mb-4">
              {{ row.title }}
            </h3>
            <div class="flex items-center gap-2 mb-6">
              <span class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 shadow-sm uppercase tracking-tighter">
                📅 {{ row.event_date ? new Date(row.event_date).toLocaleDateString('ja-JP') : '-' }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-6">
              <div class="bg-blue-600 rounded-2xl p-3 text-white shadow-md shadow-blue-100">
                <p class="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">A:Entry</p>
                <p class="text-2xl font-black">{{ row.a }}</p>
              </div>
              <div class="bg-amber-500 rounded-2xl p-3 text-white shadow-md shadow-amber-100">
                <p class="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">B:Wait</p>
                <p class="text-2xl font-black">{{ row.b }}</p>
              </div>
              <div class="bg-purple-500 rounded-2xl p-3 text-white shadow-md shadow-purple-100">
                <p class="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">C:Wait</p>
                <p class="text-2xl font-black">{{ row.c }}</p>
              </div>
              <div class="bg-slate-900 rounded-2xl p-3 text-white shadow-md shadow-slate-200">
                <p class="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">Total</p>
                <p class="text-2xl font-black">{{ row.total }}</p>
              </div>
            </div>
            <button @click="openYomiEventDetail(row.id)" class="w-full py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">
              参加数・売上詳細を管理
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-900 mb-4">月間ヨミ表</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">開催日</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">案件名</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-blue-700 uppercase">A</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-amber-700 uppercase">B</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-purple-700 uppercase">C</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-red-700 uppercase">XA</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="row in monthlyYomiByEvent" :key="`monthly-yomi-${row.id}`" class="hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-600">{{ row.heldDate }}</td>
                <td class="px-3 py-2 text-gray-900">{{ row.title }}</td>
                <td class="px-3 py-2 text-right text-blue-700 font-semibold">{{ row.a }}</td>
                <td class="px-3 py-2 text-right text-amber-700 font-semibold">{{ row.b }}</td>
                <td class="px-3 py-2 text-right text-purple-700 font-semibold">{{ row.c }}</td>
                <td class="px-3 py-2 text-right text-red-700 font-semibold">{{ row.xa }}</td>
                <td class="px-3 py-2 text-right text-gray-900 font-semibold">{{ row.total }}</td>
              </tr>
              <tr v-if="monthlyYomiByEvent.length === 0">
                <td colSpan="7" class="px-3 py-8 text-center text-gray-400">対象月の案件データはありません。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="false" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <h2 class="text-lg font-bold text-gray-900">日別設定/面談カレンダー</h2>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="prevMonth">前月</button>
            <p class="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{{ calendarTitle }}</p>
            <button class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="nextMonth">次月</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">設定数（面談決定）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.settings_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">面談数（初回面談）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.first_interviews_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">面談数（2回目面談）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.second_interviews_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">設定→初回面談 リードタイム平均</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.setting_to_first_interview_lead_time_days_avg ?? '-' }}<span class="text-sm text-gray-500">日</span></p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 p-3 mb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-800">{{ calendarTitle }} の面談数</p>
            <p class="text-sm font-bold text-emerald-700">合計: {{ monthlyInterviewTotal }}件</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">流入経路</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目面談</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="row in monthlyInterviewBySource" :key="`monthly-int-${row.source_company}`" class="hover:bg-gray-50">
                  <td class="px-3 py-2 text-gray-900">{{ row.source_company }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.first }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.second }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.total }}</td>
                </tr>
                <tr v-if="monthlyInterviewBySource.length === 0">
                  <td colSpan="4" class="px-3 py-6 text-center text-gray-400">対象月の面談データはありません。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden text-xs">
          <div v-for="w in weekdays" :key="`weekday-${w}`" class="px-2 py-2 bg-gray-50 border-b border-gray-200 text-center font-semibold text-gray-500">
            {{ w }}
          </div>
          <div
            v-for="cell in calendarCells"
            :key="cell.key"
            class="min-h-[88px] border-r border-b border-gray-200 p-2"
            :class="{ 'bg-gray-50': !cell.date }"
          >
            <p v-if="cell.day" class="text-gray-700 font-semibold mb-1">{{ cell.day }}</p>
            <template v-if="cell.date">
              <p class="text-[11px] text-indigo-700">申込: {{ applicationCountByDate[cell.date!] || 0 }}</p>
              <p class="text-[11px] text-blue-700">設定: {{ settingCountByDate[cell.date!] || 0 }}</p>
              <p class="text-[11px] text-emerald-700">面談: {{ interviewCountByDate[cell.date!] || 0 }}</p>
            </template>
          </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="selectedYomiEvent" class="fixed inset-0 z-[100]">
        <div class="absolute inset-0 bg-black/30" @click="closeYomiEventDetail"></div>
        <div class="absolute right-0 top-0 h-full w-full md:w-[90vw] md:max-w-6xl bg-white shadow-2xl border-l border-gray-200 p-4 md:p-6 overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900">案件参加詳細</h2>
            <p class="text-sm text-gray-500">{{ selectedYomiEvent.title }}</p>
          </div>
          <button class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" @click="closeYomiEventDetail">閉じる</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <div v-for="section in yomiSections" :key="`sum-${section.key}`" class="text-left px-3 py-2 rounded-lg border text-xs" :class="section.accent">
            <p class="font-semibold">{{ section.label }}</p>
            <p>{{ yomiCounts[section.key] }}名 / {{ yomiAmounts[section.key].toLocaleString() }}円</p>
          </div>
        </div>
        <div v-if="yomiLoading" class="text-center text-gray-400 py-10">読み込み中...</div>
        <div v-else class="space-y-2">
          <div v-for="section in yomiSections" :key="section.key" class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 text-sm font-semibold border-b border-gray-200" :class="section.accent">
              {{ section.label }}（{{ yomiCounts[section.key] }}名）
            </div>
            <div
              @dragover.prevent="dragOverZone = section.key"
              @dragleave="dragOverZone = null"
              @drop="onDrop($event, section.key)"
              class="max-h-72 overflow-y-auto p-3 transition-colors"
              :class="{
                'bg-blue-100 ring-2 ring-blue-400': dragOverZone === 'A' && section.key === 'A',
                'bg-amber-100 ring-2 ring-amber-400': dragOverZone === 'B' && section.key === 'B',
                'bg-purple-100 ring-2 ring-purple-400': dragOverZone === 'C' && section.key === 'C',
                'bg-red-100 ring-2 ring-red-400': dragOverZone === 'XA' && section.key === 'XA'
              }"
            >
              <div class="grid grid-cols-1 gap-2">
                  <div
                    v-for="p in yomiGroups[section.key]"
                    :key="`${section.key}-${p.student_event_id || p.student_id}`"
                    :draggable="true"
                    @dragstart="onDragStart($event, p)"
                    @dragend="onDragEnd"
                    class="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-grab active:cursor-grabbing select-none w-full hover:bg-gray-50 transition-colors"
                    :class="{ 'opacity-40': draggingParticipant?.student_event_id === p.student_event_id }"
                  >
                    <div class="flex flex-col w-24 shrink-0">
                      <span class="text-sm font-bold text-gray-900 truncate">
                        {{ p.name }}
                      </span>
                      <span v-if="p.graduation_year" :class="['text-[9px] font-black px-1 rounded inline-block w-fit mt-0.5', 
                        p.graduation_year === 2027 ? 'bg-blue-100 text-blue-700' : 
                        p.graduation_year === 2028 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500']">
                        {{ p.graduation_year % 100 }}卒
                      </span>
                    </div>
                    <!-- 大学 -->
                    <span class="text-xs text-gray-700 w-28 shrink-0 truncate">
                      {{ p.university || '-' }}
                    </span>
                    <!-- 担当者 -->
                    <span class="text-xs text-gray-700 w-14 shrink-0 truncate">
                      {{ p.staff_name || '-' }}
                    </span>
                    <!-- エントリー日 -->
                    <span class="text-xs text-gray-600 w-16 shrink-0">
                      {{ formatDateKey(p.created_at) }}
                    </span>
                    <!-- 参加日程 -->
                    <span class="text-xs text-gray-600 w-16 shrink-0">
                      {{ p.selected_event_date ? formatDateKey(p.selected_event_date) : '-' }}
                    </span>
                    <!-- 次回タスク履行日 -->
                    <span class="text-xs text-gray-600 w-16 shrink-0">
                      {{ p.next_task_date ? formatDateKey(p.next_task_date) : '-' }}
                    </span>
                    <!-- タスク内容 -->
                    <span class="text-xs text-gray-500 flex-1 truncate">
                      {{ p.next_task_content || '-' }}
                    </span>
                    
                    <!-- 操作メニュー -->
                    <div class="relative shrink-0">
                      <button
                        @click.stop="toggleActionMenu(p)"
                        class="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                      >
                        ⋯
                      </button>

                      <!-- ドロップダウンメニュー -->
                      <div
                        v-if="actionMenuTarget?.student_event_id === p.student_event_id"
                        class="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px]"
                      >
                        <button
                          @click.stop="markAttended(p); actionMenuTarget = null"
                          class="w-full text-left px-4 py-2 text-xs text-green-700 hover:bg-green-50"
                        >
                          ✓ 出席
                        </button>
                        <button
                          @click.stop="markNoShow(p); actionMenuTarget = null"
                          class="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50"
                        >
                          ✗ 不参加
                        </button>
                        <button
                          @click.stop="markReschedule(p); actionMenuTarget = null"
                          class="w-full text-left px-4 py-2 text-xs text-amber-700 hover:bg-amber-50"
                        >
                          ↺ リスケ
                        </button>
                      </div>
                    </div>
                  </div>
                <div v-if="yomiGroups[section.key].length === 0" class="py-6 text-center text-gray-400 text-xs">
                  該当学生はいません。
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</Teleport>

      <!-- 初回ファネル登録セクション -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              初回ファネル登録
            </h2>
            <p class="text-sm text-gray-500 mt-1 uppercase tracking-wider opacity-60">Initial application to first interview progress</p>
          </div>
        </div>

        <!-- 卒業年度フィルタ -->
        <div v-if="availableGraduationYears.length > 0" class="flex items-center gap-2 mb-6 bg-gray-50/50 p-2 rounded-xl border border-gray-100 w-fit">
          <button
            @click="selectedGraduationYear = null"
            class="px-5 py-1.5 rounded-lg text-sm font-black transition-all"
            :class="selectedGraduationYear === null 
              ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'"
          >
            全体
          </button>
          <template v-for="year in availableGraduationYears" :key="year">
            <button
              @click="selectedGraduationYear = year"
              class="px-5 py-1.5 rounded-lg text-sm font-black transition-all"
              :class="selectedGraduationYear === year 
                ? (year === 2027 ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : (year === 2028 ? 'bg-rose-600 text-white shadow-md shadow-rose-100' : 'bg-emerald-600 text-white shadow-md shadow-emerald-100'))
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'"
            >
              {{ year }}年卒
            </button>
          </template>
        </div>

        <!-- 27卒 vs 28卒 流入割合 Indicator -->
        <div v-if="selectedGraduationYear === null && funnelKpi.counts.applications_students > 0" class="mb-8 flex items-center gap-4">
          <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
            <div 
              class="h-full bg-blue-500 transition-all duration-500" 
              :style="{ width: `${(grad27Counts.applications / funnelKpi.counts.applications_students) * 100}%` }"
              title="27卒"
            ></div>
            <div 
              class="h-full bg-rose-400 transition-all duration-500" 
              :style="{ width: `${(grad28Counts.applications / funnelKpi.counts.applications_students) * 100}%` }"
              title="28卒"
            ></div>
          </div>
          <div class="flex gap-4 text-xs font-black">
            <span class="flex items-center gap-1.5 text-blue-600">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              27卒: {{ ((grad27Counts.applications / funnelKpi.counts.applications_students) * 100).toFixed(1) }}%
            </span>
            <span class="flex items-center gap-1.5 text-rose-600">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              28卒: {{ ((grad28Counts.applications / funnelKpi.counts.applications_students) * 100).toFixed(1) }}%
            </span>
          </div>
        </div>

        <!-- 可視化ステップ -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6 relative mt-8">
          <!-- Step 1: 初回申し込み -->
          <div :class="['flex-1 w-full flex flex-col items-center rounded-2xl p-6 border transition-all hover:shadow-lg', funnelTheme.bg, funnelTheme.border]">
            <span class="text-4xl mb-3">📩</span>
            <p :class="['text-sm font-bold mb-1 uppercase tracking-wider', funnelTheme.pill.split(' ')[0]]">初回申し込み</p>
            <p :class="['text-3xl font-black', funnelTheme.text]">{{ funnelKpi.counts.applications_students || 0 }}<span class="text-sm ml-1 font-bold">名</span></p>
            <div v-if="selectedGraduationYear === null" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.applications }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.applications }}</span>
            </div>
          </div>

          <!-- Arrow & Rate 1 -->
          <div class="flex flex-col items-center justify-center py-2 sm:py-0">
            <div class="sm:hidden text-2xl text-gray-300">↓</div>
            <ArrowRight class="hidden sm:block w-8 h-8 text-gray-300" />
            <div class="mt-2 bg-white border border-gray-100 px-4 py-1.5 rounded-full shadow-sm">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center">申込→予約率</p>
              <p :class="['text-base font-black text-center', funnelTheme.text]">{{ funnelKpi.applicationToReservationRate.toFixed(1) }}%</p>
            </div>
          </div>

          <!-- Step 2: 面談予約 -->
          <div :class="['flex-1 w-full flex flex-col items-center rounded-2xl p-6 border transition-all hover:shadow-lg', funnelTheme.bg, funnelTheme.border]">
            <span class="text-4xl mb-3">📅</span>
            <p :class="['text-sm font-bold mb-1 uppercase tracking-wider', funnelTheme.pill.split(' ')[0]]">面談予約</p>
            <p :class="['text-3xl font-black', funnelTheme.text]">{{ funnelKpi.counts.reserved_students || 0 }}<span class="text-sm ml-1 font-bold">名</span></p>
            <div v-if="selectedGraduationYear === null" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.reservations }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.reservations }}</span>
            </div>
          </div>

          <!-- Arrow & Rate 2 -->
          <div class="flex flex-col items-center justify-center py-2 sm:py-0">
            <div class="sm:hidden text-2xl text-gray-300">↓</div>
            <ArrowRight class="hidden sm:block w-8 h-8 text-gray-300" />
            <div class="mt-2 bg-white border border-gray-100 px-4 py-1.5 rounded-full shadow-sm">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center">予約→面談率</p>
              <p :class="['text-base font-black text-center', funnelTheme.text]">{{ reservationToInterviewRate }}%</p>
            </div>
          </div>

          <!-- Step 3: 初回面談実施 -->
          <div :class="['flex-1 w-full flex flex-col items-center rounded-2xl p-6 border transition-all hover:shadow-lg', funnelTheme.bg, funnelTheme.border]">
            <span class="text-4xl mb-3">🤝</span>
            <p :class="['text-sm font-bold mb-1 uppercase tracking-wider', funnelTheme.pill.split(' ')[0]]">初回面談実施</p>
            <p :class="['text-3xl font-black', funnelTheme.text]">{{ funnelKpi.counts.interviewed_students || 0 }}<span class="text-sm ml-1 font-bold">名</span></p>
            <div v-if="selectedGraduationYear === null" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.interviews }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.interviews }}</span>
            </div>
          </div>
        </div>

        <!-- リードタイム指標 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div :class="['rounded-2xl p-5 border flex items-center justify-between', funnelTheme.bg, funnelTheme.border]">
            <div>
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">申込 → 予約 リードタイム</p>
              <p class="text-2xl font-black text-gray-900">{{ funnelKpi.apply_to_reservation_lead_time_days_avg ?? '-' }}<span class="text-sm ml-1 text-gray-500">日</span></p>
            </div>
            <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-xl">⏳</div>
          </div>
          <div :class="['rounded-2xl p-5 border flex items-center justify-between', funnelTheme.bg, funnelTheme.border]">
            <div>
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">予約 → 面談 リードタイム</p>
              <p class="text-2xl font-black text-gray-900">{{ funnelKpi.reservation_to_interview_lead_time_days_avg ?? '-' }}<span class="text-sm ml-1 text-gray-500">日</span></p>
            </div>
            <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-xl">⏱️</div>
          </div>
        </div>
      </div>

  </div>

  <div v-else class="space-y-8">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-yellow-400 rounded-full"></span>
            会員学生への紹介打診
          </h2>
          <p class="text-sm text-gray-500 mt-1">信頼関係のある学生（お気に入り登録済み）を中心に紹介を依頼しましょう。</p>
        </div>
      </div>

      <!-- Referral KPI Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center justify-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">紹介打診対象</p>
          <p class="text-2xl font-black text-slate-900">{{ referralStats.targetCount }}<span class="text-xs ml-0.5 font-bold">名</span></p>
        </div>
        <div class="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 flex flex-col items-center justify-center">
          <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">声かけ見込み数</p>
          <p class="text-2xl font-black text-blue-600">{{ referralStats.expectedReach }}<span class="text-xs ml-0.5 font-bold">名</span></p>
        </div>
        <div class="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/50 flex flex-col items-center justify-center">
          <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">紹介見込み数</p>
          <p class="text-2xl font-black text-indigo-600">{{ referralStats.expectedReferrals }}<span class="text-xs ml-0.5 font-bold">名</span></p>
        </div>
        <div class="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100/50 flex flex-col items-center justify-center">
          <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">紹介実績数</p>
          <p class="text-2xl font-black text-emerald-600">{{ referralStats.actualReferrals }}<span class="text-xs ml-0.5 font-bold">名</span></p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-100">
            <tr>
              <th class="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">学生名</th>
              <th class="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">大学 / 卒年</th>
              <th class="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">担当者</th>
              <th class="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">打診ステータス</th>
              <th class="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">声かけ見込み</th>
              <th class="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">紹介見込み</th>
              <th class="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider text-green-600">紹介実績</th>
              <th class="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="s in students.filter(s => s.is_favorite)" :key="`referral-row-${s.id}`" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-4 py-4 font-black text-slate-900">{{ s.name }}</td>
              <td class="px-4 py-4 text-slate-500 font-medium">
                {{ s.university || '-' }} / {{ s.graduation_year ? s.graduation_year + '卒' : '-' }}
              </td>
              <td class="px-4 py-4 text-slate-600 text-xs font-bold">
                {{ s.staff_name || '-' }}
              </td>
              <td class="px-4 py-4">
                <select
                  class="px-3 py-1.5 bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                  :value="s.referral_outreach_status || 'unapproached'"
                  @change="updateReferralOutreachStatus(s.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="unapproached">未実施</option>
                  <option value="approached">打診中</option>
                  <option value="completed">打診完了</option>
                  <option value="received">紹介発生</option>
                  <option value="stop">打診停止</option>
                </select>
              </td>
              <td class="px-4 py-4 text-center">
                <input
                  type="number"
                  class="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold focus:ring-1 focus:ring-blue-400 outline-none"
                  :value="s.referral_expected_reach_count || 0"
                  @change="updateReferralCounts(s.id, 'referral_expected_reach_count', Number(($event.target as HTMLInputElement).value))"
                  min="0"
                />
              </td>
              <td class="px-4 py-4 text-center">
                <input
                  type="number"
                  class="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold focus:ring-1 focus:ring-indigo-400 outline-none"
                  :value="s.referral_expected_count || 0"
                  @change="updateReferralCounts(s.id, 'referral_expected_count', Number(($event.target as HTMLInputElement).value))"
                  min="0"
                />
              </td>
              <td class="px-4 py-4 text-center">
                <span v-if="s.referral_count && s.referral_count > 0" class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm">
                  {{ s.referral_count }}人
                </span>
                <span v-else class="text-slate-300 font-bold">-</span>
              </td>
              <td class="px-4 py-4 text-right">
                <button @click="$router.push(`/students/${s.id}`)" class="text-blue-600 font-bold text-xs hover:underline">
                  詳細を確認
                </button>
              </td>
            </tr>
            <tr v-if="students.filter(s => s.is_favorite).length === 0">
              <td colspan="5" class="px-4 py-12 text-center text-slate-400">
                <p class="font-bold mb-2">お気に入り登録されている学生がいません</p>
                <p class="text-xs">紹介打診を行うには、まず学生一覧でお気に入り（⭐️マーク）を付けてください。</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

    <!-- Monthly Attendance Modal -->
    <div v-if="showMonthlyAttendanceModal" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/30" @click="closeMonthlyAttendanceModal"></div>
      <div class="absolute right-0 top-0 h-full w-full md:w-[80vw] md:max-w-5xl bg-white shadow-2xl border-l border-gray-200 p-4 md:p-6 overflow-y-auto flex flex-col">
        <div class="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ calendarBaseMonth.getMonth() + 1 }}月の全案件参加者一覧</h2>
            <p class="text-sm text-gray-500 mt-1">対象月のすべての案件参加者（合計: {{ filteredMonthlyParticipants.length }}名）</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="exportMonthlyParticipantsCsv"
              class="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSVダウンロード
            </button>
            <button class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" @click="closeMonthlyAttendanceModal">閉じる</button>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto w-full">
          <div v-if="yomiLoading" class="text-center text-gray-400 py-20">参加データを集計中...</div>
          <div v-else class="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
            <div class="overflow-y-auto flex-1 relative">
              <table class="w-full text-sm min-w-[800px]">
                <thead class="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[140px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('event_title')"
                      >
                        案件名
                        <span v-if="monthlySortField === 'event_title' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'event_title' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <select v-model="monthlyFilters.event_title" class="w-full px-1 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal bg-white">
                        <option value="">すべて</option>
                        <option v-for="title in uniqueEventTitles" :key="title" :value="title">{{ title }}</option>
                      </select>
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[100px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('name')"
                      >
                        学生名
                        <span v-if="monthlySortField === 'name' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'name' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <input v-model="monthlyFilters.name" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[120px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('university')"
                      >
                        大学
                        <span v-if="monthlySortField === 'university' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'university' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <input v-model="monthlyFilters.university" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('staff_name')"
                      >
                        担当
                        <span v-if="monthlySortField === 'staff_name' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'staff_name' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <select v-model="monthlyFilters.staff_name" class="w-full px-1 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal bg-white">
                        <option value="">すべて</option>
                        <option v-for="staff in uniqueStaffNames" :key="staff" :value="staff">{{ staff }}</option>
                      </select>
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('created_at')"
                      >
                        申込日
                        <span v-if="monthlySortField === 'created_at' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'created_at' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <input v-model="monthlyFilters.created_at" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <button
                        class="uppercase flex items-center gap-0.5 hover:text-gray-900 mb-1"
                        @click="toggleSort('selected_event_date')"
                      >
                        参加日程
                        <span v-if="monthlySortField === 'selected_event_date' && monthlySortOrder === 'asc'">▲</span>
                        <span v-else-if="monthlySortField === 'selected_event_date' && monthlySortOrder === 'desc'">▼</span>
                        <span v-else class="opacity-30">▲</span>
                      </button>
                      <input v-model="monthlyFilters.selected_event_date" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[100px]">
                      <div class="mb-1 flex items-center justify-center gap-1">
                        <button
                          class="uppercase flex items-center gap-0.5 hover:text-gray-900"
                          @click="toggleSort('status')"
                        >
                          ステータス
                          <span v-if="monthlySortField === 'status' && monthlySortOrder === 'asc'">▲</span>
                          <span v-else-if="monthlySortField === 'status' && monthlySortOrder === 'desc'">▼</span>
                          <span v-else class="opacity-30">▲</span>
                        </button>
                      </div>
                      <select v-model="monthlyFilters.status" class="w-full px-1 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal bg-white">
                        <option value="">すべて</option>
                        <option v-for="(label, key) in {A: 'A:エントリー', B: 'B:回答待ち', C: 'C:回答待ち', XA: 'XA:キャンセル'}" :key="key" :value="key">{{ label }}</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="p in filteredMonthlyParticipants" :key="`mo-part-${p.student_event_id || p.student_id}`" class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 text-gray-900 text-xs truncate max-w-[200px]" :title="p.event_title">{{ p.event_title }}</td>
                    <td class="px-3 py-2.5 font-bold text-gray-900">{{ p.name }}</td>
                    <td class="px-3 py-2.5 text-gray-700 text-xs">{{ p.university || '-' }}</td>
                    <td class="px-3 py-2.5 text-gray-700 text-xs">{{ p.staff_name || '-' }}</td>
                    <td class="px-3 py-2.5 text-gray-600 font-medium whitespace-nowrap">{{ formatDateKey(p.created_at) }}</td>
                    <td class="px-3 py-2.5 text-gray-900 font-bold whitespace-nowrap">{{ formatDateKey(p.selected_event_date || p.single_event_date) }}</td>
                    <td class="px-3 py-2.5 text-center whitespace-nowrap">
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm" :class="yomiStatusClass(p.status)">
                        {{ yomiStatusLabel(p.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="filteredMonthlyParticipants.length === 0">
                    <td colSpan="7" class="px-3 py-16 text-center text-gray-400">参加者データがありません。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="rescheduleModalOpen"
        class="fixed inset-0 z-[300] flex items-center justify-center bg-black/40"
        @click.self="rescheduleModalOpen = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
          <h3 class="text-base font-bold text-gray-900 mb-1">日程を変更する</h3>
          <p class="text-xs text-gray-500 mb-4">{{ rescheduleTarget?.name }}</p>

          <div class="mb-6">
            <p class="text-xs text-gray-500 mb-2">新しい参加日程を選択</p>
            <select
              v-model="rescheduleSelectedDate"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">日程を選択してください</option>
              <option
                v-for="slot in (selectedYomiEvent?.event_slots || [])"
                :key="`reschedule-${slot.datetime}`"
                :value="slot.datetime"
              >
                {{ formatEventSlot(slot.datetime, slot.location) }}
              </option>
            </select>
          </div>

          <div class="flex gap-2">
            <button
              @click="rescheduleModalOpen = false"
              class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >キャンセル</button>
            <button
              @click="confirmReschedule"
              :disabled="!rescheduleSelectedDate"
              class="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40"
            >リスケ確定</button>
        </div>
      </div>
    </div>
  </Teleport>
</Layout>
</template>
