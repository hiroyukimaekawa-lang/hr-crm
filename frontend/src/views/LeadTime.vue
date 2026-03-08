<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';

const sourceCompanyFilter = ref('ALL');
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  application_to_reservation_rate: 0,
  reservation_to_interview_rate: 0,
  interview_to_proposal_rate: 0,
  proposal_to_join_rate: 0,
  lost_reason_ranking: [] as Array<{ reason_name: string; count: number }>
});
const funnelBySource = ref<Array<{
  source_company: string;
  daily_applications: number;
  avg_daily_applications: number;
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
  interview_to_proposal_rate: number;
  proposal_to_join_rate: number;
}>>([]);
const interviewMetrics = ref({
  interviews_by_date: [] as Array<{
    interview_date: string;
    source_company: string;
    interview_round: string;
    interview_count: number;
  }>,
  account_summary: {
    settings_count: 0,
    first_interviews_count: 0,
    second_interviews_count: 0,
    setting_to_first_interview_lead_time_days_avg: null as number | null
  }
});

const sourceCompanyOptions = computed(() => {
  const companies = Array.from(new Set(funnelBySource.value
    .map((r) => String(r.source_company || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ja'));
  return ['ALL', ...companies];
});

const fetchFunnelKpi = async () => {
  const token = localStorage.getItem('token');
  const [res, bySourceRes] = await Promise.all([
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token } }),
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token }, params: { group_by_source: '1' } })
  ]);
  funnelKpi.value = {
    daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
    application_to_reservation_rate: Number(res.data?.application_to_reservation_rate || 0),
    reservation_to_interview_rate: Number(res.data?.reservation_to_interview_rate || 0),
    interview_to_proposal_rate: Number(res.data?.interview_to_proposal_rate || 0),
    proposal_to_join_rate: Number(res.data?.proposal_to_join_rate || 0),
    lost_reason_ranking: Array.isArray(res.data?.lost_reason_ranking) ? res.data.lost_reason_ranking : []
  };
  funnelBySource.value = Array.isArray(bySourceRes.data)
    ? bySourceRes.data.map((r: any) => ({
        source_company: String(r.source_company || '未設定'),
        daily_applications: Number(r.daily_applications || 0),
        avg_daily_applications: Number(r.avg_daily_applications || 0),
        application_to_reservation_rate: Number(r.application_to_reservation_rate || 0),
        reservation_to_interview_rate: Number(r.reservation_to_interview_rate || 0),
        interview_to_proposal_rate: Number(r.interview_to_proposal_rate || 0),
        proposal_to_join_rate: Number(r.proposal_to_join_rate || 0)
      }))
    : [];
};

const fetchInterviewMetrics = async () => {
  const token = localStorage.getItem('token');
  const params: Record<string, string> = {};
  if (sourceCompanyFilter.value !== 'ALL') params.source_company = sourceCompanyFilter.value;
  const res = await api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params });
  interviewMetrics.value = {
    interviews_by_date: Array.isArray(res.data?.interviews_by_date)
      ? res.data.interviews_by_date.map((r: any) => ({
          interview_date: String(r.interview_date || ''),
          source_company: String(r.source_company || '未設定'),
          interview_round: String(r.interview_round || 'first'),
          interview_count: Number(r.interview_count || 0)
        }))
      : [],
    account_summary: {
      settings_count: Number(res.data?.account_summary?.settings_count || 0),
      first_interviews_count: Number(res.data?.account_summary?.first_interviews_count || 0),
      second_interviews_count: Number(res.data?.account_summary?.second_interviews_count || 0),
      setting_to_first_interview_lead_time_days_avg: res.data?.account_summary?.setting_to_first_interview_lead_time_days_avg ?? null
    }
  };
};

const dailyFunnelRows = computed(() => {
  const applyMap = new Map<string, number>();
  funnelKpi.value.daily_applications.forEach((r) => {
    const day = String(r.day || '').slice(0, 10);
    if (day) applyMap.set(day, Number(r.count || 0));
  });
  const keys = Array.from(new Set([...applyMap.keys()])).sort((a, b) => (a < b ? 1 : -1));
  return keys.slice(0, 31).map((day) => ({
    day,
    applications: applyMap.get(day) || 0
  }));
});

const dailyInflowCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10);
  const row = dailyFunnelRows.value.find((r) => r.day === today);
  return row?.applications || 0;
});

const averageDailyInflow = computed(() => {
  if (sourceCompanyFilter.value === 'ALL') {
    if (dailyFunnelRows.value.length === 0) return 0;
    const total = dailyFunnelRows.value.reduce((sum, r) => sum + Number(r.applications || 0), 0);
    return Number((total / dailyFunnelRows.value.length).toFixed(2));
  }
  const row = funnelBySource.value.find((r) => r.source_company === sourceCompanyFilter.value);
  return Number(row?.avg_daily_applications || 0);
});

