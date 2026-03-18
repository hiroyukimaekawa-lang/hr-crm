<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Layout from '../components/Layout.vue';
import { api } from '../lib/api';

interface SourceCategory {
  id: number;
  name: string;
  created_at: string;
}

interface GraduationYearCategory {
  id: number;
  year: number;
  created_at: string;
}

interface EventItem {
  id: number;
  title: string;
  target_seats?: number | null;
  kpi_seat_to_entry_rate?: number | null;
  kpi_entry_to_interview_rate?: number | null;
  kpi_interview_to_inflow_rate?: number | null;
  kpi_inflow_to_reservation_rate?: number | null;
  kpi_custom_steps?: string | null;
  yomi_statuses?: string | string[] | null;
  entry_deadline?: string | null;
  capacity?: number | null;
  unit_price?: number | null;
  target_sales?: number | null;
  current_sales?: number | null;
}

interface KpiCustomStep {
  label: string;
  rate: number;
  // position: 固定ステップ間の挿入位置
  // 1 = 着座→エントリーの間
  // 2 = エントリー→面談の間
  // 3 = 面談→流入数の間
  // 4 = 流入数の後
  position: number;
}

const user = JSON.parse(localStorage.getItem('user') || '{"role":"staff"}');
const activeSection = ref<'categories' | 'invite' | 'event-kpi' | 'event-status'>('categories');
const categories = ref<SourceCategory[]>([]);
const graduationYearCategories = ref<GraduationYearCategory[]>([]);
const newCategoryName = ref('');
const newGraduationYear = ref('');
const message = ref('');
const inviteUrl = ref('');
const inviteMessage = ref('');
const events = ref<EventItem[]>([]);
const selectedEventId = ref<number | null>(null);
const saveMessage = ref('');
const loading = ref(false);
const form = ref({
  target_seats: '',
  seat_to_entry_rate: '70',
  entry_to_interview_rate: '60',
  interview_to_inflow_rate: '50',
  inflow_to_reservation_rate: '50',
  entry_deadline: '',
  capacity: '',
  unit_price: '',
  target_sales: '',
  current_sales: ''
});
const customSteps = ref<KpiCustomStep[]>([]);

const eventStatuses = ref<string[]>([]);
const selectedStatusEventId = ref<number | null>(null);
const statusSaveMessage = ref('');

const STATUS_LABEL_MAP: Record<string, string> = {
  A_ENTRY: 'A:エントリー',
  B_WAITING: 'B:回答待ち',
  C_WAITING: 'C:回答待ち',
  attended: '出席',
  D_PASS: 'D:合格',
  E_FAIL: 'E:不合格',
  XA_CANCEL: 'XA:エントリーキャンセル'
};

const newStatusInput = ref('');

const fetchCategories = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/source-categories', { headers: { Authorization: token } });
  categories.value = Array.isArray(res.data) ? res.data : [];
};

const fetchGraduationYearCategories = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/graduation-year-categories', { headers: { Authorization: token } });
  graduationYearCategories.value = Array.isArray(res.data) ? res.data : [];
};

const addCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  const token = localStorage.getItem('token');
  await api.post('/api/students/source-categories', { name: newCategoryName.value.trim() }, { headers: { Authorization: token } });
  newCategoryName.value = '';
  message.value = '流入経路カテゴリを保存しました。';
  await fetchCategories();
};

