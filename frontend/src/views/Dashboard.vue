<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { ArrowRight, CheckCircle } from 'lucide-vue-next';

interface Student {
  id: number;
  name: string;
  status?: string;
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
const events = ref<EventItem[]>([]);
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');
const selectedYomiEvent = ref<EventItem | null>(null);
const yomiParticipants = ref<EventParticipant[]>([]);
const yomiLoading = ref(false);

const rescheduleModalOpen = ref(false);
const rescheduleTarget = ref<EventParticipant | null>(null);
const rescheduleSelectedDate = ref('');
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
const monthlySortField = ref<'status' | null>(null);
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
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  applicationToReservationRate: 0,
  reservationToInterviewRate: 0,
  interviewToProposalRate: 0,
  proposalToJoinRate: 0,
  lostReasonRanking: [] as Array<{ reason_name: string; count: number }>
});

const kgiProgress = ref<KgiProgress[]>([]);

const fetchKgiProgress = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/events/kgi-progress', { headers: { Authorization: token } });
  kgiProgress.value = Array.isArray(res.data) ? res.data : [];
};

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const [studentRes, eventRes] = await Promise.all([
      api.get('/api/students', { headers: { Authorization: token } }),
      api.get('/api/events', { headers: { Authorization: token } })
    ]);
    students.value = studentRes.data;
    events.value = eventRes.data;
    fetchInterviewMetrics().catch((err) => console.error(err));
    fetchFunnelKpi().catch((err) => console.error(err));
    fetchKgiProgress().catch((err) => console.error(err));
  } catch (err) {
    console.error(err);
  }
};


const fetchFunnelKpi = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/metrics/funnel', { headers: { Authorization: token } });
  funnelKpi.value = {
    daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
    applicationToReservationRate: Number(res.data?.application_to_reservation_rate || 0),
    reservationToInterviewRate: Number(res.data?.reservation_to_interview_rate || 0),
    interviewToProposalRate: Number(res.data?.interview_to_proposal_rate || 0),
    proposalToJoinRate: Number(res.data?.proposal_to_join_rate || 0),
    lostReasonRanking: Array.isArray(res.data?.lost_reason_ranking) ? res.data.lost_reason_ranking : []
  };
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

