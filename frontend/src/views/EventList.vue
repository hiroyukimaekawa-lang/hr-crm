<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import {
  Calendar,
  MapPin,
  Users as UsersIcon,
  Plus,
  ChevronRight,
  Trash2,
  ChevronLeft
} from 'lucide-vue-next';

interface EventItem {
  id: number;
  title: string;
  description?: string;
  event_date?: string;
  event_dates?: string[];
  location?: string;
  capacity?: number;
  target_seats?: number;
  unit_price?: number;
  target_sales?: number;
  current_sales?: number;
  lp_url?: string;
  registered_count?: number;
  attended_count?: number;
  total_count?: number;
}

const events = ref<EventItem[]>([]);
const newEvent = ref({
  title: '',
  description: '',
  event_dates: [''],
  location: '',
  lp_url: '',
  capacity: '',
  target_seats: '',
  unit_price: '',
  target_sales: '',
  current_sales: ''
});
const showCreate = ref(false);
const selectedCalendarEvent = ref<EventItem | null>(null);
const router = useRouter();
const calendarBaseMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const fetchEvents = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/events', { headers: { Authorization: token } });
  events.value = res.data;
};

const createEvent = async () => {
  const token = localStorage.getItem('token');
  await api.post('/api/events', {
    ...newEvent.value,
    event_dates: newEvent.value.event_dates.filter(v => String(v || '').trim()),
    capacity: newEvent.value.capacity ? Number(newEvent.value.capacity) : null,
    target_seats: newEvent.value.target_seats ? Number(newEvent.value.target_seats) : null,
    unit_price: newEvent.value.unit_price ? Number(newEvent.value.unit_price) : null,
    target_sales: newEvent.value.target_sales ? Number(newEvent.value.target_sales) : null,
    current_sales: newEvent.value.current_sales ? Number(newEvent.value.current_sales) : 0
  }, { headers: { Authorization: token } });
  newEvent.value = { title: '', description: '', event_dates: [''], location: '', lp_url: '', capacity: '', target_seats: '', unit_price: '', target_sales: '', current_sales: '' };
  showCreate.value = false;
  fetchEvents();
};

const deleteEvent = async (eventId: number) => {
  if (!confirm('このイベントを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/events/${eventId}`, { headers: { Authorization: token } });
  fetchEvents();
};

const eventStatus = (eventDate?: string) => {
  if (!eventDate) return '未定';
  return new Date(eventDate) > new Date() ? '開催予定' : '終了';
};

const progressRate = (event: EventItem) => {
  const target = event.capacity || event.target_seats || 0;
  if (target === 0) return 0;
  return Math.min(Math.round(((event.registered_count || 0) / target) * 100), 100);
};

const expectedSales = (event: EventItem) => {
  return Number(event.unit_price || 0) * Number(event.registered_count || 0);
};

const remainingEntries = (event: EventItem) => {
  const remain = Number(event.capacity || event.target_seats || 0) - Number(event.registered_count || 0);
  return remain > 0 ? remain : 0;
};

const formatDateKey = (value: string | Date) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const currentMonthBase = computed(() => new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth(), 1));

const nextMonthBase = computed(() => {
  const base = currentMonthBase.value;
  return new Date(base.getFullYear(), base.getMonth() + 1, 1);
});

const eventsByDate = computed(() => {
  const map: Record<string, EventItem[]> = {};
  events.value.forEach(e => {
    const dateList = Array.isArray(e.event_dates) && e.event_dates.length > 0
      ? e.event_dates
      : (e.event_date ? [e.event_date] : []);
    dateList.forEach((d) => {
      const key = formatDateKey(d);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
  });
  return map;
});

const addEventDateInput = () => {
  newEvent.value.event_dates.push('');
};

const removeEventDateInput = (index: number) => {
  if (newEvent.value.event_dates.length <= 1) {
    newEvent.value.event_dates = [''];
    return;
  }
  newEvent.value.event_dates.splice(index, 1);
};

const displayEventDates = (event: EventItem | null) => {
  if (!event) return [] as string[];
  const list = Array.isArray(event.event_dates) && event.event_dates.length > 0
    ? event.event_dates
    : (event.event_date ? [event.event_date] : []);
  return list.map((d) => new Date(d).toLocaleString('ja-JP'));
};

const getEventsForDate = (key: string) => eventsByDate.value[key] || [];

const getCalendarCellsForMonth = (base: Date) => {
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = base.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, key: `blank-start-${i}` });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, key: formatDateKey(date) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, key: `blank-end-${cells.length}` });
  return cells;
};