const deleteCategory = async (id: number) => {
  if (!confirm('このカテゴリを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/source-categories/${id}`, { headers: { Authorization: token } });
  message.value = 'カテゴリを削除しました。';
  await fetchCategories();
};

const addGraduationYearCategory = async () => {
  const year = Number(newGraduationYear.value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
  const token = localStorage.getItem('token');
  await api.post('/api/students/graduation-year-categories', { year }, { headers: { Authorization: token } });
  newGraduationYear.value = '';
  message.value = '卒業年度カテゴリを保存しました。';
  await fetchGraduationYearCategories();
};

const deleteGraduationYearCategory = async (id: number) => {
  if (!confirm('この卒業年度カテゴリを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/graduation-year-categories/${id}`, { headers: { Authorization: token } });
  message.value = '卒業年度カテゴリを削除しました。';
  await fetchGraduationYearCategories();
};

const createInvite = async () => {
  try {
    inviteMessage.value = '';
    const token = localStorage.getItem('token');
    const res = await api.post('/api/auth/invite', {}, { headers: { Authorization: token } });
    inviteUrl.value = String(res.data?.invite_url || '');
  } catch {
    inviteMessage.value = '招待URLの発行に失敗しました。';
  }
};

const copyInvite = async () => {
  if (!inviteUrl.value) return;
  await navigator.clipboard.writeText(inviteUrl.value);
  inviteMessage.value = 'コピーしました。';
};

const selectedEvent = computed(() => events.value.find((e) => e.id === selectedEventId.value) || null);

const toRate = (v: string | number) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n > 100) return 100;
  return n;
};

// 固定ステップのラベル定数
const FIXED_STEP_LABELS = ['着座', 'エントリー', '面談', '設定数（流入数）'];

// 挿入位置の選択肢
const POSITION_OPTIONS = [
  { value: 1, label: '着座 ↔ エントリーの間' },
  { value: 2, label: 'エントリー ↔ 面談の間' },
  { value: 3, label: '面談 ↔ 流入数の間' },
  { value: 4, label: '流入数の後' }
];

const autoTargetSales = computed(() => {
  const seats = Number(form.value.target_seats || 0);
  const price = Number(form.value.unit_price || 0);
  return seats > 0 && price > 0 ? seats * price : null;
});

const derived = computed(() => {
  const seat = Math.max(0, Number(form.value.target_seats || 0));
  const seatToEntry = toRate(form.value.seat_to_entry_rate) / 100;
  const entryToInterview = toRate(form.value.entry_to_interview_rate) / 100;
  const interviewToInflow = toRate(form.value.interview_to_inflow_rate) / 100;
  const inflowToReservation = toRate(form.value.inflow_to_reservation_rate) / 100;

  // カスタムステップを挿入位置でグループ化
  const customByPos: Record<number, KpiCustomStep[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const s of customSteps.value) {
    const pos = s.position >= 1 && s.position <= 4 ? s.position : 4;
    if (!customByPos[pos]) customByPos[pos] = [];
    (customByPos[pos] as KpiCustomStep[]).push(s);
  }

  // 各固定ステップ間のカスタムステップを逆算に組み込む
  // pos=1: 着座 → (custom) → エントリー
  // pos=2: エントリー → (custom) → 面談
  // pos=3: 面談 → (custom) → 流入数
  // pos=4: 流入数 → (custom)
  const buildCustomChain = (posSteps: KpiCustomStep[], prevVal: number) => {
    const chain: Array<{ label: string; value: number; rate: number; position: number }> = [];
    let v = prevVal;
    for (const s of posSteps) {
      const r = toRate(s.rate) / 100;
      const val = v > 0 ? Math.ceil(v / r) : 0;
      chain.push({ label: s.label || '追加項目', value: val, rate: toRate(s.rate), position: s.position });
      v = val;
    }
    return { chain, last: v };
  };

  // 逆算: 着座が起点
  // pos1 カスタムを挟んでエントリーへ
  const { chain: pos1Chain, last: afterPos1 } = buildCustomChain(customByPos[1] ?? [], seat);
  const entry = afterPos1 > 0 ? Math.ceil(afterPos1 / seatToEntry) : 0;

  // pos2 カスタムを挟んで面談へ
  const { chain: pos2Chain, last: afterPos2 } = buildCustomChain(customByPos[2] ?? [], entry);
  const interview = afterPos2 > 0 ? Math.ceil(afterPos2 / entryToInterview) : 0;

  // pos3 カスタムを挟んで流入数へ
  const { chain: pos3Chain, last: afterPos3 } = buildCustomChain(customByPos[3] ?? [], interview);
  const inflow = afterPos3 > 0 ? Math.ceil(afterPos3 / interviewToInflow) : 0;

  // pos4 カスタム（流入数の後）
  const { chain: pos4Chain } = buildCustomChain(customByPos[4] ?? [], inflow);

  return {
    seat,
    entry,
    interview,
    inflow,
    pos1Chain,
    pos2Chain,
    pos3Chain,
    pos4Chain,
    seatToEntryRate: toRate(form.value.seat_to_entry_rate),
    entryToInterviewRate: toRate(form.value.entry_to_interview_rate),
    interviewToInflowRate: toRate(form.value.interview_to_inflow_rate)
  };
});

const parseCustomSteps = (raw: string | null | undefined): KpiCustomStep[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        label: String(x?.label || ''),
        rate: Number(x?.rate || 0),
        position: Number(x?.position || 4)
      }))
      .filter((x) => x.label || x.rate > 0);
  } catch {
    return [];
  }
};

