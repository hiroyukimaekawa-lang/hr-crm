<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users as UsersIcon,
  Search,
  CheckCircle,
  XCircle,
  Download
} from 'lucide-vue-next';
import { getStatusLabel, getStatusBadgeClass } from '../lib/statusConfig'

interface Participant {
  id?: number; // student_events row id
  student_id: number;
  status: string;
  created_at: string;
  selected_event_date?: string | null;
  name: string;
  university?: string;
  staff_name?: string;
  email?: string;
  phone?: string;
  graduation_year?: number | null;
}

interface EventDetail {
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
  event_slots?: EventSlot[];
}

interface EventSlot {
  datetime: string;
  location: string;
  note?: string;
}

interface EventKgi {
  event_id: number;
  event_title: string;
  deadline: string | null;
  days_remaining: number;
  target_seats: number;
  current_seats: number;
  target_entry: number;
  kpi_target_entry: number;
  current_entry: number;
}

const route = useRoute();
const router = useRouter();
const eventId = route.params.id as string;

const event = ref<EventDetail | null>(null);
const participants = ref<Participant[]>([]);
const searchTerm = ref('');
const isEditing = ref(false);
const saveMessage = ref('');
const sortField = ref<'status' | null>(null);
const sortOrder = ref<'asc' | 'desc'>('asc');
const kgiData = ref<EventKgi | null>(null);
const kgiLoading = ref(false);

// statusModal related state removed as per refactor plan

const STATUS_ORDER: Record<string, number> = {
  A_ENTRY: 1, registered: 1,
  B_WAITING: 2,
  C_WAITING: 3,
  attended: 4,
  D_PASS: 5,
  E_FAIL: 6,
  XA_CANCEL: 7,
  canceled: 8
};
const form = ref({
  title: '',
  type: 'event',
  graduation_year: '',
  description: '',
  event_slots: [] as EventSlot[],
  entry_deadline: '',
  location: '',
  lp_url: '',
  capacity: '',
  target_seats: '',
  unit_price: '',
  target_sales: '',
  current_sales: ''
});