const eventYomiRows = computed(() =>
  [...events.value]
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
    const res = await api.get(`/api/events/${eventId}`, { headers: { Authorization: token } });
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
    const monthEvents = events.value.filter(e => String(e.event_date || '').slice(0, 7) === month);
    
    // Fetch participants for each event
    const participantPromises = monthEvents.map(e => {
      // Determine single event date
      let singleDate: string | null = null;
      if (Array.isArray(e.event_dates) && e.event_dates.length === 1) {
        singleDate = e.event_dates[0] || null;
      } else if (!Array.isArray(e.event_dates) && e.event_date) {
        singleDate = e.event_date;
      }
      
      return api.get(`/api/events/${e.id}`, { headers: { Authorization: token } })
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
    await api.put(
      `/api/events/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
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
    await api.put(
      `/api/events/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
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
    await api.put(
      `/api/events/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
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
        `/api/events/${selectedYomiEvent.value.id}/participants/${studentEventId}`,
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
      `/api/events/${eventId}/participants/${studentEventId}`,
      { status },
      { headers: { Authorization: token } }
    );
    await openYomiEventDetail(eventId);
    await fetchData();
  } catch (err) {
    console.error(err);
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

const monthlyAttendanceCount = computed(() =>
  monthlyYomiByEvent.value.reduce((sum, row) => sum + Number(row.total || 0), 0)
);

const exportMonthlyParticipantsCsv = () => {
  const headers = ['イベント名', '学生名', '大学', '担当', '申込日', '参加日程', 'ステータス'];
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
    const aOrder = STATUS_ORDER_MAP[a.status] ?? 99;
    const bOrder = STATUS_ORDER_MAP[b.status] ?? 99;
    return monthlySortOrder.value === 'asc' ? aOrder - bOrder : bOrder - aOrder;
  });
});

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

onMounted(() => {
  fetchData();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});
watch(sourceCompanyFilter, fetchInterviewMetrics);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-black text-gray-900 tracking-tight">ダッシュボード</h1>
        <p class="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider opacity-60">Latest performance & metrics</p>
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
                <th class="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">イベント名</th>
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
              <template v-for="row in kgiProgress" :key="`kgi-${row.event_id}`">
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
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 relative">
          <div class="flex flex-col md:flex-row md:items-center gap-4">
            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span class="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
              イベント別ヨミ表 (A/B/C)
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
          </div>
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
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">イベント名</th>
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
                <td colSpan="7" class="px-3 py-8 text-center text-gray-400">対象月のイベントデータはありません。</td>
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

    </div>

    <div v-if="selectedYomiEvent" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/30" @click="closeYomiEventDetail" />
      <div class="absolute right-0 top-0 h-full w-full md:w-[80vw] md:max-w-5xl bg-white shadow-2xl border-l border-gray-200 p-4 md:p-6 overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900">イベント参加詳細</h2>
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
                    <!-- 名前 -->
                    <span class="text-sm font-bold text-gray-900 w-24 shrink-0 truncate">
                      {{ p.name }}
                    </span>
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
                    <!-- 次回タスク履行日 -->
                    <span class="text-xs text-gray-600 w-16 shrink-0">
                      {{ p.next_task_date ? formatDateKey(p.next_task_date) : '-' }}
                    </span>
                    <!-- タスク内容 -->
                    <span class="text-xs text-gray-500 flex-1 truncate">
                      {{ p.next_task_content || '-' }}
                    </span>
                    
                    <!-- 操作ボタン -->
                    <div class="flex gap-1 shrink-0">
                      <!-- 出席 -->
                      <button
                        @click.stop="markAttended(p)"
                        class="text-xs px-2 py-1 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 whitespace-nowrap flex items-center gap-1"
                        title="出席済みにする"
                      >
                        ✓ 出席
                      </button>

                      <!-- 不参加 -->
                      <button
                        @click.stop="markNoShow(p)"
                        class="text-xs px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 whitespace-nowrap flex items-center gap-1"
                        title="不参加にする"
                      >
                        ✗ 不参加
                      </button>

                      <!-- リスケ -->
                      <button
                        @click.stop="markReschedule(p)"
                        class="text-xs px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 whitespace-nowrap flex items-center gap-1"
                        title="リスケにする"
                      >
                        ↺ リスケ
                      </button>
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

    <!-- Monthly Attendance Modal -->
    <div v-if="showMonthlyAttendanceModal" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/30" @click="closeMonthlyAttendanceModal" />
      <div class="absolute right-0 top-0 h-full w-full md:w-[80vw] md:max-w-5xl bg-white shadow-2xl border-l border-gray-200 p-4 md:p-6 overflow-y-auto flex flex-col">
        <div class="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ calendarBaseMonth.getMonth() + 1 }}月の全イベント参加者一覧</h2>
            <p class="text-sm text-gray-500 mt-1">対象月のすべてのイベント参加者（合計: {{ filteredMonthlyParticipants.length }}名）</p>
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
                      <div class="mb-1 uppercase">イベント名</div>
                      <input v-model="monthlyFilters.event_title" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[100px]">
                      <div class="mb-1 uppercase">学生名</div>
                      <input v-model="monthlyFilters.name" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[120px]">
                      <div class="mb-1 uppercase">大学</div>
                      <input v-model="monthlyFilters.university" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <div class="mb-1 uppercase">担当</div>
                      <input v-model="monthlyFilters.staff_name" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <div class="mb-1 uppercase">申込日</div>
                      <input v-model="monthlyFilters.created_at" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[80px]">
                      <div class="mb-1 uppercase">参加日程</div>
                      <input v-model="monthlyFilters.selected_event_date" type="text" placeholder="絞り込み..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal">
                    </th>
                    <th class="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 bg-gray-50 align-top min-w-[100px]">
                      <div class="mb-1 flex items-center justify-center gap-1">
                        <button
                          class="uppercase flex items-center gap-0.5 hover:text-gray-900"
                          @click="() => { if (monthlySortField === 'status') { if (monthlySortOrder === 'asc') { monthlySortOrder = 'desc'; } else { monthlySortField = null; monthlySortOrder = 'asc'; } } else { monthlySortField = 'status'; monthlySortOrder = 'asc'; } }"
                        >
                          ステータス
                          <span v-if="monthlySortField === 'status' && monthlySortOrder === 'asc'">▲</span>
                          <span v-else-if="monthlySortField === 'status' && monthlySortOrder === 'desc'">▼</span>
                          <span v-else class="opacity-30">▲</span>
                        </button>
                      </div>
                      <select v-model="monthlyFilters.status" class="w-full px-1 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-500 font-normal bg-white">
                        <option value="">すべて</option>
                        <option value="A">A:エントリー</option>
                        <option value="B">B:回答待ち</option>
                        <option value="C">C:回答待ち</option>
                        <option value="XA">XA:キャンセル</option>
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
