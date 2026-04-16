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
  type?: string;
  graduation_year?: number;
  description?: string;
  event_date?: string;
  event_dates?: string[];
  entry_deadline?: string;
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
  type: 'event',
  graduation_year: '',
  description: '',
  event_dates: [''],
  location: '',
  lp_url: ''
});
const showCreate = ref(false);
const selectedCalendarEvent = ref<EventItem | null>(null);
const eventParticipantNames = ref<Record<number, string[]>>({});
// 全参加者データ（日付×ステータスでフィルタ用）
const eventParticipantsMap = ref<Record<number, Participant[]>>({});
const router = useRouter();
const calendarBaseMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const parseLocalDate = (value?: string | Date) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim().replace('Z', '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const yyyy = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const dd = Number(m[3]);
  const hh = Number(m[4] || 0);
  const mi = Number(m[5] || 0);
  const ss = Number(m[6] || 0);
  return new Date(yyyy, mm, dd, hh, mi, ss);
};

interface Participant {
  id?: number;
  student_id: number;
  status: string;
  selected_event_date?: string | null;
  name: string;
  university?: string;
  staff_name?: string;
}


const fetchEvents = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/projects', { headers: { Authorization: token } });
  events.value = res.data;
  const detailResults = await Promise.all(
    events.value.map(async (e) => {
      try {
        const detail = await api.get(`/api/projects/${e.id}`, { headers: { Authorization: token } });
        const participants: Participant[] = Array.isArray(detail.data?.participants)
          ? detail.data.participants.map((p: any) => ({
              id: p.id,
              student_id: p.student_id,
              status: String(p.status || ''),
              selected_event_date: p.selected_event_date || null,
              name: String(p.name || ''),
              university: String(p.university || ''),
              staff_name: String(p.staff_name || '')
            }))
          : [];
        const names = participants.map(p => p.name).filter(Boolean);
        return { eventId: e.id, names: Array.from(new Set<string>(names)), participants };
      } catch {
        return { eventId: e.id, names: [] as string[], participants: [] as Participant[] };
      }
    })
  );
  const nameMap: Record<number, string[]> = {};
  const participantMap: Record<number, Participant[]> = {};
  detailResults.forEach((r) => {
    nameMap[r.eventId] = r.names;
    participantMap[r.eventId] = r.participants;
  });
  eventParticipantNames.value = nameMap;
  eventParticipantsMap.value = participantMap;
};

const createEvent = async () => {
  const token = localStorage.getItem('token');
  await api.post('/api/projects', {
    ...newEvent.value,
    event_dates: newEvent.value.event_dates.filter(v => String(v || '').trim())
  }, { headers: { Authorization: token } });
  newEvent.value = { title: '', type: 'event', graduation_year: '', description: '', event_dates: [''], location: '', lp_url: '' };
  showCreate.value = false;
  fetchEvents();
};