const loadEventToForm = (event: EventItem | null) => {
  if (!event) return;
  form.value.target_seats = event.target_seats ? String(event.target_seats) : '';
  form.value.seat_to_entry_rate = String(Number(event.kpi_seat_to_entry_rate ?? 70));
  form.value.entry_to_interview_rate = String(Number(event.kpi_entry_to_interview_rate ?? 60));
  form.value.interview_to_inflow_rate = String(Number(event.kpi_interview_to_inflow_rate ?? 50));
  form.value.inflow_to_reservation_rate = String(Number(event.kpi_inflow_to_reservation_rate ?? 50));
  form.value.entry_deadline = event.entry_deadline ? event.entry_deadline.slice(0, 10) : '';
  form.value.capacity = event.capacity ? String(event.capacity) : '';
  form.value.unit_price = event.unit_price ? String(event.unit_price) : '';
  form.value.target_sales = event.target_sales ? String(event.target_sales) : '';
  form.value.current_sales = event.current_sales ? String(event.current_sales) : '';
  customSteps.value = parseCustomSteps(event.kpi_custom_steps);
};

const fetchEvents = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/events', { headers: { Authorization: token } });
    events.value = Array.isArray(res.data) ? res.data : [];
    if (!selectedEventId.value && events.value.length > 0) {
      const first = events.value[0];
      if (first) {
        selectedEventId.value = first.id;
        loadEventToForm(first);
      }
    }
  } finally {
    loading.value = false;
  }
};

const onSelectEvent = () => {
  const event = selectedEvent.value;
  if (event) {
    form.value.target_seats = event.target_seats ? String(event.target_seats) : '';
    form.value.seat_to_entry_rate = String(Number(event.kpi_seat_to_entry_rate ?? 70));
    form.value.entry_to_interview_rate = String(Number(event.kpi_entry_to_interview_rate ?? 60));
    form.value.interview_to_inflow_rate = String(Number(event.kpi_interview_to_inflow_rate ?? 50));
    form.value.inflow_to_reservation_rate = String(Number(event.kpi_inflow_to_reservation_rate ?? 50));
    form.value.entry_deadline = event.entry_deadline ? event.entry_deadline.slice(0, 10) : '';
    form.value.capacity = event.capacity ? String(event.capacity) : '';
    form.value.unit_price = event.unit_price ? String(event.unit_price) : '';
    form.value.target_sales = event.target_sales ? String(event.target_sales) : '';
    form.value.current_sales = event.current_sales ? String(event.current_sales) : '';
    customSteps.value = parseCustomSteps(event.kpi_custom_steps);
  }
  saveMessage.value = '';
};

const addCustomStep = () => {
  customSteps.value.push({ label: '', rate: 50, position: 4 });
};

const applyTemplate = (type: 'simple' | 'extended') => {
  if (type === 'simple') {
    form.value.seat_to_entry_rate = '70';
    form.value.entry_to_interview_rate = '60';
    form.value.interview_to_inflow_rate = '50';
    form.value.inflow_to_reservation_rate = '50';
    customSteps.value = [];
  } else {
    // Beyond Challenge (Extended)
    form.value.seat_to_entry_rate = '70'; // エントリー -> 合格
    form.value.entry_to_interview_rate = '60'; // 面談 -> エントリー
    form.value.interview_to_inflow_rate = '50'; // 設定数 -> 面談
    customSteps.value = [
      { label: '面談②', rate: 70, position: 1 },
      { label: '合格', rate: 80, position: 1 }
    ];
  }
};

