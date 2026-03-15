<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';

/* ───────── 月選択 ───────── */
const viewMode = ref<'all' | 'monthly'>('all');  // 全体 or 月別
const selectedMonth = ref<string>('');            // YYYY-MM

const currentYM = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 月選択候補（最新24ヶ月）
const monthOptions = computed(() => {
  const options: string[] = [];
  const d = new Date();
  for (let i = 0; i < 24; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return options;
});

const formatYM = (ym: string) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m || '0')}月`;
};

// 現在表示中の月パラメータ（全体の場合は空）
const activeMonth = computed(() => viewMode.value === 'monthly' ? selectedMonth.value : '');

/* ───────── KPIタブ ───────── */
const activeTab = ref<'kpi' | 'history'>('kpi');

/* ───────── KPI データ ───────── */
const sourceCompanyFilter = ref('ALL');
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  daily_settings: [] as Array<{ day: string; count: number }>,
  application_to_reservation_rate: 0,
  reservation_to_interview_rate: 0,
  apply_to_reservation_lead_time_days_avg: null as number | null,
  reservation_to_interview_lead_time_days_avg: null as number | null,
  interview_completed_rate: 0,
  no_show_rate: 0,
  reschedule_rate: 0,
  counts: {
    applications_students: 0,
    reserved_students: 0,
    interview_scheduled_students: 0,
    interviewed_students: 0,
    no_show_students: 0,
    rescheduled_students: 0,
    proposed_students: 0,
    joined_students: 0
  },
  interview_to_proposal_rate: 0,
  proposal_to_join_rate: 0,
  lost_reason_ranking: [] as Array<{ reason_name: string; count: number }>
});

const funnelBySource = ref<Array<{
  source_company: string;
  daily_applications: number;
  daily_settings: number;
  avg_daily_applications: number;
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
  apply_to_reservation_lead_time_days_avg: number | null;
  reservation_to_interview_lead_time_days_avg: number | null;
  interview_completed_rate: number;
  no_show_rate: number;
  reschedule_rate: number;
  interviewed_students: number;
  no_show_students: number;
  rescheduled_students: number;
  interview_to_proposal_rate: number;
  proposal_to_join_rate: number;
}>>([]);

/* ───────── 月別履歴データ ───────── */
const monthlyHistory = ref<Array<{
  month: string;
  applications_students: number;
  reserved_students: number;
  interview_scheduled_students: number;
  interviewed_students: number;
  no_show_students: number;
  rescheduled_students: number;
  application_to_reservation_rate: number;
  reservation_to_interview_rate: number;
  no_show_rate: number;
  reschedule_rate: number;
}>>([]);

/* ───────── 面談メトリクス ───────── */
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

/* ───────── API取得 ───────── */
const fetchFunnelKpi = async () => {
  const token = localStorage.getItem('token');
  const params: Record<string, string> = {};
  if (activeMonth.value) params.month = activeMonth.value;

  const [res, bySourceRes] = await Promise.all([
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token }, params }),
    api.get('/api/students/metrics/funnel', { headers: { Authorization: token }, params: { ...params, group_by_source: '1' } })
  ]);

  funnelKpi.value = {
    daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
    daily_settings: Array.isArray(res.data?.daily_settings) ? res.data.daily_settings : [],
    application_to_reservation_rate: Number(res.data?.application_to_reservation_rate || 0),
    reservation_to_interview_rate: Number(res.data?.reservation_to_interview_rate || 0),
    apply_to_reservation_lead_time_days_avg:
      res.data?.apply_to_reservation_lead_time_days_avg != null
        ? Number(res.data.apply_to_reservation_lead_time_days_avg) : null,
    reservation_to_interview_lead_time_days_avg:
      res.data?.reservation_to_interview_lead_time_days_avg != null
        ? Number(res.data.reservation_to_interview_lead_time_days_avg) : null,
    interview_completed_rate: Number(res.data?.interview_completed_rate || 0),
    no_show_rate: Number(res.data?.no_show_rate || 0),
    reschedule_rate: Number(res.data?.reschedule_rate || 0),
    counts: {
      applications_students: Number(res.data?.counts?.applications_students || 0),
      reserved_students: Number(res.data?.counts?.reserved_students || 0),
      interview_scheduled_students: Number(res.data?.counts?.interview_scheduled_students || 0),
      interviewed_students: Number(res.data?.counts?.interviewed_students || 0),
      no_show_students: Number(res.data?.counts?.no_show_students || 0),
      rescheduled_students: Number(res.data?.counts?.rescheduled_students || 0),
      proposed_students: Number(res.data?.counts?.proposed_students || 0),
      joined_students: Number(res.data?.counts?.joined_students || 0)
    },
    interview_to_proposal_rate: Number(res.data?.interview_to_proposal_rate || 0),
    proposal_to_join_rate: Number(res.data?.proposal_to_join_rate || 0),
    lost_reason_ranking: Array.isArray(res.data?.lost_reason_ranking) ? res.data.lost_reason_ranking : []
  };

  funnelBySource.value = Array.isArray(bySourceRes.data)
    ? bySourceRes.data.map((r: any) => ({
        source_company: String(r.source_company || '未設定'),
        daily_applications: Number(r.daily_applications || 0),
        daily_settings: Number(r.daily_settings || 0),
        avg_daily_applications: Number(r.avg_daily_applications || 0),
        application_to_reservation_rate: Number(r.application_to_reservation_rate || 0),
        reservation_to_interview_rate: Number(r.reservation_to_interview_rate || 0),
        apply_to_reservation_lead_time_days_avg:
          r.apply_to_reservation_lead_time_days_avg != null ? Number(r.apply_to_reservation_lead_time_days_avg) : null,
        reservation_to_interview_lead_time_days_avg:
          r.reservation_to_interview_lead_time_days_avg != null ? Number(r.reservation_to_interview_lead_time_days_avg) : null,
        interview_completed_rate: Number(r.interview_completed_rate || 0),
        no_show_rate: Number(r.no_show_rate || 0),
        reschedule_rate: Number(r.reschedule_rate || 0),
        interviewed_students: Number(r.interviewed_students || 0),
        no_show_students: Number(r.no_show_students || 0),
        rescheduled_students: Number(r.rescheduled_students || 0),
        interview_to_proposal_rate: Number(r.interview_to_proposal_rate || 0),
        proposal_to_join_rate: Number(r.proposal_to_join_rate || 0)
      }))
    : [];
};

const fetchMonthlyHistory = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/metrics/funnel', {
    headers: { Authorization: token },
    params: { group_by_month: '1' }
  });
  monthlyHistory.value = Array.isArray(res.data) ? res.data : [];
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

/* ───────── computed ───────── */
const sourceCompanyOptions = computed(() => {
  const companies = Array.from(new Set(funnelBySource.value
    .map((r) => String(r.source_company || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ja'));
  return ['ALL', ...companies];
});

const dailyFunnelRows = computed(() => {
  const applyMap = new Map<string, number>();
  funnelKpi.value.daily_applications.forEach((r) => {
    const day = String(r.day || '').slice(0, 10);
    if (day) applyMap.set(day, Number(r.count || 0));
  });
  return Array.from(applyMap.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 62)
    .map(([day, applications]) => ({ day, applications }));
});

const dailySettingRows = computed(() => {
  const settingMap = new Map<string, number>();
  funnelKpi.value.daily_settings.forEach((r) => {
    const day = String(r.day || '').slice(0, 10);
    if (day) settingMap.set(day, Number(r.count || 0));
  });
  return Array.from(settingMap.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 62)
    .map(([day, settings]) => ({ day, settings }));
});

const dailyApplicationSettingRows = computed(() => {
  const appMap = new Map<string, number>();
  const settingMap = new Map<string, number>();
  dailyFunnelRows.value.forEach((r) => appMap.set(r.day, r.applications));
  dailySettingRows.value.forEach((r) => settingMap.set(r.day, r.settings));
  const keys = Array.from(new Set([...appMap.keys(), ...settingMap.keys()]))
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 62);
  return keys.map((day) => ({
    day,
    applications: appMap.get(day) || 0,
    settings: settingMap.get(day) || 0
  }));
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

const dailyApplicationCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10);
  return dailyFunnelRows.value.find((r) => r.day === today)?.applications || 0;
});

const dailySettingCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10);
  return dailySettingRows.value.find((r) => r.day === today)?.settings || 0;
});

const selectedFunnelMetrics = computed(() => {
  if (sourceCompanyFilter.value === 'ALL') {
    return {
      daily_applications: dailyApplicationCount.value,
      daily_settings: dailySettingCount.value,
      application_to_reservation_rate: funnelKpi.value.application_to_reservation_rate,
      reservation_to_interview_rate: funnelKpi.value.reservation_to_interview_rate,
      apply_to_reservation_lead_time_days_avg: funnelKpi.value.apply_to_reservation_lead_time_days_avg,
      reservation_to_interview_lead_time_days_avg: funnelKpi.value.reservation_to_interview_lead_time_days_avg,
      interview_completed_rate: funnelKpi.value.interview_completed_rate,
      no_show_rate: funnelKpi.value.no_show_rate,
      reschedule_rate: funnelKpi.value.reschedule_rate,
      applications_students: funnelKpi.value.counts.applications_students,
      reserved_students: funnelKpi.value.counts.reserved_students,
      interview_scheduled_students: funnelKpi.value.counts.interview_scheduled_students,
      interviewed_students: funnelKpi.value.counts.interviewed_students,
      no_show_students: funnelKpi.value.counts.no_show_students,
      rescheduled_students: funnelKpi.value.counts.rescheduled_students,
      interview_to_proposal_rate: funnelKpi.value.interview_to_proposal_rate,
      proposal_to_join_rate: funnelKpi.value.proposal_to_join_rate
    };
  }
  const row = funnelBySource.value.find((r) => r.source_company === sourceCompanyFilter.value);
  return {
    daily_applications: Number(row?.daily_applications || 0),
    daily_settings: Number(row?.daily_settings || 0),
    application_to_reservation_rate: Number(row?.application_to_reservation_rate || 0),
    reservation_to_interview_rate: Number(row?.reservation_to_interview_rate || 0),
    apply_to_reservation_lead_time_days_avg: row?.apply_to_reservation_lead_time_days_avg ?? null,
    reservation_to_interview_lead_time_days_avg: row?.reservation_to_interview_lead_time_days_avg ?? null,
    interview_completed_rate: Number(row?.interview_completed_rate || 0),
    no_show_rate: Number(row?.no_show_rate || 0),
    reschedule_rate: Number(row?.reschedule_rate || 0),
    applications_students: 0,
    reserved_students: 0,
    interview_scheduled_students: 0,
    interviewed_students: Number(row?.interviewed_students || 0),
    no_show_students: Number(row?.no_show_students || 0),
    rescheduled_students: Number(row?.rescheduled_students || 0),
    interview_to_proposal_rate: Number(row?.interview_to_proposal_rate || 0),
    proposal_to_join_rate: Number(row?.proposal_to_join_rate || 0)
  };
});

const selectedMonthKey = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

/* ───────── ライフサイクル ───────── */
onMounted(async () => {
  selectedMonth.value = currentYM();
  await Promise.all([fetchFunnelKpi(), fetchInterviewMetrics(), fetchMonthlyHistory()]);
});

watch([viewMode, selectedMonth], async () => {
  await fetchFunnelKpi();
});

const onSelectSource = async (source: string) => {
  sourceCompanyFilter.value = source;
  await fetchInterviewMetrics();
};

const formatDate = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

/* ───────── KPIカード定義 ───────── */
const kpiCards = computed(() => [
  {
    label: '平均デイリー申込数',
    value: averageDailyInflow.value,
    unit: '件',
    color: 'blue'
  },
  {
    label: 'デイリー面談設定数',
    value: selectedFunnelMetrics.value.daily_settings,
    unit: '件',
    color: 'indigo',
    note: '予約登録日ベース'
  },
  {
    label: '申込→予約率',
    value: selectedFunnelMetrics.value.application_to_reservation_rate.toFixed(2),
    unit: '%',
    color: 'violet'
  },
  {
    label: '申込→予約 リードタイム',
    value: selectedFunnelMetrics.value.apply_to_reservation_lead_time_days_avg ?? '-',
    unit: '日',
    color: 'purple'
  },
  {
    label: '予約→面談率',
    value: selectedFunnelMetrics.value.reservation_to_interview_rate.toFixed(2),
    unit: '%',
    color: 'pink',
    note: '実施数/予約数'
  },
  {
    label: '予約→面談 リードタイム',
    value: selectedFunnelMetrics.value.reservation_to_interview_lead_time_days_avg ?? '-',
    unit: '日',
    color: 'rose'
  },
  {
    label: '飛ばれ率',
    value: selectedFunnelMetrics.value.no_show_rate.toFixed(2),
    unit: '%',
    color: 'red',
    note: '面談設定数分母'
  },
  {
    label: 'リスケ率',
    value: selectedFunnelMetrics.value.reschedule_rate.toFixed(2),
    unit: '%',
    color: 'orange',
    note: '面談設定数分母'
  },
  {
    label: '面談実施数',
    value: selectedFunnelMetrics.value.interviewed_students,
    unit: '件',
    color: 'emerald'
  },
  {
    label: '飛ばれ数',
    value: selectedFunnelMetrics.value.no_show_students,
    unit: '件',
    color: 'red'
  },
  {
    label: '面談→提案率',
    value: selectedFunnelMetrics.value.interview_to_proposal_rate.toFixed(2),
    unit: '%',
    color: 'teal'
  },
  {
    label: '提案→参加率',
    value: selectedFunnelMetrics.value.proposal_to_join_rate.toFixed(2),
    unit: '%',
    color: 'green'
  }
]);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <!-- ヘッダー -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">学生流入</h1>
        <p class="text-gray-500 mt-2">流入KPIと流入経路ごとの面談リードタイムを確認できます。</p>
      </div>

      <!-- 月選択 + タブ切替 -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <!-- 月フィルタ -->
        <div class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            @click="viewMode = 'all'"
            class="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
            :class="viewMode === 'all' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'"
          >全体</button>
          <div class="flex items-center gap-1">
            <button
              @click="viewMode = 'monthly'"
              class="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
              :class="viewMode === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'"
            >月別</button>
            <select
              v-if="viewMode === 'monthly'"
              v-model="selectedMonth"
              class="px-3 py-2 text-sm border-0 outline-none bg-white text-gray-700 rounded-lg"
            >
              <option v-for="m in monthOptions" :key="m" :value="m">{{ formatYM(m) }}</option>
            </select>
          </div>
        </div>

        <!-- ページタブ -->
        <div class="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            @click="activeTab = 'kpi'"
            class="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
            :class="activeTab === 'kpi' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'"
          >KPI</button>
          <button
            @click="activeTab = 'history'; fetchMonthlyHistory()"
            class="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
            :class="activeTab === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'"
          >これまでのデータ</button>
        </div>
      </div>

      <!-- 表示期間ラベル -->
      <div v-if="viewMode === 'monthly' && selectedMonth" class="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700">
        <span class="text-blue-400">📅</span>
        {{ formatYM(selectedMonth) }} のデータを表示中
      </div>

      <!-- ─── KPIタブ ─── -->
      <div v-if="activeTab === 'kpi'">
        <!-- KPIカードグリッド -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          <div
            v-for="card in kpiCards"
            :key="card.label"
            class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
          >
            <p class="text-xs text-gray-500 mb-0.5 leading-tight">{{ card.label }}</p>
            <p v-if="card.note" class="text-[10px] text-gray-400 mb-1">{{ card.note }}</p>
            <p class="text-xl font-bold text-gray-900">
              {{ card.value }}<span class="text-sm font-normal text-gray-500 ml-0.5">{{ card.unit }}</span>
            </p>
          </div>
        </div>

        <!-- 失注理由 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <p class="text-sm font-semibold text-gray-800 mb-2">失注理由ランキング</p>
          <p class="text-sm text-gray-400" v-if="funnelKpi.lost_reason_ranking.length === 0">データなし</p>
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="(r, idx) in funnelKpi.lost_reason_ranking.slice(0, 5)"
              :key="`lost-${r.reason_name}`"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
              :class="idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'"
            >
              <span class="font-bold">{{ idx + 1 }}</span> {{ r.reason_name }}: {{ r.count }}件
            </span>
          </div>
        </div>

        <!-- 流入経路タブ -->
        <div class="mb-4">
          <p class="text-sm text-gray-600 mb-2">流入経路フィルタ</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in sourceCompanyOptions"
              :key="`lt-source-tab-${opt}`"
              class="px-3 py-1.5 rounded-lg text-sm border transition-colors"
              :class="sourceCompanyFilter === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
              @click="onSelectSource(opt)"
            >
              {{ opt === 'ALL' ? 'すべて' : opt }}
            </button>
          </div>
        </div>

        <!-- 面談メトリクス -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p class="text-xs text-gray-500">設定数（面談決定）</p>
              <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.settings_count }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p class="text-xs text-gray-500">面談数（初回）</p>
              <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.first_interviews_count }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p class="text-xs text-gray-500">面談数（2回目）</p>
              <p class="text-xl font-bold text-gray-900">{{ interviewMetrics.account_summary.second_interviews_count }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p class="text-xs text-gray-500">設定→初回 リードタイム</p>
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
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">流入経路</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">初回</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">2回目</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">合計</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="row in monthlyInterviewBySource" :key="`lead-monthly-${row.source_company}`">
                    <td class="px-3 py-2 text-gray-900">{{ row.source_company }}</td>
                    <td class="px-3 py-2 text-right font-semibold">{{ row.first }}</td>
                    <td class="px-3 py-2 text-right font-semibold">{{ row.second }}</td>
                    <td class="px-3 py-2 text-right font-bold text-blue-700">{{ row.total }}</td>
                  </tr>
                  <tr v-if="monthlyInterviewBySource.length === 0">
                    <td colspan="4" class="px-3 py-6 text-center text-gray-400">対象月の面談データはありません。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 日別申込/設定数テーブル -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-2">日別申込/設定数</h3>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[360px] text-xs">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-gray-500">日付</th>
                  <th class="px-3 py-2 text-right text-gray-500">申込数</th>
                  <th class="px-3 py-2 text-right text-gray-500">設定数（予約登録日）</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="d in dailyApplicationSettingRows" :key="`lead-daily-${d.day}`">
                  <td class="px-3 py-2 text-gray-700">{{ formatDate(d.day) }}</td>
                  <td class="px-3 py-2 text-right text-gray-900">{{ d.applications }}</td>
                  <td class="px-3 py-2 text-right text-gray-900">{{ d.settings }}</td>
                </tr>
                <tr v-if="dailyApplicationSettingRows.length === 0">
                  <td class="px-3 py-3 text-gray-400 text-center" colspan="3">データがありません</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ─── これまでのデータタブ ─── -->
      <div v-if="activeTab === 'history'">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100">
            <h2 class="text-base font-semibold text-gray-900">月別KPI履歴</h2>
            <p class="text-xs text-gray-500 mt-0.5">各月の主要KPIを一覧で確認できます</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600">月</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">申込数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">予約数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">面談設定数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">面談実施数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">飛ばれ数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">リスケ数</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">申込→予約率</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">予約→面談率</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">飛ばれ率</th>
                  <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600">リスケ率</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="row in monthlyHistory"
                  :key="`hist-${row.month}`"
                  class="hover:bg-gray-50 transition-colors"
                  :class="row.month === currentYM() ? 'bg-blue-50' : ''"
                >
                  <td class="px-4 py-3 font-semibold text-gray-900">
                    {{ formatYM(row.month) }}
                    <span v-if="row.month === currentYM()" class="ml-2 text-xs text-blue-600 font-normal">当月</span>
                  </td>
                  <td class="px-3 py-3 text-right text-gray-700">{{ row.applications_students }}</td>
                  <td class="px-3 py-3 text-right text-gray-700">{{ row.reserved_students }}</td>
                  <td class="px-3 py-3 text-right text-gray-700">{{ row.interview_scheduled_students }}</td>
                  <td class="px-3 py-3 text-right font-semibold text-emerald-700">{{ row.interviewed_students }}</td>
                  <td class="px-3 py-3 text-right text-red-600">{{ row.no_show_students }}</td>
                  <td class="px-3 py-3 text-right text-yellow-600">{{ row.rescheduled_students }}</td>
                  <td class="px-3 py-3 text-right text-gray-700">{{ Number(row.application_to_reservation_rate || 0).toFixed(1) }}%</td>
                  <td class="px-3 py-3 text-right text-gray-700">{{ Number(row.reservation_to_interview_rate || 0).toFixed(1) }}%</td>
                  <td class="px-3 py-3 text-right text-red-600">{{ Number(row.no_show_rate || 0).toFixed(1) }}%</td>
                  <td class="px-3 py-3 text-right text-yellow-600">{{ Number(row.reschedule_rate || 0).toFixed(1) }}%</td>
                </tr>
                <tr v-if="monthlyHistory.length === 0">
                  <td colspan="11" class="px-4 py-8 text-center text-gray-400">データがありません</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
