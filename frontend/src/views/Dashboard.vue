<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { Users, Calendar, UserPlus, FileCheck, Link as LinkIcon } from 'lucide-vue-next';

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
const inviteUrl = ref('');
const inviteMessage = ref('');
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
  followup_reschedule_rate: null as number | null
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
    const metricsRes = await api.get('/api/students/metrics/interviews', { headers: { Authorization: token } });
    interviewMetrics.value = {
      first_lead_time_days_avg: metricsRes.data?.first_lead_time_days_avg ?? null,
      first_total: Number(metricsRes.data?.first_total || 0),
      first_rescheduled: Number(metricsRes.data?.first_rescheduled || 0),
      first_reschedule_rate: metricsRes.data?.first_reschedule_rate ?? null,
      followup_lead_time_days_avg: metricsRes.data?.followup_lead_time_days_avg ?? null,
      followup_total: Number(metricsRes.data?.followup_total || 0),
      followup_rescheduled: Number(metricsRes.data?.followup_rescheduled || 0),
      followup_reschedule_rate: metricsRes.data?.followup_reschedule_rate ?? null
    };
  } catch (err) {
    console.error(err);
  }
};

const createInvite = async () => {
  try {
    inviteMessage.value = '';
    const token = localStorage.getItem('token');
    const res = await api.post('/api/auth/invite', {}, { headers: { Authorization: token } });
    inviteUrl.value = res.data.invite_url;
  } catch (err) {
    inviteMessage.value = '招待URLの発行に失敗しました。';
  }
};

const copyInvite = async () => {
  if (!inviteUrl.value) return;
  await navigator.clipboard.writeText(inviteUrl.value);
  inviteMessage.value = 'コピーしました。';
};

const totalParticipants = computed(() =>
  events.value.reduce((sum, e) => sum + Number(e.total_count || 0), 0)
);

const attendedParticipants = computed(() =>
  events.value.reduce((sum, e) => sum + Number(e.attended_count || 0), 0)
);

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

const stats = computed(() => [
  { label: '総学生数', value: students.value.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
  { label: 'イベント数', value: events.value.length, icon: Calendar, color: 'bg-green-50 text-green-600' },
  { label: '参加者数', value: totalParticipants.value, icon: UserPlus, color: 'bg-purple-50 text-purple-600' },
  { label: '出席者数', value: attendedParticipants.value, icon: FileCheck, color: 'bg-amber-50 text-amber-600' }
]);

onMounted(fetchData);
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p class="text-gray-500 mt-2">最新の統計と活動状況を確認できます。</p>
      </div>

      <div v-if="user.role === 'admin'" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-gray-900">担当者招待URL</h2>
          <button @click="createInvite" class="px-4 py-2 bg-blue-600 text-white rounded-lg">発行</button>
        </div>
        <div v-if="inviteUrl" class="flex items-center gap-2">
          <input :value="inviteUrl" readonly class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button @click="copyInvite" class="px-3 py-2 border border-gray-200 rounded-lg text-sm flex items-center gap-2">
            <LinkIcon class="w-4 h-4" />
            コピー
          </button>
        </div>
        <p v-if="inviteMessage" class="text-xs text-gray-500 mt-2">{{ inviteMessage }}</p>
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

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div v-for="card in stats" :key="card.label" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center gap-4">
            <div :class="`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center`">
              <component :is="card.icon" class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm text-gray-500">{{ card.label }}</p>
              <p class="text-2xl font-bold text-gray-900">{{ card.value }}</p>
            </div>
          </div>
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
      <div class="absolute right-0 top-0 h-full w-full md:w-1/2 bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
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
