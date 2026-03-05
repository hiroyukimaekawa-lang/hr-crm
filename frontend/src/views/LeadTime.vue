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
  followup_reschedule_rate: null as number | null
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
    followup_reschedule_rate: summaryRes.data?.followup_reschedule_rate ?? null
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

onMounted(async () => {
  await fetchMetrics();
});

watch(sourceCompanyFilter, fetchMetrics);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">リードタイム</h1>
        <p class="text-gray-500 mt-2">流入経路ごとの面談リードタイムとリスケ率を確認できます。</p>
      </div>

      <div class="flex items-center gap-3 mb-4">
        <label class="text-sm text-gray-600">流入経路フィルタ</label>
        <select v-model="sourceCompanyFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option v-for="opt in sourceCompanyOptions" :key="`lt-source-filter-${opt}`" :value="opt">
            {{ opt === 'ALL' ? 'すべて' : opt }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
