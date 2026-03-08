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
  kpi_custom_steps?: string | null;
}

interface KpiCustomStep {
  label: string;
  rate: number;
}

const user = JSON.parse(localStorage.getItem('user') || '{"role":"staff"}');
const activeSection = ref<'categories' | 'invite' | 'event-kpi'>('categories');
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
  interview_to_inflow_rate: '50'
});
const customSteps = ref<KpiCustomStep[]>([]);

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

const derived = computed(() => {
  const seat = Math.max(0, Number(form.value.target_seats || 0));
  const seatToEntry = toRate(form.value.seat_to_entry_rate) / 100;
  const entryToInterview = toRate(form.value.entry_to_interview_rate) / 100;
  const interviewToInflow = toRate(form.value.interview_to_inflow_rate) / 100;

  const entry = seat > 0 ? Math.ceil(seat / seatToEntry) : 0;
  const interview = entry > 0 ? Math.ceil(entry / entryToInterview) : 0;
  const inflow = interview > 0 ? Math.ceil(interview / interviewToInflow) : 0;

  const custom = [];
  let prev = inflow;
  for (const step of customSteps.value) {
    const rate = toRate(step.rate) / 100;
    const value = prev > 0 ? Math.ceil(prev / rate) : 0;
    custom.push({ label: step.label || '追加項目', value, rate: toRate(step.rate) });
    prev = value;
  }

  return { seat, entry, interview, inflow, custom };
});

const parseCustomSteps = (raw: string | null | undefined): KpiCustomStep[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({ label: String(x?.label || ''), rate: Number(x?.rate || 0) }))
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
  loadEventToForm(selectedEvent.value);
  saveMessage.value = '';
};

const addCustomStep = () => {
  customSteps.value.push({ label: '', rate: 50 });
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
      kpi_custom_steps: customSteps.value
        .filter((x) => String(x.label || '').trim())
        .map((x) => ({ label: String(x.label).trim(), rate: toRate(x.rate) }))
    },
    { headers: { Authorization: token } }
  );
  saveMessage.value = 'KPI設定を保存しました。';
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

      <div v-else class="space-y-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">イベントKPI</h2>
          <p class="text-sm text-gray-500 mb-4">目標着座数から逆算して、必要なエントリー/面談/流入数を自動計算します。</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">対象イベント</label>
              <select v-model.number="selectedEventId" class="w-full px-3 py-2 border border-gray-300 rounded-lg" @change="onSelectEvent">
                <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">目標着座数</label>
              <input v-model="form.target_seats" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">着座からのエントリー数割（%）</label>
              <input v-model="form.seat_to_entry_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">エントリーから面談化率（%）</label>
              <input v-model="form.entry_to_interview_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">面談から設定（流入）率（%）</label>
              <input v-model="form.interview_to_inflow_rate" type="number" min="1" max="100" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-gray-800">追加項目（イベント別）</p>
              <button class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="addCustomStep">項目追加</button>
            </div>
            <div class="space-y-2">
              <div v-for="(step, idx) in customSteps" :key="`custom-${idx}`" class="grid grid-cols-1 md:grid-cols-[1fr_140px_70px] gap-2">
                <input v-model="step.label" type="text" placeholder="項目名（例: 架電数）" class="px-3 py-2 border border-gray-300 rounded-lg" />
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
                <tr>
                  <td class="px-3 py-2">着座数</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.seat }}</td>
                  <td class="px-3 py-2">-</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">エントリー数</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.entry }}</td>
                  <td class="px-3 py-2">{{ toRate(form.seat_to_entry_rate) }}%</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">面談数</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.interview }}</td>
                  <td class="px-3 py-2">{{ toRate(form.entry_to_interview_rate) }}%</td>
                </tr>
                <tr>
                  <td class="px-3 py-2">設定数（流入数）</td>
                  <td class="px-3 py-2 font-semibold">{{ derived.inflow }}</td>
                  <td class="px-3 py-2">{{ toRate(form.interview_to_inflow_rate) }}%</td>
                </tr>
                <tr v-for="(x, idx) in derived.custom" :key="`result-${idx}`">
                  <td class="px-3 py-2">{{ x.label }}</td>
                  <td class="px-3 py-2 font-semibold">{{ x.value }}</td>
                  <td class="px-3 py-2">{{ x.rate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="loading" class="text-sm text-gray-500 mt-3">読み込み中...</p>
        </div>
      </div>
    </div>
  </Layout>
</template>
