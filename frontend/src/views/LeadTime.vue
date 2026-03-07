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
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
  interview_to_proposal_rate: number;
  proposal_to_join_rate: number;
}>>([]);

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
        application_to_reservation_rate: Number(r.application_to_reservation_rate || 0),
        reservation_to_interview_rate: Number(r.reservation_to_interview_rate || 0),
        interview_to_proposal_rate: Number(r.interview_to_proposal_rate || 0),
        proposal_to_join_rate: Number(r.proposal_to_join_rate || 0)
      }))
    : [];
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

onMounted(async () => {
  await fetchFunnelKpi();
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">学生流入</h1>
        <p class="text-gray-500 mt-2">流入KPIと流入経路ごとの面談リードタイムを確認できます。</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm text-gray-500">デイリー流入数</p>
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
            @click="sourceCompanyFilter = opt"
          >
            {{ opt === 'ALL' ? 'すべて' : opt }}
          </button>
        </div>
      </div>
    </div>
  </Layout>
</template>
