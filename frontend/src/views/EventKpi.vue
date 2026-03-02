<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Layout from '../components/Layout.vue';
import { api } from '../lib/api';

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
  await api.put(`/api/events/${selectedEvent.value.id}`, {
    title: selectedEvent.value.title,
    target_seats: form.value.target_seats ? Number(form.value.target_seats) : null,
    kpi_seat_to_entry_rate: toRate(form.value.seat_to_entry_rate),
    kpi_entry_to_interview_rate: toRate(form.value.entry_to_interview_rate),
    kpi_interview_to_inflow_rate: toRate(form.value.interview_to_inflow_rate),
    kpi_custom_steps: customSteps.value
      .filter((x) => String(x.label || '').trim())
      .map((x) => ({ label: String(x.label).trim(), rate: toRate(x.rate) }))
  }, { headers: { Authorization: token } });
  saveMessage.value = 'KPI設定を保存しました。';
  await fetchEvents();
};

onMounted(fetchEvents);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">イベントKPI</h1>
        <p class="text-sm text-gray-500 mt-1">目標着座数から逆算して、必要なエントリー/面談/流入数を自動計算します。</p>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-4">
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

      <div class="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">逆算結果</h2>
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
      </div>

      <p v-if="loading" class="text-sm text-gray-500 mt-3">読み込み中...</p>
    </div>
  </Layout>
</template>
