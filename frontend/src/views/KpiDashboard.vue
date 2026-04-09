<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Layout from '../components/Layout.vue';
import {
  kpiApi,
  rateColor,
  rateBgColor,
  gapColor,
  formatCurrency,
  type KpiOverviewResponse,
  type EventKpiItem,
  type GoalSetting,
  type KpiMetric,
} from '../lib/kpi';
import {
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  Save,
  ChevronRight,
} from 'lucide-vue-next';

// ─── State ───

const activeTab = ref<'monthly' | 'daily' | 'weekly' | 'event' | 'staff' | 'source'>('monthly');
const loading = ref(false);
const saving = ref(false);
const showExpired = ref(false);
const selectedMonth = ref(new Date().toISOString().slice(0, 7));

const overview = ref<KpiOverviewResponse | null>(null);
const eventKpi = ref<EventKpiItem[]>([]);
const staffOverview = ref<any[]>([]);
const sourceOverview = ref<any[]>([]);

// Goal editing
const showGoalEditor = ref(false);
const goalForm = ref({
  sales_target: 0,
  required_seats: 0,
  required_entries: 0,
  required_interviews: 0,
  required_interview_settings: 0,
  required_inflow: 0,
  cvr_seat_to_entry: 70,
  cvr_entry_to_interview: 60,
  cvr_interview_to_setting: 50,
  cvr_inflow_to_setting: 40,
});

// ─── Month options ───

const monthOptions = computed(() => {
  const options: string[] = [];
  const now = new Date();
  for (let i = -2; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(d.toISOString().slice(0, 7));
  }
  return options;
});

// ─── Data fetching ───

const fetchOverview = async () => {
  loading.value = true;
  try {
    const res = await kpiApi.getOverview({ month: selectedMonth.value });
    overview.value = res.data;
  } catch (err) {
    console.error('KPI overview fetch error:', err);
  } finally {
    loading.value = false;
  }
};

const fetchEvents = async () => {
  try {
    const res = await kpiApi.getEvents();
    eventKpi.value = res.data;
  } catch (err) {
    console.error('KPI events fetch error:', err);
  }
};

const fetchStaffBreakdown = async () => {
  try {
    const res = await kpiApi.getOverview({ month: selectedMonth.value, group_by: 'staff' });
    staffOverview.value = res.data.perStaff || [];
  } catch (err) {
    console.error('KPI staff fetch error:', err);
  }
};

const fetchSourceBreakdown = async () => {
  try {
    const res = await kpiApi.getOverview({ month: selectedMonth.value, group_by: 'source' });
    sourceOverview.value = res.data.perSource || [];
  } catch (err) {
    console.error('KPI source fetch error:', err);
  }
};

const fetchGoals = async () => {
  try {
    const res = await kpiApi.getGoals({ scope_type: 'global', period_type: 'monthly', month: selectedMonth.value });
    const goals: GoalSetting[] = res.data;
    for (const g of goals) {
      if (g.metric_key in goalForm.value) {
        (goalForm.value as any)[g.metric_key] = Number(g.target_value);
      }
    }
  } catch (err) {
    console.error('KPI goals fetch error:', err);
  }
};

const saveGoals = async () => {
  saving.value = true;
  try {
    const goals: GoalSetting[] = Object.entries(goalForm.value).map(([key, value]) => ({
      scope_type: 'global',
      period_type: 'monthly',
      period_start: selectedMonth.value + '-01',
      metric_key: key,
      target_value: Number(value),
    }));
    await kpiApi.updateGoals(goals);
    showGoalEditor.value = false;
    await fetchOverview();
  } catch (err) {
    console.error('KPI goals save error:', err);
  } finally {
    saving.value = false;
  }
};

const loadAll = async () => {
  await Promise.all([fetchOverview(), fetchEvents(), fetchGoals()]);
};

watch(selectedMonth, () => {
  loadAll();
});

watch(activeTab, (tab) => {
  if (tab === 'staff' && staffOverview.value.length === 0) fetchStaffBreakdown();
  if (tab === 'source' && sourceOverview.value.length === 0) fetchSourceBreakdown();
});

onMounted(loadAll);

// ─── Computed helpers ───

const monthly = computed(() => overview.value?.monthly);
const daily = computed(() => overview.value?.daily);
const funnel = computed(() => overview.value?.funnel);

const activeEvents = computed(() =>
  eventKpi.value.filter(e => e.deadline && e.days_remaining >= -1)
);
const expiredEvents = computed(() =>
  eventKpi.value.filter(e => !e.deadline || e.days_remaining < -1)
);