const parseLocalDate = (value?: string) => {
  if (!value) return null;
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

const formatEventSlot = (datetime?: string | null, location?: string | null) => {
  if (!datetime) return '-';
  const d = parseLocalDate(datetime);
  if (!d) return datetime || '-';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const base = `${month}/${day} ${hours}:${minutes}`;
  return location ? `${base} ${location}` : base;
};

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return '';
  const d = parseLocalDate(value);
  if (!d) return '';
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const fetchDetail = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/projects/${eventId}`, { headers: { Authorization: token } });
  event.value = res.data.event;
  participants.value = res.data.participants;
  form.value = {
    title: event.value?.title || '',
    type: event.value?.type || 'event',
    graduation_year: event.value?.graduation_year !== null && event.value?.graduation_year !== undefined ? String(event.value.graduation_year) : '',
    description: event.value?.description || '',
    event_slots: Array.isArray(event.value?.event_slots) && event.value!.event_slots!.length > 0
      ? event.value!.event_slots!.map((s: any) => ({
          datetime: toDateTimeLocalValue(s.datetime),
          location: s.location || '',
          note: s.note || ''
        }))
      : (Array.isArray(event.value?.event_dates) && event.value!.event_dates!.length > 0
          ? event.value!.event_dates!.map((d: string) => ({ datetime: toDateTimeLocalValue(d), location: event.value?.location || '', note: '' }))
          : (event.value?.event_date 
              ? [{ datetime: toDateTimeLocalValue(event.value.event_date), location: event.value?.location || '', note: '' }]
              : [{ datetime: '', location: '', note: '' }])),
    entry_deadline: toDateTimeLocalValue(event.value?.entry_deadline),
    location: event.value?.location || '',
    lp_url: event.value?.lp_url || '',
    capacity: event.value?.capacity ? String(event.value.capacity) : '',
    target_seats: event.value?.target_seats ? String(event.value.target_seats) : '',
    unit_price: event.value?.unit_price ? String(event.value.unit_price) : '',
    target_sales: event.value?.target_sales ? String(event.value.target_sales) : '',
    current_sales: event.value?.current_sales ? String(event.value.current_sales) : ''
  };

  // KPI進捗の取得
  try {
    kgiLoading.value = true;
    const token = localStorage.getItem('token');
    const kgiRes = await api.get('/api/projects/kgi-progress', { headers: { Authorization: token } });
    if (Array.isArray(kgiRes.data)) {
      kgiData.value = kgiRes.data.find((k: any) => k.event_id === Number(eventId)) || null;
    }
  } catch (err) {
    console.error('KGI fetch error', err);
  } finally {
    kgiLoading.value = false;
  }
};

const updateStatus = async (studentEventId: number, status: string) => {
  const token = localStorage.getItem('token');
  await api.put(`/api/projects/${eventId}/participants/${studentEventId}`,
    { status },
    { headers: { Authorization: token } }
  );
  fetchDetail();
};

const updateEvent = async () => {
  const token = localStorage.getItem('token');
  saveMessage.value = '';
  await api.put(`/api/projects/${eventId}`, {
    title: form.value.title,
    type: form.value.type,
    graduation_year: form.value.graduation_year ? Number(form.value.graduation_year) : null,
    description: form.value.description,
    event_slots: form.value.event_slots.filter(s => s.datetime),
    location: form.value.location || null,
    lp_url: form.value.lp_url || null,
  }, { headers: { Authorization: token } });
  isEditing.value = false;
  saveMessage.value = 'イベント情報を更新しました。';
  fetchDetail();
};

const addSlot = () => {
  form.value.event_slots.push({ datetime: '', location: '', note: '' });
};

const removeSlot = (index: number) => {
  if (form.value.event_slots.length <= 1) {
    form.value.event_slots = [{ datetime: '', location: '', note: '' }];
  } else {
    form.value.event_slots.splice(index, 1);
  }
};

const displayEventDates = (ev: EventDetail | null) => {
  if (!ev) return [] as string[];
  if (Array.isArray(ev.event_slots) && ev.event_slots.length > 0) {
    return ev.event_slots.map(s => formatEventSlot(s.datetime, s.location));
  }
  const list = Array.isArray(ev.event_dates) && ev.event_dates.length > 0
    ? ev.event_dates
    : (ev.event_date ? [ev.event_date] : []);
  return list.map((d) => {
    const dt = parseLocalDate(d);
    return dt ? dt.toLocaleString('ja-JP') : String(d);
  });
};

const filteredParticipants = computed(() => {
  const term = searchTerm.value.toLowerCase();
  const filtered = participants.value.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.university || '').toLowerCase().includes(term)
  );
  if (!sortField.value) return filtered;
  return [...filtered].sort((a, b) => {
    const aOrder = STATUS_ORDER[a.status] ?? 99;
    const bOrder = STATUS_ORDER[b.status] ?? 99;
    return sortOrder.value === 'asc' ? aOrder - bOrder : bOrder - aOrder;
  });
});

const statusBadge = (status: string) => {
  switch (status) {
    case 'A_ENTRY':
      return 'bg-blue-100 text-blue-700';
    case 'B_WAITING':
      return 'bg-amber-100 text-amber-700';
    case 'C_WAITING':
      return 'bg-purple-100 text-purple-700';
    case 'XA_CANCEL':
      return 'bg-red-100 text-red-700';
    case 'D_PASS':
      return 'bg-green-100 text-green-700';
    case 'E_FAIL':
      return 'bg-red-100 text-red-700';
    case 'attended':
      return 'bg-green-100 text-green-700';
    case 'registered':
      return 'bg-blue-100 text-blue-700';
    case 'canceled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'A_ENTRY':
      return 'A:エントリー';
    case 'B_WAITING':
      return 'B:回答待ち';
    case 'C_WAITING':
      return 'C:回答待ち';
    case 'XA_CANCEL':
      return 'XA:エントリーキャンセル';
    case 'D_PASS':
      return 'D:合格';
    case 'E_FAIL':
      return 'E:不合格';
    case 'attended':
      return '出席';
    case 'registered':
      return '申込';
    case 'canceled':
      return 'キャンセル';
    default:
      return status || '-';
  }
};

const formatDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
  
  if (event.value?.event_slots) {
    const pad = (n: number) => String(n).padStart(2, '0');
    // タイムゾーンの差異を考慮せず、単純に日時文字列で比較
    const matchStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const slot = event.value.event_slots.find(s => s.datetime.startsWith(matchStr));
    if (slot) {
      return formatEventSlot(slot.datetime, slot.location);
    }
  }
  return dateStr;
};

const downloadCSV = () => {
  const headers = ['氏名', '大学', '担当', '申込日', '参加日程', 'ステータス'];
  const rows = filteredParticipants.value.map(p => [
    p.name,
    p.university || '-',
    p.staff_name || '-',
    formatDateKey(p.created_at),
    formatDateKey(p.selected_event_date),
    statusLabel(p.status)
  ]);
  
  const csvContent = [headers.join(',')]
    .concat(rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')))
    .join('\n');
    
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${event.value?.title || 'event'}_participants.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(fetchDetail);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="flex items-center justify-between mb-6">
        <button @click="router.push('/projects')" class="text-gray-600 hover:text-gray-900 flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          一覧に戻る
        </button>
      </div>

      <div v-if="!event" class="text-gray-500">イベントが見つかりませんでした。</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sidebar - Event Info -->
        <div class="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-2">
            <h1 class="text-2xl font-bold text-gray-900">{{ event.title }}</h1>
            <button
               class="px-4 py-2 text-base md:text-sm min-h-[44px] border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0 ml-4"
               @click="isEditing = !isEditing"
             >
               {{ isEditing ? '編集を閉じる' : 'イベント編集' }}
             </button>
          </div>
          
          <div class="flex items-center gap-2 mb-4">
            <span v-if="event.type === 'agent_interview'" class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
              エージェント面談
            </span>
            <span v-else class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
              イベント
            </span>
            <span v-if="event.graduation_year" class="px-2 py-0.5 border border-indigo-200 text-indigo-600 text-xs font-bold rounded">
              {{ event.graduation_year }}卒
            </span>
          </div>

          <div class="space-y-3 mb-4">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <Calendar class="w-4 h-4" />
              <div>
                <p v-for="(dt, idx) in displayEventDates(event)" :key="`detail-date-${idx}`">{{ dt }}</p>
                <p v-if="displayEventDates(event).length === 0">未定</p>
              </div>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <Calendar class="w-4 h-4" />
              <span>エントリー期日: {{ event.entry_deadline ? new Date(event.entry_deadline).toLocaleString('ja-JP') : '未設定' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <MapPin class="w-4 h-4" />
              <span>{{ event.location || '会場未設定' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <UsersIcon class="w-4 h-4" />
              <span>エントリー目標人数: {{ event.capacity || '-' }}名</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <UsersIcon class="w-4 h-4" />
              <span>着座目標人数: {{ event.target_seats || '-' }}名</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="font-medium">単価:</span>
              <span>{{ (event.unit_price || 0).toLocaleString() }}円</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="font-medium">LP:</span>
              <a
                v-if="event.lp_url"
                :href="event.lp_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-700 break-all"
              >
                {{ event.lp_url }}
              </a>
              <span v-else>-</span>
            </div>
          </div>

          <!-- Description Section -->
          <div v-if="event.description" class="mt-6 pt-6 border-t border-gray-100">
            <h3 class="text-sm font-bold text-gray-900 mb-2">イベント概要</h3>
            <p class="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{{ event.description }}</p>
          </div>

          <div v-if="saveMessage" class="text-xs text-green-600 mt-4 mb-2">{{ saveMessage }}</div>

          <!-- Edit Form -->
          <div v-if="isEditing" class="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">イベント名</label>
              <input v-model="form.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
            </div>
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-1">イベント種別</label>
                <select v-model="form.type" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                  <option value="event">イベント</option>
                  <option value="agent_interview">エージェント面談</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-1">対象卒年（任意）</label>
                <input v-model="form.graduation_year" type="number" placeholder="例: 2026" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">開催日時・場所・備考</label>
              <div class="space-y-2">
                <div v-for="(slot, idx) in form.event_slots" :key="`edit-event-slot-${idx}`" class="flex flex-col sm:flex-row gap-2 pb-2 border-b border-gray-100 sm:border-0 items-end sm:items-center">
                  <div class="flex-[2] w-full">
                    <input v-model="slot.datetime" type="datetime-local" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
                  </div>
                  <div class="flex-1 w-full">
                    <input v-model="slot.location" type="text" placeholder="場所" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
                  </div>
                  <div class="flex-1 w-full">
                    <input v-model="slot.note" type="text" placeholder="備考" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
                  </div>
                  <button type="button" class="px-4 py-2 text-base md:text-sm min-h-[44px] hover:bg-gray-50 text-red-600 whitespace-nowrap" @click="removeSlot(idx)">削除</button>
                </div>
                <button type="button" class="px-3 py-2 border border-blue-200 text-blue-700 rounded-lg text-xs hover:bg-blue-50" @click="addSlot">日程追加</button>
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">場所（オンライン/会場）</label>
              <input v-model="form.location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">LPリンク</label>
              <input v-model="form.lp_url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">概要</label>
              <textarea v-model="form.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm h-24"></textarea>
            </div>
            <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-base md:text-sm hover:bg-blue-700" @click="updateEvent">
              保存
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- KPI Summary Card -->
          <div v-if="kgiData" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">KPIサマリー</span>
              <button @click="router.push({ path: '/kpi', query: { eventId: eventId } })" class="text-[10px] font-bold text-blue-600 hover:underline">
                KPI詳細を見る &rarr;
              </button>
            </div>
            <div class="p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-center">
              <!-- Mini Funnel -->
              <div class="flex items-center gap-1 sm:gap-2">
                <div class="flex flex-col items-center">
                  <div class="w-16 h-12 bg-indigo-50 border border-indigo-100 rounded flex flex-col items-center justify-center">
                    <span class="text-[10px] text-indigo-400 font-bold">エントリー</span>
                    <span class="text-sm font-black text-indigo-700">{{ kgiData.current_entry }}</span>
                  </div>
                </div>
                <span class="text-gray-300 text-sm">&rarr;</span>
                <div class="flex flex-col items-center">
                  <div class="w-16 h-12 bg-blue-600 border border-blue-700 rounded flex flex-col items-center justify-center">
                    <span class="text-[10px] text-blue-100 font-bold">着座</span>
                    <span class="text-sm font-black text-white">{{ kgiData.current_seats }}</span>
                  </div>
                </div>
              </div>

              <!-- Metrics Summary -->
              <div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                <div class="text-center md:text-left">
                  <p class="text-[10px] font-bold text-gray-400 mb-0.5">残日数</p>
                  <p class="text-xl font-black text-gray-700">{{ Math.max(kgiData.days_remaining, 0) }}<span class="text-[10px] ml-0.5">日</span></p>
                </div>
                <div class="text-center md:text-left">
                  <p class="text-[10px] font-bold text-gray-400 mb-0.5">エントリー / 目標</p>
                  <p class="text-xl font-black text-indigo-700">
                    {{ kgiData.current_entry }}<span class="text-sm text-gray-300 font-normal mx-1">/</span>{{ kgiData.kpi_target_entry }}
                  </p>
                </div>
                <div class="text-center md:text-left">
                  <p class="text-[10px] font-bold text-gray-400 mb-0.5">着座 / 目標</p>
                  <p class="text-xl font-black text-blue-700">
                    {{ kgiData.current_seats }}<span class="text-sm text-gray-300 font-normal mx-1">/</span>{{ kgiData.target_seats }}
                  </p>
                </div>
                <div class="text-center md:text-left">
                  <p class="text-[10px] font-bold text-gray-400 mb-0.5">エントリー乖離</p>
                  <p class="text-xl font-black" :class="(kgiData.current_entry - kgiData.kpi_target_entry) >= 0 ? 'text-green-600' : 'text-red-500'">
                    {{ (kgiData.current_entry - kgiData.kpi_target_entry) >= 0 ? '+' : '' }}{{ kgiData.current_entry - kgiData.kpi_target_entry }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Participants List -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 class="text-lg font-bold text-gray-900">参加学生一覧</h2>
              <div class="flex items-center gap-3 w-full sm:w-auto">
                <div class="relative flex-1 sm:w-64">
                  <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    v-model="searchTerm"
                    type="text"
                    placeholder="学生名で検索..."
                    class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  @click="downloadCSV"
                  class="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-gray-50 border border-gray-200 rounded-lg text-base md:text-sm font-medium text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                  title="CSVダウンロード"
                >
                  <Download class="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
            
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <span class="text-xs text-gray-500">ステータス操作: 氏名の右側のステータスをクリックして変更できます</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm table-fixed">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">氏名</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">大学</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">担当</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">申込日</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-36">参加日程</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">ステータス</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="p in filteredParticipants" :key="p.id || p.student_id" class="hover:bg-gray-50">
                    <td class="px-4 py-3 truncate">
                      <button class="text-blue-600 hover:text-blue-800" @click="router.push(`/students/${p.student_id}`)">
                        {{ p.name }}
                      </button>
                    </td>
                    <td class="px-4 py-3 text-gray-600 truncate">{{ p.university || '-' }}</td>
                    <td class="px-4 py-3 text-gray-600 truncate">{{ p.staff_name || '-' }}</td>
                    <td class="px-4 py-3 text-gray-600 truncate">{{ formatDateKey(p.created_at) }}</td>
                    <td class="px-4 py-3 text-gray-900 font-medium">{{ formatDateKey(p.selected_event_date) }}</td>
                    <td class="px-4 py-3">
                      <span
                        class="text-xs font-bold px-2 py-1 rounded-full border"
                        :class="getStatusBadgeClass(p.status)"
                      >{{ getStatusLabel(p.status) }}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button @click="router.push(`/students/${p.student_id}`)" class="text-xs text-blue-600 hover:underline">詳細</button>
                    </td>
                  </tr>
                  <tr v-if="filteredParticipants.length === 0">
                    <td colspan="7" class="px-4 py-10 text-center text-gray-400">参加者は見つかりませんでした。</td>
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
