<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';

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
}

interface EventParticipant {
  student_id: number;
  status: string;
  created_at: string;
  name: string;
  university?: string;
  staff_name?: string;
}

const students = ref<Student[]>([]);
const events = ref<EventItem[]>([]);
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');
const selectedYomiEvent = ref<EventItem | null>(null);
const yomiParticipants = ref<EventParticipant[]>([]);
const yomiLoading = ref(false);
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
    yomiParticipants.value = res.data.participants || [];
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

const normalizedYomiKey = (status?: string): 'A' | 'B' | 'C' | 'XA' | 'OTHER' => {
  if (status === 'A_ENTRY' || status === 'registered') return 'A';
  if (status === 'B_WAITING') return 'B';
  if (status === 'C_WAITING') return 'C';
  if (status === 'XA_CANCEL' || status === 'canceled') return 'XA';
  return 'OTHER';
};

const yomiCounts = computed(() => ({
  A: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'A').length,
  B: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'B').length,
  C: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'C').length,
  XA: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'XA').length
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

const yomiGroups = computed<Record<YomiKey, EventParticipant[]>>(() => ({
  A: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'A'),
  B: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'B'),
  C: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'C'),
  XA: yomiParticipants.value.filter((p) => normalizedYomiKey(p.status) === 'XA')
}));

const yomiSections: Array<{ key: YomiKey; label: string; accent: string }> = [
  { key: 'A', label: 'A:エントリー', accent: 'text-blue-700 border-blue-200 bg-blue-50' },
  { key: 'B', label: 'B:回答待ち', accent: 'text-amber-700 border-amber-200 bg-amber-50' },
  { key: 'C', label: 'C:回答待ち', accent: 'text-purple-700 border-purple-200 bg-purple-50' },
  { key: 'XA', label: 'XA:エントリーキャンセル', accent: 'text-red-700 border-red-200 bg-red-50' }
];

const updateYomiParticipantStatus = async (eventId: number, studentId: number, status: 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL') => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/events/${eventId}/participants/${studentId}`, { status }, { headers: { Authorization: token } });
    await openYomiEventDetail(eventId);
    await fetchData();
  } catch (err) {
    console.error(err);
  }
};

const recentStudents = computed(() => {
  return [...students.value]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);
});

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
    .filter((row) => String(row.event_date || '').slice(0, 7) === month)
    .map((row) => ({
      ...row,
      heldDate: row.event_date ? new Date(row.event_date).toLocaleDateString('ja-JP') : '-'
    }));
});

