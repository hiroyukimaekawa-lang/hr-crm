<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Layout from '../components/Layout.vue';
import { api } from '../lib/api';

/* ───────── 型定義 ───────── */
interface EventKgi {
  event_id: number;
  event_title: string;
  deadline: string | null;
  days_remaining: number;
  target_seats: number;
  current_seats: number;
  target_entry: number;
  kpi_target_entry: number;
  kpi_rate: number;
  current_entry: number;
  daily_entry_gap: number;
}

interface EventDetail {
  id: number;
  title: string;
  target_seats?: number | null;
  unit_price?: number | null;
  kpi_seat_to_entry_rate?: number | null;
  kpi_entry_to_interview_rate?: number | null;
  kpi_interview_to_inflow_rate?: number | null;
  kpi_custom_steps?: string | null;
}

interface KpiCustomStep {
  label: string;
  rate: number;
  position: number; // 1=着座↔エントリー間, 2=エントリー↔面談間, 3=面談↔流入数間, 4=流入数の後
}

/* ───────── 状態 ───────── */
const kgiList   = ref<EventKgi[]>([]);
const eventDetails = ref<EventDetail[]>([]);
const loading   = ref(false);
const activeTab = ref<'all' | number>('all');
const route     = useRoute();
const showExpired = ref(false);

const activeKgiList = computed(() =>
  kgiList.value.filter(kgi => {
    if (!kgi.deadline) return true;
    return kgi.days_remaining >= -1;
  })
);

const expiredKgiList = computed(() =>
  kgiList.value.filter(kgi => {
    if (!kgi.deadline) return false;
    return kgi.days_remaining < -1;
  })
);

/* ───────── データ取得 ───────── */
const fetchData = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const [kgiRes, evRes] = await Promise.all([
      api.get('/api/events/kgi-progress', { headers: { Authorization: token } }),
      api.get('/api/events',              { headers: { Authorization: token } })
    ]);
    kgiList.value      = Array.isArray(kgiRes.data) ? kgiRes.data : [];
    eventDetails.value = Array.isArray(evRes.data)  ? evRes.data  : [];
    
    // クエリパラメータから初期タブを設定
    const queryId = route.query.eventId;
    if (queryId) {
      activeTab.value = Number(queryId);
    }
  } finally {
    loading.value = false;
  }
};
onMounted(fetchData);

/* ───────── ユーティリティ ───────── */
const toRate = (v: number | null | undefined, fallback = 70) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 100);
};

const parseCustomSteps = (raw: string | null | undefined): KpiCustomStep[] => {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.map((x: any) => ({
      label: String(x?.label || ''),
      rate: Number(x?.rate || 0),
      position: Number(x?.position || 4)
    })).filter(x => x.label && x.rate > 0);
  } catch { return []; }
};

const progressPct = (current: number, target: number) =>
  target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

const gapClass = (gap: number) =>
  gap >= 0 ? 'text-green-600' : gap >= -3 ? 'text-yellow-600' : 'text-red-600';

const gapBgClass = (gap: number) =>
  gap >= 0 ? 'bg-green-50 border-green-200' : gap >= -3 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