const selectedFunnelMetrics = computed(() => {
  if (sourceCompanyFilter.value === 'ALL') {
    return {
      daily_applications: dailyInflowCount.value,
      application_to_reservation_rate: funnelKpi.value.application_to_reservation_rate,
      reservation_to_interview_rate: funnelKpi.value.reservation_to_interview_rate,
      interview_to_proposal_rate: funnelKpi.value.interview_to_proposal_rate,
      proposal_to_join_rate: funnelKpi.value.proposal_to_join_rate
    };
  }
  const row = funnelBySource.value.find((r) => r.source_company === sourceCompanyFilter.value);
  return {
      daily_applications: Number(row?.daily_applications || 0),
    application_to_reservation_rate: Number(row?.application_to_reservation_rate || 0),
    reservation_to_interview_rate: Number(row?.reservation_to_interview_rate || 0),
    interview_to_proposal_rate: Number(row?.interview_to_proposal_rate || 0),
    proposal_to_join_rate: Number(row?.proposal_to_join_rate || 0)
  };
});

const selectedMonthKey = computed(() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
});

const monthlyInterviewBySource = computed(() => {
  const map: Record<string, { first: number; second: number; total: number }> = {};
  interviewMetrics.value.interviews_by_date.forEach((r) => {
    const key = String(r.interview_date || '').slice(0, 7);
    if (key !== selectedMonthKey.value) return;
    const source = String(r.source_company || '未設定');
    if (!map[source]) map[source] = { first: 0, second: 0, total: 0 };
    const count = Number(r.interview_count || 0);
    if (r.interview_round === 'second') map[source].second += count;
    else map[source].first += count;
    map[source].total += count;
  });
  return Object.entries(map)
    .map(([source_company, counts]) => ({ source_company, ...counts }))
    .sort((a, b) => b.total - a.total);
});

const monthlyInterviewTotal = computed(() =>
  monthlyInterviewBySource.value.reduce((sum, r) => sum + r.total, 0)
);

onMounted(async () => {
  await fetchFunnelKpi();
  await fetchInterviewMetrics();
});

const onSelectSource = async (source: string) => {
  sourceCompanyFilter.value = source;
  await fetchInterviewMetrics();
};
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">学生流入</h1>
        <p class="text-gray-500 mt-2">流入KPIと流入経路ごとの面談リードタイムを確認できます。</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6 mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">平均デイリー流入数</p>
          <p class="text-2xl font-bold text-gray-900">{{ averageDailyInflow }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">現状流入数</p>
          <p class="text-2xl font-bold text-gray-900">{{ selectedFunnelMetrics.daily_applications }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">申込→予約率</p>
          <p class="text-2xl font-bold text-gray-900">{{ selectedFunnelMetrics.application_to_reservation_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">予約→面談率</p>
          <p class="text-2xl font-bold text-gray-900">{{ selectedFunnelMetrics.reservation_to_interview_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">面談→イベント提案率</p>
          <p class="text-2xl font-bold text-gray-900">{{ selectedFunnelMetrics.interview_to_proposal_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">提案→参加率</p>
          <p class="text-2xl font-bold text-gray-900">{{ selectedFunnelMetrics.proposal_to_join_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500 mb-1">失注理由ランキング</p>
          <p class="text-xs text-gray-700" v-if="funnelKpi.lost_reason_ranking.length === 0">データなし</p>
          <ul v-else class="text-xs text-gray-700 space-y-0.5">
            <li v-for="r in funnelKpi.lost_reason_ranking.slice(0, 3)" :key="`lt-lost-${r.reason_name}`">{{ r.reason_name }}: {{ r.count }}</li>
          </ul>
        </div>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-2">流入経路タブ</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in sourceCompanyOptions"
            :key="`lt-source-tab-${opt}`"
            class="px-3 py-1.5 rounded-lg text-sm border"
            :class="sourceCompanyFilter === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
            @click="onSelectSource(opt)"
          >
            {{ opt === 'ALL' ? 'すべて' : opt }}
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">設定数（面談決定）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.settings_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">面談数（初回面談）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.first_interviews_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">面談数（2回目面談）</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.second_interviews_count }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="text-xs text-gray-500">設定→初回面談 リードタイム平均</p>
            <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.setting_to_first_interview_lead_time_days_avg ?? '-' }}<span class="text-sm text-gray-500">日</span></p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 p-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-800">{{ selectedMonthKey.replace('-', '年') }}月 の面談数</p>
            <p class="text-sm font-bold text-emerald-700">合計: {{ monthlyInterviewTotal }}件</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">流入経路</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回面談</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目面談</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="row in monthlyInterviewBySource" :key="`lead-monthly-${row.source_company}`">
                  <td class="px-3 py-2 text-gray-900">{{ row.source_company }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.first }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.second }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ row.total }}</td>
                </tr>
                <tr v-if="monthlyInterviewBySource.length === 0">
                  <td colSpan="4" class="px-3 py-6 text-center text-gray-400">対象月の面談データはありません。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