const currentMonthCells = computed(() => getCalendarCellsForMonth(currentMonthBase.value));
const nextMonthCells = computed(() => getCalendarCellsForMonth(nextMonthBase.value));
const monthLabel = (value: Date) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(value);

const prevMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() - 1, 1);
};

const nextMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() + 1, 1);
};

const openEventDetailPanel = (event: EventItem) => {
  selectedCalendarEvent.value = event;
};

const closeEventDetailPanel = () => {
  selectedCalendarEvent.value = null;
};

onMounted(fetchEvents);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">イベント一覧</h1>
          <p class="text-gray-500 mt-2">開催予定および過去のイベントを一覧で確認できます。</p>
        </div>
        <button
          @click="showCreate = true"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>イベント作成</span>
        </button>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-900">イベント開催カレンダー（今月・来月）</h2>
          <div class="flex items-center gap-2">
            <button @click="prevMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click="nextMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ monthLabel(currentMonthBase) }}</h3>
            <div class="grid grid-cols-7 text-xs text-gray-500 mb-2">
              <div class="py-1 text-center">日</div><div class="py-1 text-center">月</div><div class="py-1 text-center">火</div><div class="py-1 text-center">水</div><div class="py-1 text-center">木</div><div class="py-1 text-center">金</div><div class="py-1 text-center">土</div>
            </div>
            <div class="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
              <div v-for="cell in currentMonthCells" :key="`current-${cell.key}`" class="min-h-[72px] border-r border-b border-gray-200 p-2 text-xs" :class="{ 'bg-gray-50': !cell.date }">
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
          </section>

          <section>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ monthLabel(nextMonthBase) }}</h3>
            <div class="grid grid-cols-7 text-xs text-gray-500 mb-2">
              <div class="py-1 text-center">日</div><div class="py-1 text-center">月</div><div class="py-1 text-center">火</div><div class="py-1 text-center">水</div><div class="py-1 text-center">木</div><div class="py-1 text-center">金</div><div class="py-1 text-center">土</div>
            </div>
            <div class="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
              <div v-for="cell in nextMonthCells" :key="`next-${cell.key}`" class="min-h-[72px] border-r border-b border-gray-200 p-2 text-xs" :class="{ 'bg-gray-50': !cell.date }">
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
          </section>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div v-for="e in events" :key="e.id" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <Calendar class="w-3.5 h-3.5" />
                {{ displayEventDates(e)[0] || '日程未定' }}
              </span>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full" :class="eventStatus(e.event_date) === '開催予定' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'">
                  {{ eventStatus(e.event_date) }}
                </span>
                <button
                  class="text-gray-400 hover:text-red-600"
                  @click="deleteEvent(e.id)"
                  title="削除"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-2">{{ e.title }}</h3>
            <details class="text-sm text-gray-600 mb-4 rounded-lg border border-gray-200 bg-gray-50">
              <summary class="cursor-pointer px-3 py-2 font-medium text-gray-700">概要を表示</summary>
              <p class="px-3 pb-3 whitespace-pre-wrap">{{ e.description || '説明は未登録です' }}</p>
            </details>
            <details class="text-sm text-gray-600 mb-4 rounded-lg border border-gray-200 bg-gray-50">
              <summary class="cursor-pointer px-3 py-2 font-medium text-gray-700">開催日程を表示</summary>
              <div class="px-3 pb-3">
                <p v-for="(dt, idx) in displayEventDates(e)" :key="`${e.id}-dt-${idx}`" class="text-xs text-gray-700">
                  {{ dt }}
                </p>
              </div>
            </details>

            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <MapPin class="w-4 h-4" />
                <span>{{ e.location || '会場未設定' }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <UsersIcon class="w-4 h-4" />
                <span>エントリー目標: {{ e.capacity || '-' }}名</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <UsersIcon class="w-4 h-4" />
                <span>着座目標: {{ e.target_seats || '-' }}名</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span>単価: {{ (e.unit_price || 0).toLocaleString() }}円</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span class="font-medium">LP:</span>
                <a
                  v-if="e.lp_url"
                  :href="e.lp_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:text-blue-700 truncate"
                >
                  {{ e.lp_url }}
                </a>
                <span v-else>-</span>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div class="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>エントリー: {{ e.registered_count || 0 }}名</span>
              <span>出席: {{ e.attended_count || 0 }}名</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>見込み売上: {{ expectedSales(e).toLocaleString() }}円</span>
              <span>不足エントリー: {{ remainingEntries(e) }}名</span>
            </div>
            <div class="mb-4">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>充足率（エントリー）</span>
                <span>{{ progressRate(e) }}%</span>
              </div>
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full bg-blue-600" :style="{ width: `${progressRate(e)}%` }" />
              </div>
            </div>
            <button
              class="w-full text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center justify-center gap-2 py-2 border border-blue-100 rounded-lg bg-white"
              @click="router.push(`/events/${e.id}`)"
            >
              詳細・参加者管理
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4 text-gray-900">新規イベント作成</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">イベント名</label>
            <input v-model="newEvent.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">概要</label>
            <textarea v-model="newEvent.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開催日時（複数可）</label>
            <div class="space-y-2">
              <div v-for="(_, idx) in newEvent.event_dates" :key="`new-event-date-${idx}`" class="flex gap-2">
                <input v-model="newEvent.event_dates[idx]" type="datetime-local" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <button type="button" class="px-3 py-2 border border-gray-300 rounded-lg text-xs hover:bg-gray-50" @click="removeEventDateInput(idx)">削除</button>
              </div>
              <button type="button" class="px-3 py-2 border border-blue-200 text-blue-700 rounded-lg text-xs hover:bg-blue-50" @click="addEventDateInput">日程追加</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">会場</label>
            <input v-model="newEvent.location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">LPリンク</label>
            <input v-model="newEvent.lp_url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">エントリー目標人数</label>
            <input v-model="newEvent.capacity" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">着座目標人数</label>
            <input v-model="newEvent.target_seats" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">単価（円）</label>
            <input v-model="newEvent.unit_price" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">目標売上（円）</label>
            <input v-model="newEvent.target_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">実績売上（円）</label>
            <input v-model="newEvent.current_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button @click="showCreate = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
          <button @click="createEvent" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">作成</button>
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
          <div><p class="text-gray-500">イベント名</p><p class="text-gray-900 font-semibold">{{ selectedCalendarEvent.title }}</p></div>
          <div>
            <p class="text-gray-500">開催日時</p>
            <p v-for="(dt, idx) in displayEventDates(selectedCalendarEvent)" :key="`panel-dt-${idx}`" class="text-gray-900">{{ dt }}</p>
            <p v-if="displayEventDates(selectedCalendarEvent).length === 0" class="text-gray-900">-</p>
          </div>
          <div><p class="text-gray-500">会場</p><p class="text-gray-900">{{ selectedCalendarEvent.location || '-' }}</p></div>
          <div><p class="text-gray-500">エントリー目標人数</p><p class="text-gray-900">{{ selectedCalendarEvent.capacity || '-' }}名</p></div>
          <div><p class="text-gray-500">着座目標人数</p><p class="text-gray-900">{{ selectedCalendarEvent.target_seats || '-' }}名</p></div>
          <div><p class="text-gray-500">概要</p><p class="text-gray-900 whitespace-pre-wrap">{{ selectedCalendarEvent.description || '-' }}</p></div>
          <div><p class="text-gray-500">LPリンク</p>
            <a v-if="selectedCalendarEvent.lp_url" :href="selectedCalendarEvent.lp_url" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 break-all">{{ selectedCalendarEvent.lp_url }}</a>
            <p v-else class="text-gray-900">未設定</p>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
