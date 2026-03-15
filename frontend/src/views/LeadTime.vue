<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-vue-next';

/* ───────── 月別テーブルの折りたたみ ───────── */
const isMonthlyTableOpen = ref(false);

/* ───────── KPI データ ───────── */
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  application_to_reservation_rate: 0,
  apply_to_reservation_lead_time_days_avg: null as number | null,
  reservation_to_interview_lead_time_days_avg: null as number | null,
  counts: {
    applications_students: 0,
    reserved_students: 0,
    interviewed_students: 0,
  }
});

const monthlyHistory = ref<Array<{
  month: string;
  applications_students: number;
  reserved_students: number;
  interviewed_students: number;
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
}>>([]);

/* ───────── API取得 ───────── */
const fetchFunnelData = async () => {
  const token = localStorage.getItem('token');
  const [kpiRes, historyRes] = await Promise.all([
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token } }),
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token }, params: { group_by_month: '1' } })
  ]);

  funnelKpi.value = kpiRes.data;
  monthlyHistory.value = historyRes.data;
};

/* ───────── computed ───────── */
const reservationToInterviewRate = computed(() => {
  const reserved = funnelKpi.value?.counts?.reserved_students ?? 0;
  const interviewed = funnelKpi.value?.counts?.interviewed_students ?? 0;
  if (reserved === 0) return 0;
  return Math.min(Number(((interviewed / reserved) * 100).toFixed(2)), 100);
});

const dailyApps30Days = computed(() => {
  return [...funnelKpi.value.daily_applications]
    .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
    .slice(-30);
});

const maxDailyApps = computed(() => {
  const counts = dailyApps30Days.value.map(d => d.count);
  return counts.length > 0 ? Math.max(...counts) : 1;
});

const minDailyApps = computed(() => {
  const counts = dailyApps30Days.value.map(d => d.count);
  return counts.length > 0 ? Math.min(...counts) : 0;
});

const dailyAppsStats = computed(() => {
  const data = dailyApps30Days.value;
  if (data.length === 0) return { maxDate: '', minDate: '' };
  const maxVal = Math.max(...data.map(d => d.count));
  const minVal = Math.min(...data.map(d => d.count));
  return {
    maxDate: data.find(d => d.count === maxVal)?.day || '',
    minDate: data.find(d => d.count === minVal)?.day || ''
  };
});

const avgDailyApps = computed(() => {
  const data = dailyApps30Days.value;
  if (data.length === 0) return 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (total / data.length).toFixed(1);
});

/* ───────── Helpers ───────── */
const getRateColor = (rate: number) => {
  if (rate >= 80) return 'bg-green-50 border-green-400 text-green-700';
  if (rate >= 60) return 'bg-yellow-50 border-yellow-400 text-yellow-700';
  return 'bg-red-50 border-red-400 text-red-700';
};

const getLeadTimeColor = (days: number | null) => {
  if (days === null) return 'bg-gray-50 border-gray-200 text-gray-700';
  if (days <= 3) return 'bg-green-50 border-green-400 text-green-700';
  if (days <= 7) return 'bg-yellow-50 border-yellow-400 text-yellow-700';
  return 'bg-red-50 border-red-400 text-red-700';
};

