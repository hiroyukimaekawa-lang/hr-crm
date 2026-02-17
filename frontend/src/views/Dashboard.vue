<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { Users, Calendar, UserPlus, FileCheck, Link as LinkIcon, ChevronLeft, ChevronRight } from 'lucide-vue-next';

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
}

const students = ref<Student[]>([]);
const events = ref<EventItem[]>([]);
const inviteUrl = ref('');
const inviteMessage = ref('');
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');
const calendarMonth = ref(new Date());
const selectedCalendarEvent = ref<EventItem | null>(null);

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

const statusData = computed(() => {
  const map: Record<string, number> = {};
  students.value.forEach(s => {
    const key = s.status || '未設定';
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count }));
});

const recentStudents = computed(() => {
  return [...students.value]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);
});

const formatDateKey = (value: string | Date) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(calendarMonth.value)
);

const eventsByDate = computed(() => {
  const map: Record<string, EventItem[]> = {};
  events.value.forEach(e => {
    if (!e.event_date) return;
    const key = formatDateKey(e.event_date);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(e);
  });
  return map;
});

const getEventsForDate = (key: string) => eventsByDate.value[key] || [];

const calendarCells = computed(() => {
  const base = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth(), 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = base.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, key: `blank-start-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, key: formatDateKey(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `blank-end-${cells.length}` });
  }

  return cells;
});

const eventsInMonth = computed(() => {
  const y = calendarMonth.value.getFullYear();
  const m = calendarMonth.value.getMonth();
  return events.value
    .filter(e => e.event_date && new Date(e.event_date).getFullYear() === y && new Date(e.event_date).getMonth() === m)
    .sort((a, b) => new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime());
});

const prevMonth = () => {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() - 1, 1);
};

const nextMonth = () => {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + 1, 1);
};

const openEventDetailPanel = (event: EventItem) => {
  selectedCalendarEvent.value = event;
};

const closeEventDetailPanel = () => {
  selectedCalendarEvent.value = null;
};

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

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-900">イベント開催カレンダー</h2>
          <div class="flex items-center gap-2">
            <button @click="prevMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <span class="text-sm font-medium text-gray-700 min-w-[120px] text-center">{{ monthLabel }}</span>
            <button @click="nextMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-7 text-xs text-gray-500 mb-2">
          <div class="py-1 text-center">日</div>
          <div class="py-1 text-center">月</div>
          <div class="py-1 text-center">火</div>
          <div class="py-1 text-center">水</div>
          <div class="py-1 text-center">木</div>
          <div class="py-1 text-center">金</div>
          <div class="py-1 text-center">土</div>
        </div>
        <div class="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
          <div
            v-for="cell in calendarCells"
            :key="cell.key"
            class="min-h-[72px] border-r border-b border-gray-200 p-2 text-xs"
            :class="{ 'bg-gray-50': !cell.date }"
          >
            <template v-if="cell.date">
              <div class="text-gray-700">{{ cell.date.getDate() }}</div>
              <div v-if="getEventsForDate(cell.key).length" class="mt-1 space-y-1">
                <div
                  v-for="ev in getEventsForDate(cell.key).slice(0, 2)"
                  :key="ev.id"
                  class="truncate px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100"
                  @click="openEventDetailPanel(ev)"
                >
                  {{ ev.title }}
                </div>
                <div v-if="getEventsForDate(cell.key).length > 2" class="text-[10px] text-gray-500">
                  +{{ getEventsForDate(cell.key).length - 2 }}件
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="mt-4">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">今月のイベント</h3>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div v-for="ev in eventsInMonth" :key="`month-${ev.id}`" class="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
              <button class="text-gray-900 truncate text-left hover:text-blue-700" @click="openEventDetailPanel(ev)">{{ ev.title }}</button>
              <span class="text-gray-500 ml-3 whitespace-nowrap">{{ ev.event_date ? new Date(ev.event_date).toLocaleDateString('ja-JP') : '-' }}</span>
            </div>
            <div v-if="eventsInMonth.length === 0" class="text-sm text-gray-400">この月のイベントはありません。</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-900">ステータス別学生数</h2>
            <span class="text-sm text-gray-500">開催予定: {{ upcomingEvents }}件</span>
          </div>
          <div class="space-y-3">
            <div v-for="item in statusData" :key="item.name" class="flex items-center gap-4">
              <span class="text-sm text-gray-700 w-24">{{ item.name }}</span>
              <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-600 rounded-full"
                  :style="{ width: `${Math.round((item.count / Math.max(students.length, 1)) * 100)}%` }"
                />
              </div>
              <span class="text-sm text-gray-500 w-10 text-right">{{ item.count }}</span>
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
    </div>

    <div v-if="selectedCalendarEvent" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/20" @click="closeEventDetailPanel" />
      <div class="absolute right-0 top-0 h-full w-full md:w-1/2 bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900">イベント詳細</h2>
          <button class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" @click="closeEventDetailPanel">閉じる</button>
        </div>
        <div class="space-y-3 text-sm">
          <div>
            <p class="text-gray-500">イベント名</p>
            <p class="text-gray-900 font-semibold">{{ selectedCalendarEvent.title }}</p>
          </div>
          <div>
            <p class="text-gray-500">開催日時</p>
            <p class="text-gray-900">{{ selectedCalendarEvent.event_date ? new Date(selectedCalendarEvent.event_date).toLocaleString('ja-JP') : '-' }}</p>
          </div>
          <div>
            <p class="text-gray-500">会場</p>
            <p class="text-gray-900">{{ selectedCalendarEvent.location || '-' }}</p>
          </div>
          <div>
            <p class="text-gray-500">説明</p>
            <p class="text-gray-900 whitespace-pre-wrap">{{ selectedCalendarEvent.description || '-' }}</p>
          </div>
          <div>
            <p class="text-gray-500">目標着座人数</p>
            <p class="text-gray-900">{{ selectedCalendarEvent.target_seats || 0 }}名</p>
          </div>
          <div>
            <p class="text-gray-500">エントリー人数</p>
            <p class="text-gray-900">{{ selectedCalendarEvent.registered_count || 0 }}名</p>
          </div>
          <div>
            <p class="text-gray-500">LPリンク</p>
            <a
              v-if="selectedCalendarEvent.lp_url"
              :href="selectedCalendarEvent.lp_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-700 break-all"
            >
              {{ selectedCalendarEvent.lp_url }}
            </a>
            <p v-else class="text-gray-900">未設定</p>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