const formatDeadline = (d: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

/* ───────── KPI逆算（1イベント分） ───────── */
const buildDerived = (kgi: EventKgi | null, detail: EventDetail | null) => {
  if (!kgi) return null;
  const seatToEntry      = toRate(detail?.kpi_seat_to_entry_rate, 70) / 100;
  const entryToInterview = toRate(detail?.kpi_entry_to_interview_rate, 60) / 100;
  const interviewToInflow= toRate(detail?.kpi_interview_to_inflow_rate, 50) / 100;

  // カスタムステップをpositionでグループ化
  const allSteps = parseCustomSteps(detail?.kpi_custom_steps);
  const byPos: Record<number, KpiCustomStep[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const s of allSteps) {
    const pos = s.position >= 1 && s.position <= 4 ? s.position : 4;
    if (!byPos[pos]) byPos[pos] = [];
    (byPos[pos] as KpiCustomStep[]).push(s);
  }

  const targetSeats  = kgi.target_seats;
  const currentSeats = kgi.current_seats;
  const currentEntry = kgi.current_entry;
  const days         = Math.max(kgi.days_remaining, 0);

  // チェーンビルダー: 前ステップ値から各カスタムステップの目標を逆算
  const buildChain = (steps: KpiCustomStep[], prevVal: number) => {
    const chain: Array<{ label: string; target: number; daily: number; rate: number; position: number }> = [];
    let v = prevVal;
    for (const s of steps) {
      const r = toRate(s.rate) / 100;
      const tgt = v > 0 ? Math.ceil(v / r) : 0;
      chain.push({ label: s.label, target: tgt, daily: days > 0 ? +(tgt / days).toFixed(1) : 0, rate: toRate(s.rate), position: s.position });
      v = tgt;
    }
    return { chain, last: v };
  };

  // 固定ステップ間にカスタムステップを挿入して逆算
  const { chain: pos1Chain, last: afterPos1 } = buildChain(byPos[1] ?? [], targetSeats);
  const targetEntry     = afterPos1 > 0 ? Math.ceil(afterPos1 / seatToEntry) : 0;

  const { chain: pos2Chain, last: afterPos2 } = buildChain(byPos[2] ?? [], targetEntry);
  const targetInterview = afterPos2 > 0 ? Math.ceil(afterPos2 / entryToInterview) : 0;

  const { chain: pos3Chain, last: afterPos3 } = buildChain(byPos[3] ?? [], targetInterview);
  const targetInflow    = afterPos3 > 0 ? Math.ceil(afterPos3 / interviewToInflow) : 0;

  const { chain: pos4Chain } = buildChain(byPos[4] ?? [], targetInflow);

  const dailySeat      = days > 0 ? +((targetSeats - currentSeats) / days).toFixed(1) : 0;
  const dailyEntry     = days > 0 ? +((targetEntry - currentEntry) / days).toFixed(1) : 0;
  const dailyInterview = days > 0 ? +(targetInterview / days).toFixed(1) : 0;
  const dailyInflow    = days > 0 ? +(targetInflow / days).toFixed(1) : 0;

  // デイリーカード用に全カスタムステップを結合
  const customDerived = [...pos1Chain, ...pos2Chain, ...pos3Chain, ...pos4Chain];

  return {
    targetSeats, targetEntry, targetInterview, targetInflow,
    currentSeats, currentEntry,
    seatPct:   progressPct(currentSeats, targetSeats),
    entryPct:  progressPct(currentEntry, targetEntry),
    seatGap:   currentSeats - targetSeats,
    entryGap:  currentEntry - targetEntry,
    days,
    deadline: kgi.deadline,
    dailySeat, dailyEntry, dailyInterview, dailyInflow,
    seatToEntryRate:       toRate(detail?.kpi_seat_to_entry_rate, 70),
    entryToInterviewRate:  toRate(detail?.kpi_entry_to_interview_rate, 60),
    interviewToInflowRate: toRate(detail?.kpi_interview_to_inflow_rate, 50),
    pos1Chain, pos2Chain, pos3Chain, pos4Chain,
    customDerived,
    unitPrice: Number(detail?.unit_price || 0)
  };
};

/* ───────── 選択中イベントの導出データ ───────── */
const selectedKgi = computed(() => {
  if (activeTab.value === 'all') return null;
  return kgiList.value.find(k => k.event_id === activeTab.value) || null;
});

const selectedDetail = computed(() => {
  if (activeTab.value === 'all') return null;
  return eventDetails.value.find(e => e.id === activeTab.value) || null;
});

const derived = computed(() => buildDerived(selectedKgi.value, selectedDetail.value));

/* ───────── 全体集計 ───────── */
const allDerived = computed(() => {
  let totalTargetSeats   = 0;
  let totalTargetEntry   = 0;
  let totalCurrentSeats  = 0;
  let totalCurrentEntry  = 0;
  let totalTargetSales   = 0;
  let totalCurrentSales  = 0;
  let minDays            = Infinity;
  let nearestDeadline: string | null = null;

  activeKgiList.value.forEach(kgi => {
    const detail = eventDetails.value.find(e => e.id === kgi.event_id);
    const seatToEntry = toRate(detail?.kpi_seat_to_entry_rate, 70) / 100;
    const tEntry = kgi.target_seats > 0 ? Math.ceil(kgi.target_seats / seatToEntry) : 0;
    const unitPrice = Number(detail?.unit_price || 0);

    totalTargetSeats  += kgi.target_seats;
    totalTargetEntry  += tEntry;
    totalCurrentSeats += kgi.current_seats;
    totalCurrentEntry += kgi.current_entry;
    totalTargetSales  += unitPrice * kgi.target_seats;
    totalCurrentSales += unitPrice * kgi.current_seats;

    if (kgi.days_remaining > 0 && kgi.days_remaining < minDays) {
      minDays = kgi.days_remaining;
      nearestDeadline = kgi.deadline;
    }
  });

  const days = minDays === Infinity ? 0 : minDays;
  return {
    totalTargetSeats,  totalTargetEntry,
    totalCurrentSeats, totalCurrentEntry,
    totalTargetSales,  totalCurrentSales,
    salesGap: totalCurrentSales - totalTargetSales,
    seatPct:   progressPct(totalCurrentSeats, totalTargetSeats),
    entryPct:  progressPct(totalCurrentEntry, totalTargetEntry),
    seatGap:   totalCurrentSeats  - totalTargetSeats,
    entryGap:  totalCurrentEntry  - totalTargetEntry,
    days,
    nearestDeadline,
    dailySeat:  days > 0 ? +((totalTargetSeats - totalCurrentSeats) / days).toFixed(1) : 0,
    dailyEntry: days > 0 ? +((totalTargetEntry - totalCurrentEntry) / days).toFixed(1) : 0,
    eventCount: activeKgiList.value.length
  };
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">

      <!-- ヘッダー -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">KPIダッシュボード</h1>
        <p class="text-sm text-gray-500 mt-1">各イベントのKGI進捗とデイリー必要数を確認できます。</p>
      </div>

      <div v-if="loading" class="text-center py-20 text-gray-400">読み込み中...</div>
      <div v-else>

        <!-- タブ -->
        <div class="flex overflow-x-auto gap-1 mb-6 border-b border-gray-200 pb-0">
          <button
            class="px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors border-b-2"
            :class="activeTab === 'all'
              ? 'bg-white text-blue-700 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-800'"
            @click="activeTab = 'all'"
          >全体</button>
          <button
            v-for="kgi in activeKgiList"
            :key="kgi.event_id"
            class="px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors border-b-2 max-w-[180px] truncate"
            :class="activeTab === kgi.event_id
              ? 'bg-white text-blue-700 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-800'"
            :title="kgi.event_title"
            @click="activeTab = kgi.event_id"
          >{{ kgi.event_title }}</button>
        </div>

        <!-- ══════════ 全体タブ ══════════ -->
        <div v-if="activeTab === 'all'">
          <!-- 売上サマリー（目標/現状/乖離） -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">目標売上 合計</p>
              <p class="text-3xl font-black text-emerald-700">{{ allDerived.totalTargetSales.toLocaleString() }}<span class="text-base font-semibold text-emerald-400 ml-1">円</span></p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">現状売上 合計</p>
              <p class="text-3xl font-black text-blue-700">{{ allDerived.totalCurrentSales.toLocaleString() }}<span class="text-base font-semibold text-blue-400 ml-1">円</span></p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p class="text-xs text-gray-500 mb-2">売上乖離</p>
              <p class="text-3xl font-black" :class="allDerived.salesGap >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ allDerived.salesGap >= 0 ? '+' : '' }}{{ allDerived.salesGap.toLocaleString() }}<span class="text-base font-semibold ml-1">円</span>
              </p>
            </div>
          </div>

          <!-- イベント別一覧 -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-sm font-bold text-gray-800 mb-4">イベント別 KGI一覧</p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">イベント名</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">締日</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">残日数</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-blue-600">目標着座</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-blue-400">現着座</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-indigo-600">目標エントリー</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-indigo-400">現エントリー</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">乖離</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">売上目標</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="kgi in activeKgiList" :key="`all-row-${kgi.event_id}`"
                      class="hover:bg-gray-50 cursor-pointer"
                      @click="activeTab = kgi.event_id">
                    <td class="px-3 py-2.5 text-blue-700 font-semibold hover:underline max-w-[200px] truncate" :title="kgi.event_title">
                      {{ kgi.event_title }}
                    </td>
                    <td class="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{{ formatDeadline(kgi.deadline) }}</td>
                    <td class="px-3 py-2.5 text-right" :class="kgi.days_remaining <= 0 ? 'text-gray-400' : 'font-semibold text-gray-700'">
                      {{ kgi.deadline ? kgi.days_remaining : '-' }}
                    </td>
                    <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ kgi.target_seats || '-' }}</td>
                    <td class="px-3 py-2.5 text-right text-blue-500">{{ kgi.current_seats }}</td>
                    <td class="px-3 py-2.5 text-right text-indigo-700 font-semibold">{{ kgi.kpi_target_entry || '-' }}</td>
                    <td class="px-3 py-2.5 text-right text-indigo-500">{{ kgi.current_entry }}</td>
                    <td class="px-3 py-2.5 text-right font-bold" :class="gapClass(kgi.current_entry - kgi.kpi_target_entry)">
                      {{ (kgi.current_entry - kgi.kpi_target_entry) >= 0 ? '+' : '' }}{{ kgi.current_entry - kgi.kpi_target_entry }}
                    </td>
                    <td class="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                      {{ (Number(eventDetails.find(e => e.id === kgi.event_id)?.unit_price || 0) * kgi.target_seats).toLocaleString() }}円
                    </td>
                  </tr>
                  <tr v-if="activeKgiList.length === 0">
                    <td colspan="9" class="px-3 py-10 text-center text-gray-400">データがありません</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 終了済みイベント（折りたたみ） -->
          <div v-if="expiredKgiList.length > 0" class="mt-4">
            <button
              @click="showExpired = !showExpired"
              class="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <span>{{ showExpired ? '▲' : '▼' }}</span>
              終了済みイベント（{{ expiredKgiList.length }}件）
            </button>
            <div v-if="showExpired" class="mt-2 overflow-x-auto opacity-50">
              <table class="w-full text-sm">
                <tbody>
                  <tr v-for="kgi in expiredKgiList" :key="`expired-${kgi.event_id}`"
                      class="hover:bg-gray-50 cursor-pointer"
                      @click="activeTab = kgi.event_id">
                    <td class="px-3 py-2 text-gray-500 max-w-[200px] truncate" :title="kgi.event_title">{{ kgi.event_title }}</td>
                    <td class="px-3 py-2 text-right text-gray-400 font-mono">{{ formatDeadline(kgi.deadline) }}</td>
                    <td class="px-3 py-2 text-right text-gray-400 font-mono">{{ kgi.days_remaining }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ kgi.target_seats || '-' }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ kgi.current_seats }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ kgi.kpi_target_entry || '-' }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ kgi.current_entry }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">-</td>
                    <td class="px-3 py-2 text-right text-gray-400">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ══════════ イベント別タブ ══════════ -->
        <div v-else-if="derived">
          <!-- イベント情報ヘッダー -->
          <div class="flex items-center gap-3 mb-6">
            <div class="flex-1">
              <h2 class="text-xl font-bold text-gray-900">{{ selectedKgi?.event_title }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">
                締日: {{ formatDeadline(derived.deadline) }} &nbsp;|&nbsp; 残 <span class="font-semibold text-gray-800">{{ derived.days }}</span> 日
                &nbsp;|&nbsp; 着座率: {{ derived.seatToEntryRate }}%
              </p>
            </div>
          </div>

          <!-- KGIゲージ 3枚 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <!-- 着座 -->
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <p class="text-xs font-semibold text-gray-500 uppercase mb-3">目標着座数</p>
              <div class="flex items-end gap-2 mb-3">
                <span class="text-4xl font-black text-blue-700">{{ derived.currentSeats }}</span>
                <span class="text-gray-400 mb-0.5 text-sm">/ {{ derived.targetSeats }} 名</span>
              </div>
              <div class="h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div class="h-full rounded-full transition-all duration-700"
                     :class="derived.seatPct >= 80 ? 'bg-blue-500' : derived.seatPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'"
                     :style="{ width: `${derived.seatPct}%` }" />
              </div>
              <div class="flex justify-between text-xs text-gray-400">
                <span>{{ derived.seatPct }}%</span>
                <span class="font-semibold" :class="gapClass(derived.seatGap)">
                  乖離: {{ derived.seatGap >= 0 ? '+' : '' }}{{ derived.seatGap }}名
                </span>
              </div>
            </div>

            <!-- エントリー -->
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <p class="text-xs font-semibold text-gray-500 uppercase mb-3">目標エントリー数</p>
              <div class="flex items-end gap-2 mb-3">
                <span class="text-4xl font-black text-indigo-700">{{ derived.currentEntry }}</span>
                <span class="text-gray-400 mb-0.5 text-sm">/ {{ derived.targetEntry }} 名</span>
              </div>
              <div class="h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div class="h-full rounded-full transition-all duration-700"
                     :class="derived.entryPct >= 80 ? 'bg-indigo-500' : derived.entryPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'"
                     :style="{ width: `${derived.entryPct}%` }" />
              </div>
              <div class="flex justify-between text-xs text-gray-400">
                <span>{{ derived.entryPct }}%</span>
                <span class="font-semibold" :class="gapClass(derived.entryGap)">
                  乖離: {{ derived.entryGap >= 0 ? '+' : '' }}{{ derived.entryGap }}名
                </span>
              </div>
            </div>

            <!-- 売上見込み -->
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <p class="text-xs font-semibold text-gray-500 uppercase mb-3">売上見込み</p>
              <p class="text-3xl font-black text-emerald-700 mb-1">
                {{ (derived.unitPrice * derived.currentSeats).toLocaleString() }}
                <span class="text-base font-semibold text-emerald-400 ml-1">円</span>
              </p>
              <p class="text-xs text-gray-400">目標: {{ (derived.unitPrice * derived.targetSeats).toLocaleString() }}円</p>
              <p class="text-xs text-gray-400">単価: {{ derived.unitPrice.toLocaleString() }}円</p>
            </div>
          </div>

          <!-- デイリー必要数カード -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-bold text-gray-800">デイリー必要数</p>
              <span class="text-xs text-gray-500">残 {{ derived.days }} 日で達成するために必要な1日あたりの数</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <!-- 着座/日 -->
              <div class="rounded-xl border p-4 text-center" :class="gapBgClass(derived.dailySeat)">
                <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">着座/日</p>
                <p class="text-3xl font-black" :class="gapClass(derived.dailySeat)">{{ derived.dailySeat }}</p>
                <p class="text-[10px] text-gray-400 mt-1">名/日必要</p>
              </div>
              <!-- エントリー/日 -->
              <div class="rounded-xl border p-4 text-center" :class="gapBgClass(derived.dailyEntry)">
                <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">エントリー/日</p>
                <p class="text-3xl font-black" :class="gapClass(derived.dailyEntry)">{{ derived.dailyEntry }}</p>
                <p class="text-[10px] text-gray-400 mt-1">{{ derived.seatToEntryRate }}%着座率</p>
              </div>
              <!-- 面談/日 -->
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">面談/日</p>
                <p class="text-3xl font-black text-amber-700">{{ derived.dailyInterview }}</p>
                <p class="text-[10px] text-gray-400 mt-1">{{ derived.entryToInterviewRate }}%面談化率</p>
              </div>
              <!-- 流入/日 -->
              <div class="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
                <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">流入/日</p>
                <p class="text-3xl font-black text-violet-700">{{ derived.dailyInflow }}</p>
                <p class="text-[10px] text-gray-400 mt-1">{{ derived.interviewToInflowRate }}%設定率</p>
              </div>
              <!-- カスタムステップ -->
              <div
                v-for="(c, idx) in derived.customDerived"
                :key="`custom-daily-${idx}`"
                class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center"
              >
                <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">{{ c.label }}/日</p>
                <p class="text-3xl font-black text-gray-700">{{ c.daily }}</p>
                <p class="text-[10px] text-gray-400 mt-1">{{ c.rate }}%</p>
              </div>
            </div>
          </div>

          <!-- KPI視覚的ファネル -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-sm font-bold text-gray-800 mb-8">KPIファネル進捗 — 目標達成へのフロー</p>
            
            <div class="max-w-xl mx-auto space-y-4">
              <!-- ステップ描画用の関数を模倣したテンプレート -->
              <template v-if="derived">
                
                <!-- 1. 設定数（流入数） -->
                <div class="relative">
                  <div class="bg-violet-50 border border-violet-200 rounded-xl p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-violet-700 uppercase">設定数（流入数）</span>
                      <span class="text-xs text-violet-500">デイリー {{ derived.dailyInflow }}/日</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-3xl font-black text-violet-900">{{ derived.targetInflow }}</span>
                      <span class="text-sm text-violet-400 font-semibold">名（目標）</span>
                    </div>
                  </div>
                  <!-- 矢印 & 割合 -->
                  <div class="flex flex-col items-center py-2">
                    <div class="w-px h-6 bg-gray-200"></div>
                    <div class="text-[10px] font-bold text-gray-400 px-2 py-0.5 border border-gray-100 rounded bg-white -my-1 z-10">
                      設定率 {{ derived.interviewToInflowRate }}%
                    </div>
                    <div class="w-px h-6 bg-gray-200"></div>
                  </div>
                </div>

                <!-- 2. 面談数 -->
                <div class="relative">
                  <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-amber-700 uppercase">面談数</span>
                      <span class="text-xs text-amber-500">デイリー {{ derived.dailyInterview }}/日</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-3xl font-black text-amber-900">{{ derived.targetInterview }}</span>
                      <span class="text-sm text-amber-400 font-semibold">名（目標）</span>
                    </div>
                  </div>
                  <!-- 矢印 & 割合 -->
                  <div class="flex flex-col items-center py-2">
                    <div class="w-px h-6 bg-gray-200"></div>
                    <div class="text-[10px] font-bold text-gray-400 px-2 py-0.5 border border-gray-100 rounded bg-white -my-1 z-10">
                      面談化率 {{ derived.entryToInterviewRate }}%
                    </div>
                    <div class="w-px h-6 bg-gray-200"></div>
                  </div>
                </div>

                <!-- 3. エントリー数 -->
                <div class="relative">
                  <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-indigo-700 uppercase">エントリー数</span>
                      <span class="text-xs text-indigo-500">現{{ derived.currentEntry }}名</span>
                    </div>
                    <div class="flex items-baseline gap-2 mb-2">
                      <span class="text-3xl font-black text-indigo-900">{{ derived.targetEntry }}</span>
                      <span class="text-sm text-indigo-400 font-semibold">名（目標）</span>
                    </div>
                    <div class="h-2 bg-indigo-100 rounded-full overflow-hidden">
                      <div class="h-full bg-indigo-600 rounded-full transition-all duration-700" :style="{ width: `${derived.entryPct}%` }"></div>
                    </div>
                    <div class="flex justify-between mt-1">
                      <span class="text-[10px] font-bold text-indigo-400">{{ derived.entryPct }}% 達成</span>
                      <span class="text-[10px] font-bold" :class="gapClass(derived.entryGap)">
                        乖離 {{ derived.entryGap >= 0 ? '+' : '' }}{{ derived.entryGap }}
                      </span>
                    </div>
                  </div>
                  <!-- 矢印 & 割合 -->
                  <div class="flex flex-col items-center py-2">
                    <div class="w-px h-6 bg-gray-200"></div>
                    <div class="text-[10px] font-bold text-gray-400 px-2 py-0.5 border border-gray-100 rounded bg-white -my-1 z-10">
                      着座率 {{ derived.seatToEntryRate }}%
                    </div>
                    <div class="w-px h-6 bg-gray-200"></div>
                  </div>
                </div>

                <!-- 4. 着座数 (最終目標) -->
                <div class="relative">
                  <div class="bg-blue-600 border border-blue-700 rounded-xl p-5 shadow-md shadow-blue-100">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-blue-100 uppercase">着座数（最終目標）</span>
                      <span class="text-xs text-blue-200 font-bold">現{{ derived.currentSeats }}名</span>
                    </div>
                    <div class="flex items-baseline gap-2 mb-3">
                      <span class="text-4xl font-black text-white">{{ derived.targetSeats }}</span>
                      <span class="text-sm text-blue-200 font-semibold">名（目標）</span>
                    </div>
                    <div class="h-3 bg-blue-800/50 rounded-full overflow-hidden">
                      <div class="h-full bg-white rounded-full transition-all duration-700" :style="{ width: `${derived.seatPct}%` }"></div>
                    </div>
                    <div class="flex justify-between mt-2">
                      <span class="text-xs font-bold text-blue-100">{{ derived.seatPct }}% 達成</span>
                      <span class="text-xs font-bold text-white bg-blue-500/50 px-2 py-0.5 rounded">
                        乖離 {{ derived.seatGap >= 0 ? '+' : '' }}{{ derived.seatGap }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- カスタムステップ表示 (もしあれば、補足として下に表示するか、挿入するか) -->
                <div v-if="derived.customDerived.length > 0" class="mt-10 pt-6 border-t border-gray-100">
                  <p class="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">追加の管理指標</p>
                  <div class="grid grid-cols-2 gap-3">
                    <div v-for="(c, idx) in derived.customDerived" :key="`funnel-custom-${idx}`" class="bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <p class="text-[10px] font-bold text-gray-500 mb-1">{{ c.label }}</p>
                      <div class="flex items-baseline gap-1">
                        <span class="text-lg font-black text-gray-700">{{ c.target }}</span>
                        <span class="text-[10px] text-gray-400">名</span>
                      </div>
                      <p class="text-[9px] text-gray-400 mt-1">割合 {{ c.rate }}% | デイリー {{ c.daily }}</p>
                    </div>
                  </div>
                </div>

              </template>
            </div>
          </div>
        </div>

        <!-- データなし -->
        <div v-else class="text-center py-20 text-gray-400">
          <p>対象イベントのデータがありません。</p>
        </div>

      </div>
    </div>
  </Layout>
</template>