onMounted(() => {
  fetchFunnelData();
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <!-- ページヘッダー -->
      <div class="space-y-1">
        <h1 class="text-3xl font-bold text-gray-900">初回ファネル登録</h1>
        <p class="text-gray-600">初回申し込み → 初回面談実施までの流入指標</p>
        <p class="text-[10px] text-gray-400">※トビ・リスケを経て最初に面談が実施された時点までを集計</p>
      </div>

      <!-- セクション①：初回面談フロー可視化 -->
      <div class="flex flex-col md:flex-row items-center justify-between gap-4 py-8 bg-white rounded-xl shadow-md border border-gray-100 px-6">
        <div class="flex-1 w-full text-center p-6 rounded-xl border-2 bg-blue-50 border-blue-400">
          <p class="text-sm text-blue-600 font-medium mb-1">申し込み</p>
          <p class="text-4xl font-bold text-blue-900">{{ funnelKpi.counts.applications_students }} <span class="text-lg font-normal">名</span></p>
        </div>
        <ArrowRight class="hidden md:block w-8 h-8 text-gray-300" />
        <div class="flex-1 w-full text-center p-6 rounded-xl border-2 bg-purple-50 border-purple-400">
          <p class="text-sm text-purple-600 font-medium mb-1">面談予約</p>
          <p class="text-4xl font-bold text-purple-900">{{ funnelKpi.counts.reserved_students }} <span class="text-lg font-normal">名</span></p>
          <p class="text-[10px] text-purple-500 mt-2 font-bold">申込→予約率：{{ funnelKpi.application_to_reservation_rate.toFixed(1) }}%</p>
        </div>
        <ArrowRight class="hidden md:block w-8 h-8 text-gray-300" />
        <div class="flex-1 w-full text-center p-6 rounded-xl border-2 bg-green-50 border-green-400">
          <p class="text-sm text-green-600 font-medium mb-1">初回面談実施</p>
          <p class="text-4xl font-bold text-green-900">{{ funnelKpi.counts.interviewed_students }} <span class="text-lg font-normal">名</span></p>
          <p class="text-[10px] text-green-500 mt-2 font-bold">予約→面談率：{{ reservationToInterviewRate }}%</p>
        </div>
      </div>

      <!-- セクション②：デイリー申込数グラフ -->
      <div class="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold text-gray-800">デイリー申込数推移（直近30日）</h2>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">30日平均：{{ avgDailyApps }} 件/日</span>
          </div>
        </div>
        <div class="h-48 flex items-end gap-1 px-2 border-b border-gray-100">
          <div 
            v-for="(d, idx) in dailyApps30Days" 
            :key="d.day"
            class="flex-1 bg-blue-400 hover:bg-blue-600 rounded-t-sm transition-all relative group"
            :style="{ height: `${(d.count / maxDailyApps) * 100}%` }"
          >
            <!-- ツールチップ -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
              {{ d.day.split('-').slice(1).join('/') }}: {{ d.count }}件
            </div>
            <!-- X軸ラベル（5日おき） -->
            <div v-if="idx % 5 === 0" class="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">
              {{ d.day.split('-').slice(1).join('/') }}
            </div>
          </div>
        </div>
        <div class="mt-8 grid grid-cols-2 gap-4">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 mb-1">最多：<span class="font-bold text-gray-900">{{ maxDailyApps }}件</span></p>
            <p class="text-[10px] text-gray-400">{{ dailyAppsStats.maxDate?.replace(/-/g, '/') }}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 mb-1">最少：<span class="font-bold text-gray-900">{{ minDailyApps }}件</span></p>
            <p class="text-[10px] text-gray-400">{{ dailyAppsStats.minDate?.replace(/-/g, '/') }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- セクション③：転換率カード -->
        <div :class="['rounded-xl shadow-md p-6 border-2 transition-colors', getRateColor(funnelKpi.application_to_reservation_rate)]">
          <p class="text-sm font-medium mb-1 opacity-80">申し込み → 初回予約率</p>
          <p class="text-3xl font-bold">{{ funnelKpi.application_to_reservation_rate.toFixed(1) }}%</p>
          <p class="text-xs mt-2 opacity-60">予約数 {{ funnelKpi.counts.reserved_students }}名 / 申込数 {{ funnelKpi.counts.applications_students }}名</p>
        </div>

        <div :class="['rounded-xl shadow-md p-6 border-2 transition-colors', getRateColor(reservationToInterviewRate)]">
          <p class="text-sm font-medium mb-1 opacity-80">予約 → 初回面談実施率</p>
          <p class="text-3xl font-bold">{{ reservationToInterviewRate }}%</p>
          <p class="text-xs mt-2 opacity-60">初回面談実施 {{ funnelKpi.counts.interviewed_students }}名 / 予約数 {{ funnelKpi.counts.reserved_students }}名</p>
        </div>

        <!-- セクション④：リードタイムカード -->
        <div :class="['rounded-xl shadow-md p-6 border-2 transition-colors', getLeadTimeColor(funnelKpi.apply_to_reservation_lead_time_days_avg)]">
          <p class="text-sm font-medium mb-1 opacity-80">申し込み → 初回予約 平均日数</p>
          <p class="text-3xl font-bold">{{ funnelKpi.apply_to_reservation_lead_time_days_avg ?? '-' }} <span class="text-lg font-normal">日</span></p>
          <p class="text-xs mt-2 opacity-60">※申込日から予約登録日までの間隔</p>
        </div>

        <div :class="['rounded-xl shadow-md p-6 border-2 transition-colors', getLeadTimeColor(funnelKpi.reservation_to_interview_lead_time_days_avg)]">
          <p class="text-sm font-medium mb-1 opacity-80">初回予約 → 初回面談実施 平均日数</p>
          <p class="text-3xl font-bold">{{ funnelKpi.reservation_to_interview_lead_time_days_avg ?? '-' }} <span class="text-lg font-normal">日</span></p>
          <p class="text-xs mt-2 opacity-60">※予約登録日から面談実施日までの間隔</p>
        </div>
      </div>

      <!-- セクション⑤：月別推移テーブル（折りたたみ） -->
      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <button 
          @click="isMonthlyTableOpen = !isMonthlyTableOpen"
          class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span class="font-bold text-gray-800">月別推移を表示</span>
          <component :is="isMonthlyTableOpen ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>
        
        <div v-show="isMonthlyTableOpen" class="border-t border-gray-100 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left font-semibold text-gray-600">月</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">申込数</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">予約数</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">初回面談実施</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">申込→予約率</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">予約→面談率</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="row in monthlyHistory" :key="row.month" class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-3 font-medium text-gray-900">{{ row.month }}</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ row.applications_students }}</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ row.reserved_students }}</td>
                <td class="px-4 py-3 text-right font-semibold text-green-700">{{ row.interviewed_students }}</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ Number(row.application_to_reservation_rate).toFixed(1) }}%</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ Number(row.reservation_to_interview_rate).toFixed(1) }}%</td>
              </tr>
              <tr v-if="monthlyHistory.length === 0">
                <td colspan="6" class="px-6 py-10 text-center text-gray-400">データがありません</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Layout>
</template>