const displayEvents = computed(() => {
  if (showExpired.value) {
    return [...eventKpi.value].sort((a, b) => {
      if (a.days_remaining >= -1 && b.days_remaining < -1) return -1;
      if (a.days_remaining < -1 && b.days_remaining >= -1) return 1;
      return (b.days_remaining || 0) - (a.days_remaining || 0);
    });
  }
  return activeEvents.value;
});

// Total event sales
const totalTargetSales = computed(() =>
  activeEvents.value.reduce((s, e) => s + e.target_sales, 0)
);
const totalCurrentSales = computed(() =>
  activeEvents.value.reduce((s, e) => s + e.current_sales, 0)
);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <!-- Header -->
      <div class="flex flex-col gap-4 md:flex-row md:items-center justify-between mb-6">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <div class="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-200">
              <BarChart3 class="w-6 h-6 text-white" />
            </div>
            <h1 class="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">KPIダッシュボード</h1>
          </div>
          <p class="text-sm text-gray-500 mt-1">すべてのKPIを一元管理。数値はバックエンドで統一計算されています。</p>
        </div>

        <div class="flex items-center gap-3">
          <select
            v-model="selectedMonth"
            class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option v-for="m in monthOptions" :key="m" :value="m">{{ m.replace('-', '年') }}月</option>
          </select>
          <button
            @click="showGoalEditor = !showGoalEditor"
            class="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
          >
            <Settings2 class="w-4 h-4" />
            目標設定
          </button>
        </div>
      </div>

      <!-- Goal Editor -->
      <div v-if="showGoalEditor" class="bg-white rounded-2xl border border-blue-200 p-6 mb-6 shadow-sm">
        <h3 class="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target class="w-4 h-4 text-blue-600" />
          {{ selectedMonth.replace('-', '年') }}月 月間目標設定
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div v-for="[key, label] in [
            ['sales_target', '売上目標 (円)'],
            ['required_seats', '必要着座数'],
            ['required_entries', '必要エントリー数'],
            ['required_interviews', '必要面談数'],
            ['required_interview_settings', '必要面談設定数'],
            ['required_inflow', '必要流入数'],
            ['cvr_seat_to_entry', '着座→エントリー率 (%)'],
            ['cvr_entry_to_interview', 'エントリー→面談率 (%)'],
            ['cvr_interview_to_setting', '面談→設定率 (%)'],
            ['cvr_inflow_to_setting', '流入→設定率 (%)'],
          ]" :key="key">
            <div>
              <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">{{ label }}</label>
              <input
                v-model.number="(goalForm as any)[key]"
                type="number"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showGoalEditor = false" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
          <button
            @click="saveGoals"
            :disabled="saving"
            class="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            <Save class="w-4 h-4" />
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 class="w-10 h-10 text-blue-600 animate-spin" />
        <p class="text-gray-500 font-medium">KPIデータを集計中...</p>
      </div>

      <div v-else>
        <!-- Tabs -->
        <div class="flex overflow-x-auto gap-1 mb-6 border-b border-gray-200 pb-0">
          <button
            v-for="tab in [
              { id: 'monthly', label: '月間KPI' },
              { id: 'daily', label: 'デイリー' },
              { id: 'event', label: 'イベントKPI' },
              { id: 'staff', label: '担当者別' },
              { id: 'source', label: '流入元別' },
            ]"
            :key="tab.id"
            class="px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors border-b-2"
            :class="activeTab === tab.id
              ? 'bg-white text-blue-700 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-800'"
            @click="activeTab = tab.id as any"
          >{{ tab.label }}</button>
        </div>

        <!-- ═══════ Monthly KPI Tab ═══════ -->
        <div v-if="activeTab === 'monthly' && monthly">
          <!-- Summary cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <!-- Sales -->
            <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Sales</span>
                <span class="text-xs font-bold" :class="rateColor(monthly.sales.achievementRate)">
                  {{ monthly.sales.achievementRate }}%
                </span>
              </div>
              <p class="text-xs font-bold text-gray-400 mb-1">売上</p>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-2xl font-black text-gray-900">¥{{ formatCurrency(monthly.sales.actual) }}</span>
                <span class="text-xs text-gray-400">/ ¥{{ formatCurrency(monthly.sales.target) }}</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :class="monthly.sales.achievementRate >= 80 ? 'bg-emerald-500' : monthly.sales.achievementRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'"
                  :style="{ width: `${Math.min(monthly.sales.achievementRate, 100)}%` }"
                ></div>
              </div>
              <p class="text-xs font-bold" :class="gapColor(monthly.sales.gap)">
                差分: {{ monthly.sales.gap >= 0 ? '+' : '' }}¥{{ formatCurrency(monthly.sales.gap) }}
              </p>
            </div>

            <!-- Seats / Entries / Interviews -->
            <div v-for="item in [
              { key: 'seats', label: '着座数', metric: monthly.seats, unit: '名' },
              { key: 'entries', label: 'エントリー数', metric: monthly.entries, unit: '名' },
              { key: 'interviews', label: '面談実施数', metric: monthly.interviews, unit: '名' },
              { key: 'interviewSettings', label: '面談設定数', metric: monthly.interviewSettings, unit: '名' },
              { key: 'inflow', label: '流入数', metric: monthly.inflow, unit: '名' },
            ]" :key="item.key"
              class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm"
            >
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">{{ item.key }}</span>
                <span class="text-xs font-bold" :class="rateColor(item.metric.achievementRate)">
                  {{ item.metric.achievementRate }}%
                </span>
              </div>
              <p class="text-xs font-bold text-gray-400 mb-1">{{ item.label }}</p>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-2xl font-black text-gray-900">{{ item.metric.actual }}</span>
                <span class="text-xs text-gray-400">/ {{ item.metric.target }} {{ item.unit }}</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :class="item.metric.achievementRate >= 80 ? 'bg-emerald-500' : item.metric.achievementRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'"
                  :style="{ width: `${Math.min(item.metric.achievementRate, 100)}%` }"
                ></div>
              </div>
              <p class="text-xs font-bold" :class="gapColor(item.metric.gap)">
                差分: {{ item.metric.gap >= 0 ? '+' : '' }}{{ item.metric.gap }}
              </p>
            </div>
          </div>

          <!-- CVR summary -->
          <div class="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-4">CVR（コンバージョン率）</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div v-for="cvr in [
                { label: '着座→エントリー', value: monthly.rates.seatToEntry },
                { label: 'エントリー→面談', value: monthly.rates.entryToInterview },
                { label: '面談→設定', value: monthly.rates.interviewToSetting },
                { label: '流入→設定', value: monthly.rates.inflowToSetting },
              ]" :key="cvr.label" class="text-center p-3 bg-gray-50 rounded-xl">
                <p class="text-[10px] font-bold text-gray-500 mb-1 uppercase">{{ cvr.label }}</p>
                <p class="text-2xl font-black text-gray-900">{{ cvr.value }}<span class="text-sm text-gray-400">%</span></p>
              </div>
            </div>
          </div>

          <!-- Funnel -->
          <div v-if="funnel" class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="text-sm font-bold text-gray-800 mb-4">ファネル集計</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div v-for="item in [
                { label: '申込数', value: funnel.applications, color: 'text-violet-700' },
                { label: '予約数', value: funnel.reservations, color: 'text-blue-700' },
                { label: '面談設定', value: funnel.interview_scheduled, color: 'text-amber-700' },
                { label: '面談実施', value: funnel.interview_completed, color: 'text-emerald-700' },
              ]" :key="item.label" class="text-center p-3 bg-gray-50 rounded-xl">
                <p class="text-[10px] font-bold text-gray-500 mb-1 uppercase">{{ item.label }}</p>
                <p class="text-3xl font-black" :class="item.color">{{ item.value }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════ Daily Tab ═══════ -->
        <div v-if="activeTab === 'daily' && daily">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div v-for="item in [
              { label: '売上/日', metric: daily.sales, prefix: '¥' },
              { label: '着座/日', metric: daily.seats },
              { label: 'エントリー/日', metric: daily.entries },
              { label: '面談/日', metric: daily.interviews },
            ]" :key="item.label"
              class="rounded-xl border p-4 text-center"
              :class="rateBgColor(item.metric.target > 0 ? 0 : 100)"
            >
              <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">{{ item.label }}</p>
              <p class="text-3xl font-black text-gray-800">{{ item.prefix || '' }}{{ item.metric.target }}</p>
              <p class="text-[10px] text-gray-400 mt-1">必要数/日</p>
            </div>
          </div>

          <!-- Daily trend -->
          <div v-if="daily.trend && daily.trend.length > 0" class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="text-sm font-bold text-gray-800 mb-4">日次推移（申込数）</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-bold text-gray-500">日付</th>
                    <th class="px-4 py-2 text-right text-xs font-bold text-gray-500">件数</th>
                    <th class="px-4 py-2 text-left text-xs font-bold text-gray-500 w-1/2">グラフ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="d in daily.trend.slice(0, 31)" :key="d.day" class="hover:bg-gray-50">
                    <td class="px-4 py-2 text-gray-700 font-medium whitespace-nowrap">{{ d.day.slice(5) }}</td>
                    <td class="px-4 py-2 text-right font-bold text-gray-900">{{ d.count }}</td>
                    <td class="px-4 py-2">
                      <div class="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-blue-500 rounded-full transition-all"
                          :style="{ width: `${Math.min((d.count / Math.max(...daily!.trend.map(t => t.count), 1)) * 100, 100)}%` }"
                        ></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══════ Event KPI Tab ═══════ -->
        <div v-if="activeTab === 'event'">
          <!-- Event sales summary -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">目標売上 合計</p>
              <p class="text-3xl font-black text-emerald-700">{{ formatCurrency(totalTargetSales) }}<span class="text-base font-semibold text-emerald-400 ml-1">円</span></p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">現状売上 合計</p>
              <p class="text-3xl font-black text-blue-700">{{ formatCurrency(totalCurrentSales) }}<span class="text-base font-semibold text-blue-400 ml-1">円</span></p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">売上乖離</p>
              <p class="text-3xl font-black" :class="(totalCurrentSales - totalTargetSales) >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ (totalCurrentSales - totalTargetSales) >= 0 ? '+' : '' }}{{ formatCurrency(totalCurrentSales - totalTargetSales) }}<span class="text-base font-semibold ml-1">円</span>
              </p>
            </div>
          </div>

          <!-- Event table header with toggle -->
          <div class="flex items-center justify-between mb-4 px-2">
            <h2 class="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Calendar class="w-4 h-4 text-blue-600" />
              イベント別進捗
            </h2>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" v-model="showExpired" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
              <span class="text-xs font-bold text-gray-500">過去のイベントを表示</span>
            </label>
          </div>

          <!-- Event table -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">イベント名</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">締日</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">残日数</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-blue-600">目標着座</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-blue-400">現着座</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-indigo-600">目標Entry</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-indigo-400">現Entry</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">達成率</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">日次Entry</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">日次面談</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="e in displayEvents" :key="e.event_id" class="hover:bg-gray-50" :class="{ 'opacity-60 bg-gray-50/50': e.days_remaining < -1 }">
                    <td class="px-4 py-3 font-bold text-gray-900 max-w-[200px] truncate" :title="e.event_title">
                      <div class="flex items-center gap-2">
                        <span v-if="e.days_remaining < -1" class="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase">Finished</span>
                        {{ e.event_title }}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{{ e.deadline ? new Date(e.deadline).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-' }}</td>
                    <td class="px-4 py-3 text-right" :class="e.days_remaining <= 3 ? 'text-red-600 font-bold' : 'text-gray-700'">{{ e.days_remaining }}</td>
                    <td class="px-4 py-3 text-right text-blue-700 font-bold">{{ e.target_seats }}</td>
                    <td class="px-4 py-3 text-right text-blue-500">{{ e.current_seats }}</td>
                    <td class="px-4 py-3 text-right text-indigo-700 font-bold">{{ e.target_entries }}</td>
                    <td class="px-4 py-3 text-right text-indigo-500">{{ e.current_entries }}</td>
                    <td class="px-4 py-3 text-right font-bold" :class="rateColor(e.achievementRate)">{{ e.achievementRate }}%</td>
                    <td class="px-4 py-3 text-right text-amber-700 font-bold">{{ e.daily_required_entries }}</td>
                    <td class="px-4 py-3 text-right text-violet-700 font-bold">{{ e.daily_required_interviews }}</td>
                  </tr>
                  <tr v-if="activeEvents.length === 0">
                    <td colspan="10" class="px-4 py-12 text-center text-gray-400">データがありません</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══════ Staff Tab ═══════ -->
        <div v-if="activeTab === 'staff'">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">担当者ID</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">申込数</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">予約数</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">面談設定</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">面談実施</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="row in staffOverview" :key="row.group_key" class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-bold text-gray-900">{{ row.group_key || '未割当' }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.applications }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.reservations }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.interview_scheduled }}</td>
                    <td class="px-4 py-3 text-right font-bold text-gray-900">{{ row.interview_completed }}</td>
                  </tr>
                  <tr v-if="staffOverview.length === 0">
                    <td colspan="5" class="px-4 py-12 text-center text-gray-400">データを読み込み中...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══════ Source Tab ═══════ -->
        <div v-if="activeTab === 'source'">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">流入元</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">申込数</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">予約数</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">面談設定</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">面談実施</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="row in sourceOverview" :key="row.group_key" class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-bold text-gray-900">{{ row.group_key || '不明' }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.applications }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.reservations }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">{{ row.interview_scheduled }}</td>
                    <td class="px-4 py-3 text-right font-bold text-gray-900">{{ row.interview_completed }}</td>
                  </tr>
                  <tr v-if="sourceOverview.length === 0">
                    <td colspan="5" class="px-4 py-12 text-center text-gray-400">データを読み込み中...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- No data fallback -->
        <div v-if="activeTab === 'monthly' && !monthly" class="text-center py-20">
          <p class="text-gray-400 mb-2">月間KPIデータがありません</p>
          <p class="text-sm text-gray-400">「目標設定」から月間目標を登録してください。</p>
        </div>
      </div>
    </div>
  </Layout>
</template>
