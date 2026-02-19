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

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const [studentRes, eventRes] = await Promise.all([
      api.get('/api/students', { headers: { Authorization: token } }),
      api.get('/api/events', { headers: { Authorization: token } })
    ]);
    students.value = studentRes.data;
    events.value = eventRes.data;
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
                <td class="px-3 py-2 text-right text-gray-700 font-semibold">{{ row.total }}</td>
              </tr>
              <tr v-if="eventYomiRows.length === 0">
                <td colSpan="6" class="px-3 py-8 text-center text-gray-400">イベントデータがありません。</td>
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
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">学生名</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">大学</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">担当</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-if="yomiLoading">
                <td colSpan="4" class="px-3 py-8 text-center text-gray-400">読み込み中...</td>
              </tr>
              <tr v-for="p in yomiParticipants" :key="p.student_id" class="hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-900">{{ p.name }}</td>
                <td class="px-3 py-2 text-gray-600">{{ p.university || '-' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ p.staff_name || '-' }}</td>
                <td class="px-3 py-2">
                  <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="yomiStatusClass(p.status)">
                    {{ yomiStatusLabel(p.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="!yomiLoading && yomiParticipants.length === 0">
                <td colSpan="4" class="px-3 py-8 text-center text-gray-400">参加予定の学生がいません。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </Layout>
</template>
