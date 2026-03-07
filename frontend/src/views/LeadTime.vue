<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';

const sourceCompanyFilter = ref('ALL');
const metrics = ref({
  first_lead_time_days_avg: null as number | null,
  first_total: 0,
  first_rescheduled: 0,
  first_reschedule_rate: null as number | null,
  followup_lead_time_days_avg: null as number | null,
  followup_total: 0,
  followup_rescheduled: 0,
  followup_reschedule_rate: null as number | null,
  account_summary: {
    settings_count: 0,
    first_interview_executed_count: 0,
    first_interview_execution_rate: null as number | null
  }
});
const metricsBySource = ref<Array<{
  source_company: string;
  first_lead_time_days_avg: number | null;
  first_total: number;
  first_rescheduled: number;
  first_reschedule_rate: number | null;
  followup_lead_time_days_avg: number | null;
  followup_total: number;
  followup_rescheduled: number;
  followup_reschedule_rate: number | null;
}>>([]);
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  daily_settings: [] as Array<{ day: string; count: number }>,
  application_to_reservation_rate: 0,
  reservation_to_interview_rate: 0,
  interview_to_proposal_rate: 0,
  proposal_to_join_rate: 0,
  lost_reason_ranking: [] as Array<{ reason_name: string; count: number }>
});

