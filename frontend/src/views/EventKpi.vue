<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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
}

/* ───────── 状態 ───────── */
const kgiList   = ref<EventKgi[]>([]);
const eventDetails = ref<EventDetail[]>([]);
const loading   = ref(false);
const activeTab = ref<'all' | number>('all');

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
    return p.map((x: any) => ({ label: String(x?.label || ''), rate: Number(x?.rate || 0) }))
            .filter(x => x.label && x.rate > 0);
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
  const customSteps      = parseCustomSteps(detail?.kpi_custom_steps);

  const targetSeats   = kgi.target_seats;
  const targetEntry   = targetSeats > 0 ? Math.ceil(targetSeats / seatToEntry) : 0;
  const targetInterview = targetEntry > 0 ? Math.ceil(targetEntry / entryToInterview) : 0;
  const targetInflow  = targetInterview > 0 ? Math.ceil(targetInterview / interviewToInflow) : 0;

  const currentSeats  = kgi.current_seats;
  const currentEntry  = kgi.current_entry;
  const days          = Math.max(kgi.days_remaining, 0);

  const dailySeat      = days > 0 ? +((targetSeats - currentSeats) / days).toFixed(1) : 0;
  const dailyEntry     = days > 0 ? +((targetEntry - currentEntry) / days).toFixed(1) : 0;
  const dailyInterview = days > 0 ? +(targetInterview / days).toFixed(1) : 0;
  const dailyInflow    = days > 0 ? +(targetInflow / days).toFixed(1) : 0;

  // カスタムステップ
  let prevTarget = targetInflow;
  const customDerived = customSteps.map(s => {
    const rate = toRate(s.rate) / 100;
    const tgt  = prevTarget > 0 ? Math.ceil(prevTarget / rate) : 0;
    const daily = days > 0 ? +(tgt / days).toFixed(1) : 0;
    prevTarget = tgt;
    return { label: s.label, target: tgt, daily, rate: toRate(s.rate) };
  });

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

  kgiList.value.forEach(kgi => {
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
    eventCount: kgiList.value.length
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
            v-for="kgi in kgiList"
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
                  <tr v-for="kgi in kgiList" :key="`all-row-${kgi.event_id}`"
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
                  <tr v-if="kgiList.length === 0">
                    <td colspan="9" class="px-3 py-10 text-center text-gray-400">データがありません</td>
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

          <!-- KPI逆算テーブル -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-sm font-bold text-gray-800 mb-4">KPI逆算 — 目標達成に必要な絶対数</p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">ファネル段階</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">目標数</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">割合</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500">デイリー必要</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 font-semibold text-blue-700">着座数</td>
                    <td class="px-3 py-2.5 text-right font-bold text-blue-700">{{ derived.targetSeats }}名</td>
                    <td class="px-3 py-2.5 text-right text-gray-500">-</td>
                    <td class="px-3 py-2.5 text-right font-bold" :class="gapClass(derived.dailySeat)">{{ derived.dailySeat }}/日</td>
                  </tr>
                  <tr class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 font-semibold text-indigo-700">エントリー数</td>
                    <td class="px-3 py-2.5 text-right font-bold text-indigo-700">{{ derived.targetEntry }}名</td>
                    <td class="px-3 py-2.5 text-right text-gray-500">着座率 {{ derived.seatToEntryRate }}%</td>
                    <td class="px-3 py-2.5 text-right font-bold" :class="gapClass(derived.dailyEntry)">{{ derived.dailyEntry }}/日</td>
                  </tr>
                  <tr class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 font-semibold text-amber-700">面談数</td>
                    <td class="px-3 py-2.5 text-right font-bold text-amber-700">{{ derived.targetInterview }}名</td>
                    <td class="px-3 py-2.5 text-right text-gray-500">面談化率 {{ derived.entryToInterviewRate }}%</td>
                    <td class="px-3 py-2.5 text-right font-bold text-amber-700">{{ derived.dailyInterview }}/日</td>
                  </tr>
                  <tr class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 font-semibold text-violet-700">流入数（設定数）</td>
                    <td class="px-3 py-2.5 text-right font-bold text-violet-700">{{ derived.targetInflow }}名</td>
                    <td class="px-3 py-2.5 text-right text-gray-500">設定率 {{ derived.interviewToInflowRate }}%</td>
                    <td class="px-3 py-2.5 text-right font-bold text-violet-700">{{ derived.dailyInflow }}/日</td>
                  </tr>
                  <tr v-for="(c, idx) in derived.customDerived" :key="`tbl-${idx}`" class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 font-semibold text-gray-700">{{ c.label }}</td>
                    <td class="px-3 py-2.5 text-right font-bold text-gray-700">{{ c.target }}名</td>
                    <td class="px-3 py-2.5 text-right text-gray-500">{{ c.rate }}%</td>
                    <td class="px-3 py-2.5 text-right font-bold text-gray-700">{{ c.daily }}/日</td>
                  </tr>
                </tbody>
              </table>
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