const removeCustomStep = (index: number) => {
  customSteps.value.splice(index, 1);
};

const saveKpi = async () => {
  if (!selectedEvent.value) return;
  const token = localStorage.getItem('token');
  await api.put(
    `/api/events/${selectedEvent.value.id}`,
    {
      title: selectedEvent.value.title,
      target_seats: form.value.target_seats ? Number(form.value.target_seats) : null,
      kpi_seat_to_entry_rate: toRate(form.value.seat_to_entry_rate),
      kpi_entry_to_interview_rate: toRate(form.value.entry_to_interview_rate),
      kpi_interview_to_inflow_rate: toRate(form.value.interview_to_inflow_rate),
      kpi_inflow_to_reservation_rate: toRate(form.value.inflow_to_reservation_rate),
      entry_deadline: form.value.entry_deadline || null,
      capacity: form.value.capacity ? Number(form.value.capacity) : null,
      unit_price: form.value.unit_price ? Number(form.value.unit_price) : null,
      target_sales: form.value.target_sales ? Number(form.value.target_sales) : autoTargetSales.value,
      current_sales: form.value.current_sales ? Number(form.value.current_sales) : null,
      kpi_custom_steps: customSteps.value
        .filter((x) => String(x.label || '').trim())
        .map((x) => ({ label: String(x.label).trim(), rate: toRate(x.rate), position: Number(x.position || 4) }))
    },
    { headers: { Authorization: token } }
  );
  saveMessage.value = 'KPI設定を保存しました。';
  await fetchEvents();
};

const loadEventStatuses = (event: EventItem | null) => {
  if (!event) return;
  try {
    const raw = event.yomi_statuses || '["A_ENTRY","B_WAITING","C_WAITING","D_PASS","E_FAIL","XA_CANCEL"]';
    eventStatuses.value = Array.isArray(raw) ? raw : JSON.parse(String(raw));
  } catch { eventStatuses.value = []; }
};

const saveEventStatuses = async () => {
  if (!selectedStatusEventId.value) return;
  const token = localStorage.getItem('token');
  const event = events.value.find(e => e.id === selectedStatusEventId.value);
  if (!event) return;
  await api.put(
    `/api/events/${selectedStatusEventId.value}`,
    { title: event.title, yomi_statuses: eventStatuses.value },
    { headers: { Authorization: token } }
  );
  statusSaveMessage.value = 'イベントステータスを保存しました。';
  await fetchEvents();
};

