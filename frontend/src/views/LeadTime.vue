<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-vue-next';

/* ───────── 月別テーブルの折りたたみ ───────── */
const isMonthlyTableOpen = ref(false);
const isLoading = ref(false);

/* ───────── 企業フィルタ ───────── */
const sourceCategories = ref<string[]>([]);
const selectedSource = ref<string>(''); // 空文字 = 全体
const selectedMonth = ref<string>(new Date().toISOString().slice(0, 7)); // デフォルト: 今月 (YYYY-MM)

const fetchSources = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await api.get('/api/students/metrics/funnel-sources', {
      headers: { Authorization: token }
    });
    sourceCategories.value = res.data;
  } catch (err) {
    console.error('Error fetching sources:', err);
  }
};

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
  },
  graduation_year_breakdown: [] as Array<{
    graduation_year: number;
    applications: number;
    reservations: number;
    interviews: number;
  }>
});

const monthlyHistory = ref<Array<{
  month: string;
  applications_students: number;
  reserved_students: number;
  interviewed_students: number;
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
}>>([]);

const allEvents = ref<any[]>([]);
const isEventsLoading = ref(false);

/* ───────── API取得 ───────── */
const fetchFunnelData = async () => {
  isLoading.value = true;
  try {
    const token = localStorage.getItem('token');
    const sourceParam = selectedSource.value ? { source_company: selectedSource.value } : {};
    const monthParam = selectedMonth.value ? { month: selectedMonth.value } : {};

    const [kpiRes, historyRes] = await Promise.all([
      api.get('/api/students/metrics/funnel', {
        headers: { Authorization: token },
        params: { ...sourceParam, ...monthParam }
      }),
      api.get('/api/students/metrics/funnel', {
        headers: { Authorization: token },
        params: { group_by_month: '1', ...sourceParam }
      })
    ]);

    funnelKpi.value = kpiRes.data;
    monthlyHistory.value = historyRes.data;
  } catch (err) {
    console.error('Error fetching funnel data:', err);
  } finally {
    isLoading.value = false;
  }
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

const totalLtv = computed(() => {
  return allEvents.value.reduce((sum, e) => sum + (Number(e.attended_count || 0) * Number(e.unit_price || 0)), 0);
});

const ltvPerPerson = computed(() => {
  const interviewed = funnelKpi.value?.counts?.interviewed_students ?? 0;
  if (interviewed === 0) return 0;
  return Math.round(totalLtv.value / interviewed);
});

/* ───────── 卒業年度内訳 ───────── */
const grad27Counts = computed(() => {
  const item = funnelKpi.value.graduation_year_breakdown?.find(b => b.graduation_year === 2027);
  return item || { applications: 0, reservations: 0, interviews: 0 };
});

const grad28Counts = computed(() => {
  const item = funnelKpi.value.graduation_year_breakdown?.find(b => b.graduation_year === 2028);
  return item || { applications: 0, reservations: 0, interviews: 0 };
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

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(async () => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  await fetchSources();
  await Promise.all([
    fetchFunnelData(),
    fetchEventsData()
  ]);
});

const fetchEventsData = async () => {
  isEventsLoading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/events', { headers: { Authorization: token } });
    allEvents.value = res.data;
  } catch (err) {
    console.error('Error fetching events:', err);
  } finally {
    isEventsLoading.value = false;
  }
};
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

      <!-- プルダウン -->
      <div class="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div class="flex items-center gap-3">
          <label class="text-sm font-bold text-gray-600 whitespace-nowrap">流入元企業</label>
          <select
            v-model="selectedSource"
            @change="fetchFunnelData"
            :disabled="isLoading"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px] disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
          >
            <option value="">全体（すべての企業）</option>
            <option v-for="name in sourceCategories" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-sm font-bold text-gray-600 whitespace-nowrap">対象月</label>
          <input
            type="month"
            v-model="selectedMonth"
            @change="fetchFunnelData"
            :disabled="isLoading"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[150px] disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
          />
        </div>
        <div v-if="isLoading" class="flex items-center gap-2 text-blue-600">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm font-medium">更新中...</span>
        </div>
        <div v-else class="flex items-center gap-2">
          <span v-if="selectedSource" class="text-xs text-blue-500 font-medium px-2 py-1 bg-blue-50 rounded-md">
            {{ selectedSource }}
          </span>
          <span v-if="selectedMonth" class="text-xs text-purple-500 font-medium px-2 py-1 bg-purple-50 rounded-md">
            {{ selectedMonth }} 分を表示
          </span>
        </div>
      </div>

      <!-- 月別推移（流入元企業の下に配置） -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button 
          @click="isMonthlyTableOpen = !isMonthlyTableOpen"
          class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm"
        >
          <span class="font-bold text-gray-800">月別推移を表示</span>
          <component :is="isMonthlyTableOpen ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>
        
        <div v-show="isMonthlyTableOpen" class="border-t border-gray-100 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left font-semibold text-gray-600">月</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600">申し込み数</th>
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

      <!-- セクション①：初回面談フロー可視化 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          初回面談までのステップ
        </h2>
        <!-- PC・タブレット: 横並び / スマホ: 縦並び -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6 relative">
          <!-- Step 1 -->
          <div class="flex-1 w-full flex flex-col items-center bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 transition-all hover:shadow-md">
            <span class="text-3xl mb-2">📩</span>
            <p class="text-sm font-bold text-blue-900 mb-1">初回申し込み</p>
            <p class="text-2xl font-black text-blue-600">{{ funnelKpi.counts.applications_students }}<span class="text-xs ml-1 font-bold">名</span></p>
            <div v-if="funnelKpi.graduation_year_breakdown?.length > 0" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.applications }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.applications }}</span>
            </div>
          </div>

          <!-- Arrow 1 (sm:横, xs:縦) -->
          <div class="flex flex-col items-center justify-center py-2 sm:py-0">
            <div class="sm:hidden text-2xl text-gray-300">↓</div>
            <ArrowRight class="hidden sm:block w-8 h-8 text-gray-300" />
            <div class="mt-1 bg-white border border-blue-100 px-3 py-1 rounded-full shadow-sm">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center">申込→予約率</p>
              <p class="text-sm font-black text-blue-600 text-center">{{ funnelKpi.application_to_reservation_rate.toFixed(1) }}%</p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="flex-1 w-full flex flex-col items-center bg-purple-50/50 rounded-2xl p-5 border border-purple-100/50 transition-all hover:shadow-md">
            <span class="text-3xl mb-2">📅</span>
            <p class="text-sm font-bold text-purple-900 mb-1">面談予約</p>
            <p class="text-2xl font-black text-purple-600">{{ funnelKpi.counts.reserved_students }}<span class="text-xs ml-1 font-bold">名</span></p>
            <div v-if="funnelKpi.graduation_year_breakdown?.length > 0" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.reservations }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.reservations }}</span>
            </div>
          </div>

          <!-- Arrow 2 (sm:横, xs:縦) -->
          <div class="flex flex-col items-center justify-center py-2 sm:py-0">
            <div class="sm:hidden text-2xl text-gray-300">↓</div>
            <ArrowRight class="hidden sm:block w-8 h-8 text-gray-300" />
            <div class="mt-1 bg-white border border-green-100 px-3 py-1 rounded-full shadow-sm">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center">予約→面談率</p>
              <p class="text-sm font-black text-green-600 text-center">{{ reservationToInterviewRate }}%</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="flex-1 w-full flex flex-col items-center bg-green-50/50 rounded-2xl p-5 border border-green-100/50 transition-all hover:shadow-md">
            <span class="text-3xl mb-2">🤝</span>
            <p class="text-sm font-bold text-green-900 mb-1">初回面談実施</p>
            <p class="text-2xl font-black text-green-600">{{ funnelKpi.counts.interviewed_students }}<span class="text-xs ml-1 font-bold">名</span></p>
            <div v-if="funnelKpi.graduation_year_breakdown?.length > 0" class="mt-2 flex gap-2 text-[10px] font-bold">
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">27卒: {{ grad27Counts.interviews }}</span>
              <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">28卒: {{ grad28Counts.interviews }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- セクション②：デイリー申込数グラフ -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span class="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
              デイリー初回申込推移
            </h2>
            <p class="text-sm text-gray-500 mt-1">直近{{ isMobile ? 14 : 30 }}日間の学生申し込み件数</p>
          </div>
          <div class="flex flex-wrap gap-4">
            <div class="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">1日平均</p>
              <p class="text-lg font-black text-slate-700">{{ avgDailyApps }}<span class="text-[10px] ml-0.5">名</span></p>
            </div>
            <div class="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
              <p class="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-0.5">最多 ({{ dailyAppsStats.maxDate.slice(5) }})</p>
              <p class="text-lg font-black text-indigo-700">{{ maxDailyApps }}<span class="text-[10px] ml-0.5">名</span></p>
            </div>
          </div>
        </div>

        <div class="h-48 md:h-64 flex items-end gap-1 px-2 border-b border-gray-100 relative">
          <div 
            v-for="(d, idx) in (isMobile ? dailyApps30Days.slice(-14) : dailyApps30Days)" 
            :key="d.day"
            class="flex-1 bg-blue-500 hover:bg-blue-600 rounded-t-sm transition-all relative group"
            :style="{ height: `${(d.count / maxDailyApps) * 100}%` }"
          >
            <!-- ツールチップ -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 font-bold">
              {{ d.day.split('-').slice(1).join('/') }}: {{ d.count }}名
            </div>
            <!-- X軸ラベル -->
            <div v-if="(isMobile ? idx % 4 === 0 : idx % 5 === 0) || idx === (isMobile ? 13 : 29)" class="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold whitespace-nowrap">
              {{ d.day.split('-').slice(1).join('/') }}
            </div>
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

        <div :class="['rounded-xl shadow-md p-6 border-2 border-gray-200 bg-white transition-colors']">
          <p class="text-sm font-medium mb-1 text-gray-500">1名あたりのLTV</p>
          <p class="text-3xl font-bold text-gray-900">¥{{ ltvPerPerson.toLocaleString() }}</p>
          <p class="text-xs mt-2 text-gray-400">※総着座売上 / 初回面談実施人数 ({{ funnelKpi.counts.interviewed_students }}名)</p>
        </div>

        <div :class="['rounded-xl shadow-md p-6 border-2 transition-colors', getLeadTimeColor(funnelKpi.reservation_to_interview_lead_time_days_avg)]">
          <p class="text-sm font-medium mb-1 opacity-80">初回予約 → 初回面談実施 平均日数</p>
          <p class="text-3xl font-bold">{{ funnelKpi.reservation_to_interview_lead_time_days_avg ?? '-' }} <span class="text-lg font-normal">日</span></p>
          <p class="text-xs mt-2 opacity-60">※予約登録日から面談実施日までの間隔</p>
        </div>
      </div>

    </div>
  </Layout>
</template>