const sourceCompanyOptions = computed(() => {
  const companies = Array.from(new Set(metricsBySource.value
    .map((r) => String(r.source_company || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ja'));
  return ['ALL', ...companies];
});

const displayedMetricsBySource = computed(() => {
  const rows = [...metricsBySource.value];
  if (sourceCompanyFilter.value === 'ALL') return rows;
  return rows.sort((a, b) => {
    const aTop = a.source_company === sourceCompanyFilter.value ? 0 : 1;
    const bTop = b.source_company === sourceCompanyFilter.value ? 0 : 1;
    if (aTop !== bTop) return aTop - bTop;
    return a.source_company.localeCompare(b.source_company, 'ja');
  });
});

const fetchMetrics = async () => {
  const token = localStorage.getItem('token');
  const params: Record<string, string> = {};
  if (sourceCompanyFilter.value !== 'ALL') params.source_company = sourceCompanyFilter.value;
  const [summaryRes, bySourceRes] = await Promise.all([
    api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params }),
    api.get('/api/students/metrics/interviews', { headers: { Authorization: token }, params: { group_by_source: '1' } })
  ]);
  metrics.value = {
    first_lead_time_days_avg: summaryRes.data?.first_lead_time_days_avg ?? null,
    first_total: Number(summaryRes.data?.first_total || 0),
    first_rescheduled: Number(summaryRes.data?.first_rescheduled || 0),
    first_reschedule_rate: summaryRes.data?.first_reschedule_rate ?? null,
    followup_lead_time_days_avg: summaryRes.data?.followup_lead_time_days_avg ?? null,
    followup_total: Number(summaryRes.data?.followup_total || 0),
    followup_rescheduled: Number(summaryRes.data?.followup_rescheduled || 0),
    followup_reschedule_rate: summaryRes.data?.followup_reschedule_rate ?? null,
    account_summary: {
      settings_count: Number(summaryRes.data?.account_summary?.settings_count || 0),
      first_interview_executed_count: Number(summaryRes.data?.account_summary?.first_interview_executed_count || 0),
      first_interview_execution_rate: summaryRes.data?.account_summary?.first_interview_execution_rate ?? null
    }
  };
  metricsBySource.value = Array.isArray(bySourceRes.data) ? bySourceRes.data.map((r: any) => ({
    source_company: r.source_company || '未設定',
    first_lead_time_days_avg: r.first_lead_time_days_avg ?? null,
    first_total: Number(r.first_total || 0),
    first_rescheduled: Number(r.first_rescheduled || 0),
    first_reschedule_rate: r.first_reschedule_rate ?? null,
    followup_lead_time_days_avg: r.followup_lead_time_days_avg ?? null,
    followup_total: Number(r.followup_total || 0),
    followup_rescheduled: Number(r.followup_rescheduled || 0),
    followup_reschedule_rate: r.followup_reschedule_rate ?? null
  })) : [];
};

const fetchFunnelKpi = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/metrics/funnel', { headers: { Authorization: token } });
  funnelKpi.value = {
    daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
    daily_settings: Array.isArray(res.data?.daily_settings) ? res.data.daily_settings : [],
    application_to_reservation_rate: Number(res.data?.application_to_reservation_rate || 0),
    reservation_to_interview_rate: Number(res.data?.reservation_to_interview_rate || 0),
    interview_to_proposal_rate: Number(res.data?.interview_to_proposal_rate || 0),
    proposal_to_join_rate: Number(res.data?.proposal_to_join_rate || 0),
    lost_reason_ranking: Array.isArray(res.data?.lost_reason_ranking) ? res.data.lost_reason_ranking : []
  };
};

const dailyFunnelRows = computed(() => {
  const applyMap = new Map<string, number>();
  const settingMap = new Map<string, number>();
  funnelKpi.value.daily_applications.forEach((r) => {
    const day = String(r.day || '').slice(0, 10);
    if (day) applyMap.set(day, Number(r.count || 0));
  });
  funnelKpi.value.daily_settings.forEach((r) => {
    const day = String(r.day || '').slice(0, 10);
    if (day) settingMap.set(day, Number(r.count || 0));
  });
  const keys = Array.from(new Set([...applyMap.keys(), ...settingMap.keys()])).sort((a, b) => (a < b ? 1 : -1));
  return keys.slice(0, 31).map((day) => ({
    day,
    applications: applyMap.get(day) || 0,
    settings: settingMap.get(day) || 0
  }));
});

onMounted(async () => {
  await fetchMetrics();
  await fetchFunnelKpi();
});

watch(sourceCompanyFilter, fetchMetrics);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">学生流入</h1>
        <p class="text-gray-500 mt-2">流入KPIと流入経路ごとの面談リードタイムを確認できます。</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">申込→予約率</p>
          <p class="text-2xl font-bold text-gray-900">{{ funnelKpi.application_to_reservation_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">予約→面談率</p>
          <p class="text-2xl font-bold text-gray-900">{{ funnelKpi.reservation_to_interview_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">面談→イベント提案率</p>
          <p class="text-2xl font-bold text-gray-900">{{ funnelKpi.interview_to_proposal_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">提案→参加率</p>
          <p class="text-2xl font-bold text-gray-900">{{ funnelKpi.proposal_to_join_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500 mb-1">失注理由ランキング</p>
          <p class="text-xs text-gray-700" v-if="funnelKpi.lost_reason_ranking.length === 0">データなし</p>
          <ul v-else class="text-xs text-gray-700 space-y-0.5">
            <li v-for="r in funnelKpi.lost_reason_ranking.slice(0, 3)" :key="`lt-lost-${r.reason_name}`">{{ r.reason_name }}: {{ r.count }}</li>
          </ul>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">日別申込/設定数（直近31日）</h3>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[360px] text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-gray-500">日付</th>
                <th class="px-3 py-2 text-right text-gray-500">申込数</th>
                <th class="px-3 py-2 text-right text-gray-500">設定数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="d in dailyFunnelRows" :key="`lt-daily-${d.day}`">
                <td class="px-3 py-2 text-gray-700">{{ new Date(d.day).toLocaleDateString('ja-JP') }}</td>
                <td class="px-3 py-2 text-right text-gray-900">{{ d.applications }}</td>
                <td class="px-3 py-2 text-right text-gray-900">{{ d.settings }}</td>
              </tr>
              <tr v-if="dailyFunnelRows.length === 0">
                <td class="px-3 py-3 text-gray-400 text-center" colSpan="3">データがありません</td>
              </tr>
            </tbody>
          </table>
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
            @click="sourceCompanyFilter = opt"
          >
            {{ opt === 'ALL' ? 'すべて' : opt }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談リードタイム平均</p>
          <p class="text-2xl font-bold text-gray-900">{{ metrics.first_lead_time_days_avg ?? '-' }}<span class="text-sm font-medium text-gray-500">日</span></p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談リスケ</p>
          <p class="text-2xl font-bold text-gray-900">{{ metrics.first_rescheduled }}<span class="text-sm font-medium text-gray-500">件</span></p>
          <p class="text-xs text-gray-500 mt-1">率: {{ metrics.first_reschedule_rate ?? '-' }}% / 母数: {{ metrics.first_total }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">2回目以降リードタイム平均</p>
          <p class="text-2xl font-bold text-gray-900">{{ metrics.followup_lead_time_days_avg ?? '-' }}<span class="text-sm font-medium text-gray-500">日</span></p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">2回目以降リスケ</p>
          <p class="text-2xl font-bold text-gray-900">{{ metrics.followup_rescheduled }}<span class="text-sm font-medium text-gray-500">件</span></p>
          <p class="text-xs text-gray-500 mt-1">率: {{ metrics.followup_reschedule_rate ?? '-' }}% / 母数: {{ metrics.followup_total }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">初回面談実施率</p>
          <p class="text-2xl font-bold text-gray-900">{{ metrics.account_summary.first_interview_execution_rate ?? 0 }}<span class="text-sm font-medium text-gray-500">%</span></p>
          <p class="text-xs text-gray-500 mt-1">実施: {{ metrics.account_summary.first_interview_executed_count }} / 設定: {{ metrics.account_summary.settings_count }}</p>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">流入経路別リードタイム</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">流入経路</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回平均(日)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">初回リスケ率(%)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目以降平均(日)</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">2回目以降リスケ率(%)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr
                v-for="row in displayedMetricsBySource"
                :key="`lt-row-${row.source_company}`"
                class="hover:bg-gray-50"
                :class="sourceCompanyFilter !== 'ALL' && row.source_company === sourceCompanyFilter ? 'bg-blue-50/60' : ''"
              >
                <td class="px-3 py-2 text-gray-900 font-medium">{{ row.source_company }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_lead_time_days_avg ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.first_reschedule_rate ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.followup_lead_time_days_avg ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-gray-700">{{ row.followup_reschedule_rate ?? '-' }}</td>
              </tr>
              <tr v-if="displayedMetricsBySource.length === 0">
                <td colSpan="5" class="px-3 py-8 text-center text-gray-400">データがありません。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Layout>
</template>