onMounted(async () => {
  await fetchCategories();
  await fetchGraduationYearCategories();
  await fetchEvents();
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">設定</h1>
      <p class="text-sm text-gray-500 mb-6">上部ボタンから各種設定カテゴリを切り替えできます。</p>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-6">
        <div class="flex flex-wrap gap-2">
          <button class="px-4 py-2 rounded-lg border text-sm" :class="activeSection === 'categories' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'" @click="activeSection = 'categories'">流入経路カテゴリ登録</button>
          <button class="px-4 py-2 rounded-lg border text-sm" :class="activeSection === 'invite' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'" @click="activeSection = 'invite'">担当者招待URL</button>
          <button class="px-4 py-2 rounded-lg border text-sm" :class="activeSection === 'event-kpi' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'" @click="activeSection = 'event-kpi'">イベントKPI</button>
          <button class="px-4 py-2 rounded-lg border text-sm" :class="activeSection === 'event-status' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'" @click="activeSection = 'event-status'">イベントステータス登録</button>
        </div>
      </div>

      <div v-if="activeSection === 'categories'" class="space-y-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">流入経路カテゴリ登録</h2>
          <p v-if="user.role !== 'admin'" class="text-sm text-gray-500">閲覧のみ可能です（管理者のみ追加・削除可能）。</p>
          <div class="flex gap-2 max-w-xl">
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="例: オービック"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              :disabled="user.role !== 'admin'"
            />
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              :disabled="user.role !== 'admin'"
              @click="addCategory"
            >
              追加
            </button>
          </div>
          <p v-if="message" class="text-sm text-green-600 mt-2">{{ message }}</p>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">登録済みカテゴリ</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ名</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="c in categories" :key="c.id">
                  <td class="px-3 py-2 text-gray-900">{{ c.name }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ new Date(c.created_at).toLocaleDateString('ja-JP') }}</td>
                  <td class="px-3 py-2 text-right">
                    <button
                      class="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      :disabled="user.role !== 'admin'"
                      @click="deleteCategory(c.id)"
                    >
                      削除
                    </button>
                  </td>
                </tr>
                <tr v-if="categories.length === 0">
                  <td colSpan="3" class="px-3 py-8 text-center text-gray-400">カテゴリが未登録です。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">卒業年度カテゴリ登録</h2>
          <p v-if="user.role !== 'admin'" class="text-sm text-gray-500">閲覧のみ可能です（管理者のみ追加・削除可能）。</p>
          <div class="flex gap-2 max-w-xl">
            <input
              v-model="newGraduationYear"
              type="number"
              min="2000"
              max="2100"
              placeholder="例: 2027"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              :disabled="user.role !== 'admin'"
            />
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              :disabled="user.role !== 'admin'"
              @click="addGraduationYearCategory"
            >
              追加
            </button>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">登録済み卒業年度</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">卒業年度</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="g in graduationYearCategories" :key="g.id">
                  <td class="px-3 py-2 text-gray-900">{{ g.year }}年</td>
                  <td class="px-3 py-2 text-gray-600">{{ new Date(g.created_at).toLocaleDateString('ja-JP') }}</td>
                  <td class="px-3 py-2 text-right">
                    <button
                      class="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      :disabled="user.role !== 'admin'"
                      @click="deleteGraduationYearCategory(g.id)"
                    >
                      削除
                    </button>
                  </td>
                </tr>
                <tr v-if="graduationYearCategories.length === 0">
                  <td colSpan="3" class="px-3 py-8 text-center text-gray-400">卒業年度が未登録です。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-else-if="activeSection === 'invite'" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">担当者招待URL</h2>
        <p v-if="user.role !== 'admin'" class="text-sm text-gray-500">管理者のみ操作できます。</p>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            :disabled="user.role !== 'admin'"
            @click="createInvite"
          >
            発行
          </button>
        </div>
        <div v-if="inviteUrl" class="flex flex-col md:flex-row items-start md:items-center gap-2">
          <input :value="inviteUrl" readonly class="w-full md:flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button class="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" @click="copyInvite">コピー</button>
        </div>
        <p v-if="inviteMessage" class="text-sm text-gray-600 mt-2">{{ inviteMessage }}</p>
      </div>

      <div v-else-if="activeSection === 'event-kpi'" class="space-y-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">イベントKPI</h2>
          <p class="text-sm text-gray-500 mb-4">目標着座数から逆算して、必要なエントリー/面談/流入数を自動計算します。</p>
          
          <!-- ── 売上・目標設定セクション ── -->
          <div class="space-y-4 mb-6 pb-6 border-b border-gray-200">
            <h3 class="text-sm font-bold text-gray-700">売上・目標設定</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- エントリー期日 -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  エントリー期日
                </label>
                <input
                  v-model="form.entry_deadline"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <!-- エントリー目標人数 -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  エントリー目標人数
                </label>
                <input
                  v-model="form.capacity"
                  type="number"
                  min="0"
                  placeholder="例: 21"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <!-- 着座目標人数（既存） -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  着座目標人数
                </label>
                <input
                  v-model="form.target_seats"
                  type="number"
                  min="0"
                  placeholder="例: 5"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <!-- 単価 -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  単価（円）
                </label>
                <input
                  v-model="form.unit_price"
                  type="number"
                  min="0"
                  placeholder="例: 19000"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <!-- 目標売上（自動計算 or 手動） -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  目標売上（円）
                  <span v-if="autoTargetSales" class="text-xs text-blue-500 ml-1">
                    ※ 単価 × 着座目標 = {{ autoTargetSales.toLocaleString() }}円 で自動計算
                  </span>
                </label>
                <input
                  v-model="form.target_sales"
                  type="number"
                  min="0"
                  :placeholder="autoTargetSales ? String(autoTargetSales) : '例: 95000'"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <!-- 実績売上 -->
              <div>
                <label class="text-xs font-semibold text-gray-600 block mb-1">
                  実績売上（円）
                </label>
                <input
                  v-model="form.current_sales"
                  type="number"
                  min="0"
                  placeholder="例: 38000"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">対象イベント</label>
              <select v-model.number="selectedEventId" class="w-full px-3 py-2 border border-gray-300 rounded-lg" @change="onSelectEvent">
                <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
              </select>
            </div>
            <div>
              <!-- 目標着座数は売上設定セクションに移動したが、互換性のため残すか、削除するか。
                   指示書ではUIの構成が変更されているので、ここからは削除する。 -->
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">エントリー→イベント出席率（%）</label>
              <input v-model="form.seat_to_entry_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">面談→エントリー率（%）</label>
              <input v-model="form.entry_to_interview_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">面談予約→面談出席率（%）</label>
              <input v-model="form.interview_to_inflow_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">流入→面談予約率（%）</label>
              <input v-model="form.inflow_to_reservation_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div class="mt-6 border-t border-gray-100 pt-4">
            <p class="text-sm font-semibold text-gray-800 mb-3">テンプレートから設定</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                class="p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-left group"
                @click="applyTemplate('simple')"
              >
                <p class="font-bold text-gray-900 group-hover:text-blue-700">ジョブハントHR team（シンプル版）</p>
                <p class="text-xs text-gray-500 mt-1">面談 → エントリー → 着座 の基本フロー</p>
              </button>
              <button
                class="p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-left group"
                @click="applyTemplate('extended')"
              >
                <p class="font-bold text-gray-900 group-hover:text-blue-700">Beyond Challenge（拡張版）</p>
                <p class="text-xs text-gray-500 mt-1">合格、面談② を含む詳細フロー</p>
              </button>
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-gray-800">追加項目（イベント別）</p>
              <button class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="addCustomStep">項目追加</button>
            </div>
            <div class="space-y-2">
              <div v-for="(step, idx) in customSteps" :key="`custom-${idx}`" class="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_70px] gap-2 items-center">
                <input v-model="step.label" type="text" placeholder="項目名（例: 選考）" class="px-3 py-2 border border-gray-300 rounded-lg" />
                <select v-model.number="step.position" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option v-for="opt in POSITION_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <input v-model.number="step.rate" type="number" min="1" max="100" placeholder="前段階比(%)" class="px-3 py-2 border border-gray-300 rounded-lg" />
                <button class="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50" @click="removeCustomStep(idx)">削除</button>
              </div>
            </div>
          </div>

          <div class="mt-5">
            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="saveKpi">保存</button>
            <span v-if="saveMessage" class="ml-3 text-sm text-green-600">{{ saveMessage }}</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">逆算結果</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-3 py-2 text-left">項目</th>
                  <th class="px-3 py-2 text-left">必要数</th>
                  <th class="px-3 py-2 text-left">割合</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr class="bg-indigo-50">
                  <td class="px-3 py-2 font-medium text-indigo-800">着座数</td>
                  <td class="px-3 py-2 font-semibold text-indigo-900">{{ derived.seat }}</td>
                  <td class="px-3 py-2 text-indigo-600">-</td>
                </tr>
                <!-- pos1: 着座 ↔ エントリーの間のカスタムステップ -->
                <tr v-for="(x, idx) in derived.pos1Chain" :key="`p1-${idx}`" class="bg-orange-50">
                  <td class="px-3 py-2 text-orange-800 pl-6">└ {{ x.label }}</td>
                  <td class="px-3 py-2 font-semibold text-orange-900">{{ x.value }}</td>
                  <td class="px-3 py-2 text-orange-600">{{ x.rate }}%</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">エントリー数</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.entry }}</td>
                  <td class="px-3 py-2">{{ derived.seatToEntryRate }}%</td>
                </tr>
                <!-- pos2: エントリー ↔ 面談の間のカスタムステップ -->
                <tr v-for="(x, idx) in derived.pos2Chain" :key="`p2-${idx}`" class="bg-orange-50">
                  <td class="px-3 py-2 text-orange-800 pl-6">└ {{ x.label }}</td>
                  <td class="px-3 py-2 font-semibold text-orange-900">{{ x.value }}</td>
                  <td class="px-3 py-2 text-orange-600">{{ x.rate }}%</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">面談数</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.interview }}</td>
                  <td class="px-3 py-2">{{ derived.entryToInterviewRate }}%</td>
                </tr>
                <!-- pos3: 面談 ↔ 流入数の間のカスタムステップ -->
                <tr v-for="(x, idx) in derived.pos3Chain" :key="`p3-${idx}`" class="bg-orange-50">
                  <td class="px-3 py-2 text-orange-800 pl-6">└ {{ x.label }}</td>
                  <td class="px-3 py-2 font-semibold text-orange-900">{{ x.value }}</td>
                  <td class="px-3 py-2 text-orange-600">{{ x.rate }}%</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">設定数（流入数）</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.inflow }}</td>
                  <td class="px-3 py-2">{{ derived.interviewToInflowRate }}%</td>
                </tr>
                <!-- pos4: 流入数の後のカスタムステップ -->
                <tr v-for="(x, idx) in derived.pos4Chain" :key="`p4-${idx}`" class="bg-orange-50">
                  <td class="px-3 py-2 text-orange-800 pl-6">└ {{ x.label }}</td>
                  <td class="px-3 py-2 font-semibold text-orange-900">{{ x.value }}</td>
                  <td class="px-3 py-2 text-orange-600">{{ x.rate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="loading" class="text-sm text-gray-500 mt-3">読み込み中...</p>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">イベントステータス登録</h2>
          <p class="text-sm text-gray-500 mb-4">イベントごとに表示・使用するステータスを管理します。</p>
          <div class="mb-4">
            <label class="block text-sm text-gray-600 mb-1">対象イベント</label>
            <select
              v-model.number="selectedStatusEventId"
              class="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg"
              @change="() => { const ev = events.find(e => e.id === selectedStatusEventId); loadEventStatuses(ev || null); statusSaveMessage = ''; }"
            >
              <option :value="null">-- イベントを選択 --</option>
              <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
            </select>
          </div>
          <div v-if="selectedStatusEventId">
            <p class="text-sm font-semibold text-gray-700 mb-2">現在のステータス一覧</p>
            <div class="space-y-2 mb-4">
              <div v-for="(st, idx) in eventStatuses" :key="`status-${idx}`" class="flex items-center gap-2">
                <span class="px-3 py-1.5 rounded border border-gray-200 bg-gray-50 text-sm flex-1">
                  {{ STATUS_LABEL_MAP[st] || st }}
                  <span class="text-xs text-gray-400 ml-1">({{ st }})</span>
                </span>
                <button
                  class="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  @click="eventStatuses.splice(idx, 1)"
                >削除</button>
              </div>
              <p v-if="eventStatuses.length === 0" class="text-xs text-gray-400">ステータスが設定されていません。</p>
            </div>
            <div class="flex gap-2 max-w-md mb-4">
              <input
                v-model="newStatusInput"
                type="text"
                placeholder="カスタムステータスを追加（例: D_PASS）"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                class="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                @click="() => { if (newStatusInput.trim()) { eventStatuses.push(newStatusInput.trim()); newStatusInput = ''; } }"
              >追加</button>
            </div>
            <div class="flex items-center gap-3">
              <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm" @click="saveEventStatuses">保存</button>
              <span v-if="statusSaveMessage" class="text-sm text-green-600">{{ statusSaveMessage }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