const deleteEvent = async (eventId: number) => {
  if (!confirm('この案件を削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/projects/${eventId}`, { headers: { Authorization: token } });
  fetchEvents();
};

const eventStatus = (eventDate?: string) => {
  if (!eventDate) return '未定';
  const d = parseLocalDate(eventDate);
  if (!d) return '未定';
  return d > new Date() ? '開催予定' : '終了';
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
  const d = parseLocalDate(value);
  if (!d) return '';
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const currentMonthBase = computed(() => new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth(), 1));

const eventsByDate = computed(() => {
  const map: Record<string, (EventItem & { dateCount: number })[]> = {};
  events.value.forEach(e => {
    const dateList = Array.isArray(e.event_dates) && e.event_dates.length > 0
      ? e.event_dates
      : (e.event_date ? [e.event_date] : []);
    
    const countMap: Record<string, number> = {};
    dateList.forEach((d) => {
      const key = formatDateKey(d);
      if (!key) return;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    for (const [key, count] of Object.entries(countMap)) {
      if (!map[key]) map[key] = [];
      map[key].push({ ...e, dateCount: count });
    }
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
  return list.map((d) => {
    const dt = parseLocalDate(d);
    return dt ? dt.toLocaleString('ja-JP') : String(d);
  });
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
const monthLabel = (value: Date) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(value);

const participantPreview = (eventId: number) => {
  const names = eventParticipantNames.value[eventId] || [];
  if (names.length === 0) return '参加者なし';
  if (names.length <= 2) return names.join(' / ');
  return `${names.slice(0, 2).join(' / ')} +${names.length - 2}名`;
};

const prevMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() - 1, 1);
};

const nextMonth = () => {
  calendarBaseMonth.value = new Date(calendarBaseMonth.value.getFullYear(), calendarBaseMonth.value.getMonth() + 1, 1);
};

const openEventDetailPanel = async (event: EventItem, dateKey?: string) => {
  selectedCalendarEvent.value = event;
  selectedEventDate.value = dateKey || '';
  selectedEventParticipants.value = [];
  isLoadingParticipants.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get(`/api/projects/${event.id}`, { headers: { Authorization: token } });
    if (res.data && Array.isArray(res.data.participants)) {
      selectedEventParticipants.value = res.data.participants;
    }
  } catch (error) {
    console.error('Failed to load participants', error);
  } finally {
    isLoadingParticipants.value = false;
  }
};

const closeEventDetailPanel = () => {
  selectedCalendarEvent.value = null;
  selectedEventDate.value = '';
  selectedEventParticipants.value = [];
};

const selectedEventDate = ref<string>('');
const selectedEventParticipants = ref<Participant[]>([]);
const isLoadingParticipants = ref(false);

const filteredParticipants = computed(() => {
  // カレンダーからクリックした場合: 日付一致 + A_ENTRYのみ
  const base = selectedEventDate.value
    ? selectedEventParticipants.value.filter(p => {
        if (!p.selected_event_date) return false;
        return formatDateKey(p.selected_event_date) === selectedEventDate.value;
      })
    : selectedEventParticipants.value;
  // A_ENTRY のみ表示
  return base.filter(p => p.status === 'A_ENTRY');
});

const participantStatusCounts = computed(() => {
  const counts: Record<string, number> = {};
  filteredParticipants.value.forEach(p => {
    const s = p.status || '未定義';
    counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
});

// カレンダーセル用: 日付一致+A_ENTRYの参加者数を返す
const getCalendarEntryCount = (eventId: number, dateKey: string): number => {
  const ps = eventParticipantsMap.value[eventId] || [];
  return ps.filter(p =>
    p.status === 'A_ENTRY' &&
    p.selected_event_date &&
    formatDateKey(p.selected_event_date) === dateKey
  ).length;
};

onMounted(fetchEvents);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">イベント一覧</h1>
          <p class="text-gray-500 mt-2">開催予定および過去のイベントを一覧で確認できます。</p>
        </div>
        <button
          @click="showCreate = true"
          class="bg-blue-600 text-white px-4 py-2 text-base md:text-sm min-h-[44px] rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>イベント作成</span>
        </button>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-900">イベント開催カレンダー（今月）</h2>
          <div class="flex items-center gap-2">
            <button @click="prevMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click="nextMonth" class="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
        <section>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ monthLabel(currentMonthBase) }}</h3>
          <div class="grid grid-cols-7 text-xs text-gray-500 mb-2">
            <div class="py-1 text-center">日</div><div class="py-1 text-center">月</div><div class="py-1 text-center">火</div><div class="py-1 text-center">水</div><div class="py-1 text-center">木</div><div class="py-1 text-center">金</div><div class="py-1 text-center">土</div>
          </div>
          <div class="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
            <div
              v-for="cell in currentMonthCells"
              :key="`current-${cell.key}`"
              class="border-r border-b border-gray-200 text-xs transition-colors"
              :class="{
                'bg-gray-50': !cell.date,
                'bg-white': cell.date && getEventsForDate(cell.key).length === 0,
                'bg-blue-50/30': cell.date && getEventsForDate(cell.key).length > 0,
                'ring-2 ring-inset ring-red-400': cell.date && cell.date.toDateString() === new Date().toDateString()
              }"
              style="min-height: 96px;"
            >
              <template v-if="cell.date">
                <!-- 日付ヘッダー -->
                <div
                  class="flex items-center justify-between px-2 py-1 border-b text-xs"
                  :class="getEventsForDate(cell.key).length > 0
                    ? 'bg-blue-600 border-blue-700'
                    : (cell.date.toDateString() === new Date().toDateString()
                        ? 'bg-red-500 border-red-600'
                        : 'bg-white border-gray-100')"
                >
                  <span
                    class="font-bold"
                    :class="{
                      'text-white': getEventsForDate(cell.key).length > 0 || cell.date.toDateString() === new Date().toDateString(),
                      'text-red-500': cell.date.getDay() === 0 && getEventsForDate(cell.key).length === 0 && cell.date.toDateString() !== new Date().toDateString(),
                      'text-blue-500': cell.date.getDay() === 6 && getEventsForDate(cell.key).length === 0 && cell.date.toDateString() !== new Date().toDateString(),
                      'text-gray-700': ![0,6].includes(cell.date.getDay()) && getEventsForDate(cell.key).length === 0 && cell.date.toDateString() !== new Date().toDateString()
                    }"
                  >{{ cell.date.getDate() }}</span>
                  <span v-if="getEventsForDate(cell.key).length > 0" class="text-[10px] text-blue-100 font-medium">
                    {{ getEventsForDate(cell.key).length }}件
                  </span>
                </div>

                <!-- イベント一覧：タイトル + 参加ありボタン -->
                <div class="p-1 space-y-0.5">
                  <div
                    v-for="ev in getEventsForDate(cell.key).slice(0, 4)"
                    :key="ev.id"
                    class="rounded overflow-hidden"
                  >
                    <!-- イベント名 -->
                    <div class="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-semibold truncate leading-tight" :title="ev.title">
                      {{ ev.title }}{{ ev.dateCount > 1 ? `（${ev.dateCount}日程）` : '' }}
                    </div>
                    <!-- 参加ありボタン: 日付一致+A_ENTRYのみカウント -->
                    <button
                      v-if="getCalendarEntryCount(ev.id, cell.key) > 0"
                      class="w-full text-left px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-semibold hover:bg-emerald-100 transition-colors border-t border-emerald-100 flex items-center gap-1"
                      @click.stop="openEventDetailPanel(ev, cell.key)"
                    >
                      <svg class="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                      {{ getCalendarEntryCount(ev.id, cell.key) }}名参加
                    </button>
                  </div>
                  <div v-if="getEventsForDate(cell.key).length > 4" class="text-[9px] text-blue-500 font-semibold px-1">
                    +{{ getEventsForDate(cell.key).length - 4 }}件
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>
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
            
            <div class="flex items-center gap-2 mb-2">
              <span v-if="e.type === 'agent_interview'" class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                エージェント面談
              </span>
              <span v-else class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                イベント
              </span>
              <span v-if="e.graduation_year" class="px-2 py-0.5 border border-indigo-200 text-indigo-600 text-xs font-bold rounded">
                {{ e.graduation_year }}卒
              </span>
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
              <div v-if="e.entry_deadline" class="flex items-center gap-2 text-sm text-gray-600">
                <Calendar class="w-4 h-4" />
                <span>エントリー期日: {{ formatDateKey(e.entry_deadline) }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <UsersIcon class="w-4 h-4" />
                <span>エントリー目標: {{ e.capacity || '-' }}名</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <UsersIcon class="w-4 h-4" />
                <span>着座目標: {{ e.target_seats || '-' }}名</span>
              </div>
              <div v-if="e.target_sales" class="flex items-center gap-2 text-sm text-gray-600">
                <span>目標売上: {{ e.target_sales.toLocaleString() }}円</span>
              </div>
              <div v-if="e.current_sales" class="flex items-center gap-2 text-sm text-gray-600">
                <span>実績売上: {{ e.current_sales.toLocaleString() }}円</span>
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
              @click="router.push(`/projects/${e.id}`)"
            >
              イベント詳細・参加者管理
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 md:p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="px-4 md:px-6 pt-4 md:pt-6 pb-3 border-b border-gray-100">
          <h2 class="text-xl font-bold text-gray-900">新規イベント作成</h2>
        </div>
        <div class="px-4 md:px-6 py-4 overflow-y-auto space-y-4">
          <div>
            <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">イベント名</label>
            <input v-model="newEvent.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">イベント種別</label>
              <select v-model="newEvent.type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="event">イベント</option>
                <option value="agent_interview">エージェント面談</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">対象卒年（任意）</label>
              <input v-model="newEvent.graduation_year" type="number" placeholder="例: 2026" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>
          <div>
            <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">概要</label>
            <textarea v-model="newEvent.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"></textarea>
          </div>
          <div>
            <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">開催日時（複数可）</label>
            <div class="space-y-2">
              <div v-for="(_, idx) in newEvent.event_dates" :key="`new-event-date-${idx}`" class="flex gap-2">
                <input v-model="newEvent.event_dates[idx]" type="datetime-local" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <button type="button" class="px-4 py-2 text-base md:text-sm min-h-[44px] hover:bg-gray-50" @click="removeEventDateInput(idx)">削除</button>
              </div>
              <button type="button" class="px-4 py-2 text-base md:text-sm min-h-[44px] hover:bg-blue-50" @click="addEventDateInput">日程追加</button>
            </div>
          </div>
          <div>
            <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">会場</label>
            <input v-model="newEvent.location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-base md:text-sm font-medium text-gray-700 mb-1">LPリンク</label>
            <input v-model="newEvent.lp_url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
        <div class="px-4 md:px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button @click="showCreate = false" class="px-4 py-2 text-base md:text-sm min-h-[44px] text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
          <button @click="createEvent" class="px-4 py-2 text-base md:text-sm min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">作成</button>
        </div>
      </div>
    </div>

    <div v-if="selectedCalendarEvent" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="closeEventDetailPanel" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <!-- ヘッダー -->
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 class="text-base font-bold text-white">{{ selectedCalendarEvent.title }}</h2>
            <p class="text-xs text-blue-200 mt-0.5">{{ selectedEventDate }} の参加者（A:エントリーのみ）</p>
          </div>
          <button class="text-blue-200 hover:text-white p-1 transition-colors" @click="closeEventDetailPanel">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="px-5 py-4 overflow-y-auto">
          <!-- 合計バッジ -->
          <div class="flex items-center gap-2 mb-4">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-full">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
              {{ filteredParticipants.length }}名参加
            </span>
          </div>

          <div v-if="isLoadingParticipants" class="text-gray-500 text-sm py-8 text-center">
            読み込み中...
          </div>
          <div v-else-if="filteredParticipants.length === 0" class="text-gray-400 text-sm py-8 text-center bg-gray-50 rounded-xl">
            この日程のエントリー参加者はいません
          </div>
          <div v-else class="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs">名前</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs">大学</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs">担当</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs">ステータス</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs">参加日程</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <tr
                  v-for="p in filteredParticipants"
                  :key="p.id || p.student_id"
                  class="hover:bg-blue-50 transition-colors cursor-pointer"
                  @click="router.push(`/students/${p.student_id}`)"
                >
                  <td class="px-4 py-3 font-semibold text-blue-600 text-sm">{{ p.name }}</td>
                  <td class="px-4 py-3 text-gray-600 text-xs">{{ p.university || '-' }}</td>
                  <td class="px-4 py-3 text-gray-600 text-xs">{{ p.staff_name || '-' }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      A:エントリー
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 text-xs font-medium">
                    {{ p.selected_event_date ? formatDateKey(p.selected_event_date) : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