onMounted(fetchData);
watch(sourceCompanyFilter, fetchInterviewMetrics);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p class="text-gray-500 mt-2">最新の統計と活動状況を確認できます。</p>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-900">イベント別ヨミ表（A/B/C）</h2>
          <span class="text-sm text-gray-500">開催予定: {{ upcomingEvents }}件</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <span class="text-xs text-gray-500">区分:</span>
          <span class="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs">A:エントリー</span>
          <span class="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs">B:回答待ち</span>
          <span class="px-2 py-1 rounded border border-purple-200 bg-purple-50 text-purple-700 text-xs">C:回答待ち</span>
          <span class="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs">XA:エントリーキャンセル</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">イベント名</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">開催日</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-blue-700 uppercase">A</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-amber-700 uppercase">B</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-purple-700 uppercase">C</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-red-700 uppercase">XA</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="row in eventYomiRows" :key="row.id" class="hover:bg-gray-50">
                <td class="px-3 py-2">
                  <button class="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline" @click="openYomiEventDetail(row.id)">
                    {{ row.title }}
                  </button>
                </td>
                <td class="px-3 py-2 text-gray-600">{{ row.event_date ? new Date(row.event_date).toLocaleDateString('ja-JP') : '-' }}</td>
                <td class="px-3 py-2 text-right text-blue-700 font-semibold">{{ row.a }}</td>
                <td class="px-3 py-2 text-right text-amber-700 font-semibold">{{ row.b }}</td>
                <td class="px-3 py-2 text-right text-purple-700 font-semibold">{{ row.c }}</td>
                <td class="px-3 py-2 text-right text-red-700 font-semibold">{{ row.xa }}</td>
                <td class="px-3 py-2 text-right text-gray-700 font-semibold">{{ row.total }}</td>
              </tr>
              <tr v-if="eventYomiRows.length === 0">
                <td colSpan="7" class="px-3 py-8 text-center text-gray-400">イベントデータがありません。</td>
              </tr>
            </tbody>
          </table>
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

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-900 mb-4">ファネルKPI</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="rounded-lg border border-gray-200 p-3"><p class="text-xs text-gray-500">申込→予約率</p><p class="text-xl font-bold">{{ funnelKpi.applicationToReservationRate.toFixed(2) }}%</p></div>
          <div class="rounded-lg border border-gray-200 p-3"><p class="text-xs text-gray-500">予約→面談率</p><p class="text-xl font-bold">{{ funnelKpi.reservationToInterviewRate.toFixed(2) }}%</p></div>
          <div class="rounded-lg border border-gray-200 p-3"><p class="text-xs text-gray-500">面談→イベント提案率</p><p class="text-xl font-bold">{{ funnelKpi.interviewToProposalRate.toFixed(2) }}%</p></div>
          <div class="rounded-lg border border-gray-200 p-3"><p class="text-xs text-gray-500">提案→参加率</p><p class="text-xl font-bold">{{ funnelKpi.proposalToJoinRate.toFixed(2) }}%</p></div>
          <div class="rounded-lg border border-gray-200 p-3">
            <p class="text-xs text-gray-500 mb-1">失注理由ランキング</p>
            <p class="text-xs text-gray-700" v-if="funnelKpi.lostReasonRanking.length === 0">データなし</p>
            <ul v-else class="text-xs text-gray-700 space-y-0.5">
              <li v-for="r in funnelKpi.lostReasonRanking.slice(0, 3)" :key="`lost-dashboard-${r.reason_name}`">{{ r.reason_name }}: {{ r.count }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">日別申込数（直近31日）</h3>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[360px] text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-gray-500">日付</th>
                <th class="px-3 py-2 text-right text-gray-500">申込数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="d in funnelKpi.daily_applications" :key="`daily-dashboard-${d.day}`">
                <td class="px-3 py-2 text-gray-700">{{ d.day ? new Date(d.day).toLocaleDateString('ja-JP') : '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-900">{{ d.count }}</td>
              </tr>
              <tr v-if="funnelKpi.daily_applications.length === 0">
                <td class="px-3 py-3 text-gray-400 text-center" colSpan="2">データがありません</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-2">流入経路タブ</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in sourceCompanyOptions"
            :key="`source-filter-${opt}`"
            class="px-3 py-1.5 rounded-lg text-sm border"
            :class="sourceCompanyFilter === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
            @click="sourceCompanyFilter = opt"
          >
            {{ opt === 'ALL' ? 'すべて' : opt }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談リードタイム平均</p>
          <p class="text-2xl font-bold text-gray-900">{{ interviewMetrics.first_lead_time_days_avg ?? '-' }}<span class="text-sm font-medium text-gray-500">日</span></p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談リスケ</p>
          <p class="text-2xl font-bold text-gray-900">{{ interviewMetrics.first_rescheduled }}<span class="text-sm font-medium text-gray-500">件</span></p>
          <p class="text-xs text-gray-500 mt-1">率: {{ interviewMetrics.first_reschedule_rate ?? '-' }}% / 母数: {{ interviewMetrics.first_total }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">2回目以降リードタイム平均</p>
          <p class="text-2xl font-bold text-gray-900">{{ interviewMetrics.followup_lead_time_days_avg ?? '-' }}<span class="text-sm font-medium text-gray-500">日</span></p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">2回目以降リスケ</p>
          <p class="text-2xl font-bold text-gray-900">{{ interviewMetrics.followup_rescheduled }}<span class="text-sm font-medium text-gray-500">件</span></p>
          <p class="text-xs text-gray-500 mt-1">率: {{ interviewMetrics.followup_reschedule_rate ?? '-' }}% / 母数: {{ interviewMetrics.followup_total }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談実施率</p>
          <p class="text-2xl font-bold text-gray-900">{{ interviewMetrics.account_summary.first_interview_execution_rate ?? '-' }}<span class="text-sm font-medium text-gray-500">%</span></p>
          <p class="text-xs text-gray-500 mt-1">実施: {{ interviewMetrics.account_summary.first_interview_executed_count }} / 設定: {{ interviewMetrics.account_summary.settings_count }}</p>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-900 mb-4">流入経路別リードタイム</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">流入経路</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">設定数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目面談数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">面談数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談実施数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談実施率(%)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">設定→初回面談平均(日)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回平均(日)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回リスケ率(%)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目以降平均(日)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目以降リスケ率(%)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="row in interviewMetricsBySource" :key="`metric-row-${row.source_company}`" class="hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-900">{{ row.source_company }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.settings_count ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_interviews_count ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.second_interviews_count ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.interviews_count ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_interview_executed_count ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_interview_execution_rate ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.setting_to_first_interview_lead_time_days_avg ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_lead_time_days_avg ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_reschedule_rate ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.followup_lead_time_days_avg ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.followup_reschedule_rate ?? '-' }}</td>
              </tr>
              <tr v-if="interviewMetricsBySource.length === 0">
                <td colSpan="12" class="px-3 py-8 text-center text-gray-400">データがありません。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-900 mb-4">担当者別 初回面談実施率</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">担当者</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">設定数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談実施数</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談実施率(%)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="row in interviewExecutionByStaff" :key="`staff-exec-${row.staff_id ?? 'none'}-${row.staff_name}`" class="hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-900">{{ row.staff_name || '未割当' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.settings_count }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_interview_executed_count }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_interview_execution_rate ?? '-' }}</td>
              </tr>
              <tr v-if="interviewExecutionByStaff.length === 0">
                <td colSpan="4" class="px-3 py-8 text-center text-gray-400">データがありません。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
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
              <p class="text-[11px] text-blue-700">設定: {{ settingCountByDate[cell.date] || 0 }}</p>
              <p class="text-[11px] text-emerald-700">面談: {{ interviewCountByDate[cell.date] || 0 }}</p>
            </template>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">最近登録された学生</h2>
        <div class="space-y-3">
          <div v-for="s in recentStudents" :key="s.id" class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">{{ s.name }}</p>
              <p class="text-xs text-gray-500">{{ s.status || '未設定' }}</p>
            </div>
            <span class="text-xs text-gray-400">{{ s.created_at ? new Date(s.created_at).toLocaleDateString('ja-JP') : '-' }}</span>
          </div>
          <div v-if="recentStudents.length === 0" class="text-sm text-gray-400">学生データがありません。</div>
        </div>
      </div>
    </div>

    <div v-if="selectedYomiEvent" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/30" @click="closeYomiEventDetail" />
      <div class="absolute right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl border-l border-gray-200 p-4 md:p-6 overflow-y-auto">
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
        <div v-else class="space-y-4">
          <div v-for="section in yomiSections" :key="section.key" class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 text-sm font-semibold border-b border-gray-200" :class="section.accent">
              {{ section.label }}（{{ yomiCounts[section.key] }}名）
            </div>
            <div class="max-h-56 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">学生名</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">大学</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">担当</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">変更</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="p in yomiGroups[section.key]" :key="`${section.key}-${p.student_id}`" class="hover:bg-gray-50">
                    <td class="px-3 py-2 text-gray-900">{{ p.name }}</td>
                    <td class="px-3 py-2 text-gray-600">{{ p.university || '-' }}</td>
                    <td class="px-3 py-2 text-gray-600">{{ p.staff_name || '-' }}</td>
                    <td class="px-3 py-2">
                      <select
                        class="w-full min-w-[170px] px-2 py-1 border border-gray-300 rounded-md text-xs bg-white"
                        :value="p.status === 'registered' ? 'A_ENTRY' : (p.status || 'A_ENTRY')"
                        @change="selectedYomiEvent && updateYomiParticipantStatus(selectedYomiEvent.id, p.student_id, ($event.target as HTMLSelectElement).value as 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL')"
                      >
                        <option value="A_ENTRY">A:エントリー</option>
                        <option value="B_WAITING">B:回答待ち</option>
                        <option value="C_WAITING">C:回答待ち</option>
                        <option value="XA_CANCEL">XA:エントリーキャンセル（誤登録時）</option>
                      </select>
                    </td>
                  </tr>
                  <tr v-if="yomiGroups[section.key].length === 0">
                    <td colSpan="4" class="px-3 py-6 text-center text-gray-400">該当学生はいません。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

  </Layout>
</template>
