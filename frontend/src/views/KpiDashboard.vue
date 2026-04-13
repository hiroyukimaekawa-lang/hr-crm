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
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next';

// ─── State ───

const activeTab = ref<'monthly' | 'weekly' | 'daily' | 'event' | 'staff' | 'source'>('monthly');
const loading = ref(false);
const saving = ref(false);
const showExpired = ref(false);
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const selectedDate = ref(new Date().toISOString().slice(0, 10));

// Weekly calculation: get current ISO week
const getISOWeek = (date: Date) => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};
const selectedWeek = ref(getISOWeek(new Date()));

const overview = ref<KpiOverviewResponse | null>(null);
const eventKpi = ref<EventKpiItem[]>([]);
const staffOverview = ref<any[]>([]);
const sourceOverview = ref<any[]>([]);

// Goal editing
const showGoalEditor = ref(false);
const editorPeriodType = ref<'monthly' | 'weekly' | 'daily'>('monthly');
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

const eventAllocations = ref<Array<{
  event_id: number;
  event_title: string;
  unit_price: number;
  target_seats: number;
  guaranteed_sales: number;
  cvr_seat_to_entry: number;
  weight_pct: number;
  master_rate: number;
  entry_to_interview_rate: number;
  interview_to_res_rate: number;
  res_to_app_rate: number;
}>>([]);

// Event editing
const showEventEditor = ref(false);
const editingEvent = ref<EventKpiItem | null>(null);
const eventForm = ref({
  target_seats: 0,
  unit_price: 0,
  entry_deadline: '',
  kpi_seat_to_entry_rate: 70,
  kpi_entry_to_interview_rate: 60,
  kpi_interview_to_reservation_rate: 50,
  kpi_reservation_to_application_rate: 40,
  kpi_custom_steps: [] as any[],
});

// Inline event target editing (for weekly tab)
const editingEventTargetId = ref<number | null>(null);
const inlineTargetForm = ref({
  target_seats: 0,
  target_entries: 0,
});

const openInlineTargetEdit = (ev: EventKpiItem) => {
  editingEventTargetId.value = ev.event_id;
  inlineTargetForm.value = {
    target_seats: ev.target_seats || 0,
    target_entries: ev.target_entries || 0,
  };
};

const closeInlineTargetEdit = () => {
  editingEventTargetId.value = null;
};

const saveInlineTarget = async (ev: EventKpiItem) => {
  saving.value = true;
  try {
    const periodStart = selectedMonth.value + '-01';
    const goals = [
      {
        scope_type: 'event',
        scope_id: ev.event_id,
        period_type: 'monthly',
        period_start: periodStart,
        metric_key: 'target_seats',
        target_value: inlineTargetForm.value.target_seats,
      }
    ];
    // target_entriesは手動上書き用のカスタムキーとして保存
    if (inlineTargetForm.value.target_entries > 0) {
      goals.push({
        scope_type: 'event',
        scope_id: ev.event_id,
        period_type: 'monthly',
        period_start: periodStart,
        metric_key: 'target_entries_override',
        target_value: inlineTargetForm.value.target_entries,
      });
    }
    await kpiApi.updateGoals(goals);
    editingEventTargetId.value = null;
    await loadAll();
  } catch (err) {
    console.error('Failed to save inline target', err);
    alert('保存に失敗しました');
  } finally {
    saving.value = false;
  }
};

const expandedEvents = ref<Record<number, boolean>>({});
const toggleEvent = (eventId: number) => {
  expandedEvents.value[eventId] = !expandedEvents.value[eventId];
};

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
    // タブに応じて適切なパラメータのみ送信（複数同時送信すると500エラーになる）
    let params: Record<string, any> = {};
    if (activeTab.value === 'daily') {
      params = { date: selectedDate.value };
    } else if (activeTab.value === 'weekly') {
      params = { month: selectedMonth.value }; // 週次は月で取得
    } else {
      params = { month: selectedMonth.value };
    }
    const res = await kpiApi.getOverview(params);
    overview.value = res.data;
  } catch (err) {
    console.error('KPI overview fetch error:', err);
  } finally {
    loading.value = false;
  }
};

const fetchEvents = async () => {
  try {
    // Determine the period filters based on active tab
    // Always fetch events based on selectedMonth because event goals are tied to monthly decomposition
    const params: any = {
      period_type: 'monthly',
      month: selectedMonth.value
    };

    const res = await kpiApi.getEvents(params);
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
    // 常に月間（monthly）で goals を取得・表示する
    const periodType = 'monthly';
    const periodStart = selectedMonth.value + '-01';

    // 1. Fetch Global Goals
    const resGlobal = await kpiApi.getGoals({ 
      scope_type: 'global', 
      period_type: periodType, 
      month: selectedMonth.value,
    });
    const globalGoals: GoalSetting[] = resGlobal.data;
    
    // Reset global form
    goalForm.value = {
      sales_target: 0, required_seats: 0, required_entries: 0, required_interviews: 0,
      required_interview_settings: 0, required_inflow: 0,
      cvr_seat_to_entry: 70, cvr_entry_to_interview: 60, cvr_interview_to_setting: 50, cvr_inflow_to_setting: 40
    };
    for (const g of globalGoals) {
      if (g.metric_key in goalForm.value) {
        (goalForm.value as any)[g.metric_key] = Number(g.target_value);
      }
    }

    // 2. Fetch Event Specific Goals and merge with Master data
    const resEventGoals = await kpiApi.getGoals({ 
      scope_type: 'event', 
      period_type: periodType, 
      month: selectedMonth.value,
    });
    const eventGoalRows: GoalSetting[] = resEventGoals.data;

    // Filter events to only show those happening in the selected month
    const targetMonth = selectedMonth.value; // 'YYYY-MM'
    const filteredEvents = eventKpi.value.filter(e => {
        if (!e.deadline) return true; // Show events without deadline so they can be set
        return e.deadline.startsWith(targetMonth);
    });

    eventAllocations.value = filteredEvents.map(e => {
        const eventGoals = eventGoalRows.filter(g => Number(g.scope_id) === e.event_id);
        const goalSeats = eventGoals.find(g => g.metric_key === 'target_seats')?.target_value;
        const goalSales = eventGoals.find(g => g.metric_key === 'guaranteed_sales')?.target_value;
        const goalUnitPrice = eventGoals.find(g => g.metric_key === 'unit_price')?.target_value;
        const goalRate = eventGoals.find(g => g.metric_key === 'cvr_seat_to_entry')?.target_value;
        const goalWeight = eventGoals.find(g => g.metric_key === 'allocation_weight')?.target_value;

        const unitPrice = goalUnitPrice !== undefined ? Number(goalUnitPrice) : e.unit_price;
        const guaranteedSales = goalSales !== undefined ? Number(goalSales) : (unitPrice * e.target_seats);

        return {
            event_id: e.event_id,
            event_title: e.event_title,
            unit_price: unitPrice,
            target_seats: goalSeats !== undefined ? Number(goalSeats) : e.target_seats,
            guaranteed_sales: guaranteedSales,
            cvr_seat_to_entry: goalRate !== undefined ? Number(goalRate) : e.kpi_seat_to_entry_rate,
            weight_pct: goalWeight !== undefined ? Number(goalWeight) : (goalForm.value.sales_target > 0 ? Math.round((guaranteedSales / goalForm.value.sales_target) * 100) : 0),
            
            // Rates for reverse calculation
            master_rate: e.kpi_seat_to_entry_rate,
            entry_to_interview_rate: e.kpi_entry_to_interview_rate,
            interview_to_res_rate: (e as any).kpi_interview_to_reservation_rate || 50,
            res_to_app_rate: (e as any).kpi_reservation_to_application_rate || 40
        };
    });
  } catch (err) {
    console.error('KPI goals fetch error:', err);
  }
};

const openGoalEditor = (period: 'monthly' | 'weekly' | 'daily') => {
    editorPeriodType.value = period;
    fetchGoals();
    showGoalEditor.value = true;
};

const saveGoals = async () => {
  saving.value = true;
  try {
    // 月間目標は常にmonthlyで保存（period_startはYYYY-MM-01形式）
    const periodType = 'monthly';
    const periodStart = selectedMonth.value + '-01';
    const goals: GoalSetting[] = [];

    // 1. Global Goals
    Object.entries(goalForm.value).forEach(([key, value]) => {
      goals.push({
        scope_type: 'global',
        period_type: periodType,
        period_start: periodStart,
        metric_key: key,
        target_value: Number(value),
      });
    });

    // 2. Event Allocations
    eventAllocations.value.forEach(ea => {
      const base = {
        scope_type: 'event',
        scope_id: ea.event_id,
        period_type: periodType,
        period_start: periodStart
      };

      // seats
      goals.push({ ...base, metric_key: 'target_seats', target_value: ea.target_seats });
      // guaranteed sales
      goals.push({ ...base, metric_key: 'guaranteed_sales', target_value: ea.guaranteed_sales });
      // unit price override
      goals.push({ ...base, metric_key: 'unit_price', target_value: ea.unit_price });
      // weight override
      goals.push({ ...base, metric_key: 'allocation_weight', target_value: ea.weight_pct });
      // rate override
      goals.push({ ...base, metric_key: 'cvr_seat_to_entry', target_value: ea.cvr_seat_to_entry });
    });

    await kpiApi.updateGoals(goals);
    showGoalEditor.value = false;
    // 保存後にデータを再取得
    await fetchEvents();
    await fetchGoals();
    await fetchOverview();
  } catch (err) {
    console.error('KPI goals save error:', err);
    alert('保存に失敗しました。再試行してください。');
  } finally {
    saving.value = false;
  }
};

const onAllocationChange = (ea: any, field: 'guaranteed' | 'seats' | 'price' | 'weight') => {
  if (field === 'weight') {
    // Top-down: 確約金額 = 全体目標 × 配分%
    ea.guaranteed_sales = Math.round(goalForm.value.sales_target * (ea.weight_pct / 100));
    if (ea.unit_price > 0) {
      ea.target_seats = Math.ceil(ea.guaranteed_sales / ea.unit_price);
    }
    if (goalForm.value.sales_target > 0) {
      ea.weight_pct = Math.round((ea.guaranteed_sales / goalForm.value.sales_target) * 100);
    }
  } else if (field === 'guaranteed') {
    // 確約金額を直接入力 → 着座数を自動算出
    if (ea.unit_price > 0) {
      ea.target_seats = Math.ceil(ea.guaranteed_sales / ea.unit_price);
    }
    if (goalForm.value.sales_target > 0) {
      ea.weight_pct = Math.round((ea.guaranteed_sales / goalForm.value.sales_target) * 100);
    }
  } else if (field === 'price') {
    // 単価変更 → 確約金額から着座数を再算出
    if (ea.unit_price > 0) {
      ea.target_seats = Math.ceil(ea.guaranteed_sales / ea.unit_price);
    }
  } else if (field === 'seats') {
    // 着座数を直接入力 → 確約金額を再算出
    ea.guaranteed_sales = ea.target_seats * ea.unit_price;
    if (goalForm.value.sales_target > 0) {
      ea.weight_pct = Math.round((ea.guaranteed_sales / goalForm.value.sales_target) * 100);
    }
  }
};

// Global Target change handler
watch(() => goalForm.value.sales_target, (newTarget) => {
    if (newTarget > 0) {
        eventAllocations.value.forEach(ea => {
            // Recalculate weight_pct based on current guaranteed_sales vs new global target
            ea.weight_pct = Math.round((ea.guaranteed_sales / newTarget) * 100);
        });
    }
});

const loadAll = async () => {
  loading.value = true;
  try {
    // Sequence important: Overview and Events first, then Goals which depends on event data
    await Promise.all([fetchOverview(), fetchEvents()]);
    await fetchGoals();
  } catch (err) {
    console.error('Initial data load error:', err);
  } finally {
    loading.value = false;
  }
};

watch(selectedMonth, () => {
  loadAll();
});

watch(activeTab, (tab) => {
  if (tab === 'staff' && staffOverview.value.length === 0) fetchStaffBreakdown();
  if (tab === 'source' && sourceOverview.value.length === 0) fetchSourceBreakdown();
});

onMounted(loadAll);

// ─── Actions ───

const openEventEditor = (event: EventKpiItem) => {
  editingEvent.value = event;
  eventForm.value = {
    target_seats: event.target_seats,
    unit_price: event.unit_price || 5000,
    entry_deadline: event.deadline ? event.deadline.slice(0, 10) : '',
    kpi_seat_to_entry_rate: event.kpi_seat_to_entry_rate,
    kpi_entry_to_interview_rate: event.kpi_entry_to_interview_rate,
    kpi_interview_to_reservation_rate: (event as any).kpi_interview_to_reservation_rate || 50,
    kpi_reservation_to_application_rate: (event as any).kpi_reservation_to_application_rate || 40,
    kpi_custom_steps: JSON.parse(JSON.stringify(event.kpi_custom_steps || [])),
  };
  showEventEditor.value = true;
};

const addCustomStep = () => {
  eventForm.value.kpi_custom_steps.push({ label: '', rate: 50, position: 4 });
};

const removeCustomStep = (idx: number) => {
  eventForm.value.kpi_custom_steps.splice(idx, 1);
};

const saveEventSettings = async () => {
  if (!editingEvent.value) return;
  saving.value = true;
  try {
    // 1. Basic event settings (unit price, rates, custom steps)
    await kpiApi.updateEventKpi(editingEvent.value.event_id, eventForm.value);

    // 2. Period-specific target settings (manual override)
    const periodType = activeTab.value === 'weekly' ? 'weekly' : activeTab.value === 'daily' ? 'daily' : 'monthly';
    const periodStart = activeTab.value === 'weekly' ? selectedWeek.value : activeTab.value === 'daily' ? selectedDate.value : selectedMonth.value + '-01';
    
    // We only save if a target is actually set or if we want to overwrite
    // For simplicity, we always sync the target of current period if it's not the 'event' tab
    if (activeTab.value === 'monthly' || activeTab.value === 'weekly' || activeTab.value === 'daily') {
      await kpiApi.updateGoals([{
        scope_type: 'event',
        scope_id: editingEvent.value.event_id,
        period_type: periodType,
        period_start: periodStart,
        period_end: eventForm.value.entry_deadline || null,
        metric_key: 'target_seats',
        target_value: eventForm.value.target_seats
      }]);
    }

    showEventEditor.value = false;
    await fetchEvents();
    if (activeTab.value === 'monthly' || activeTab.value === 'weekly' || activeTab.value === 'daily') {
        await fetchOverview();
    }
  } catch (err) {
    console.error('Failed to save event settings', err);
    alert('設定の保存に失敗しました');
  } finally {
    saving.value = false;
  }
};

const applyTemplate = (type: 'simple' | 'extended') => {
  if (type === 'simple') {
    eventForm.value.kpi_seat_to_entry_rate = 70;
    eventForm.value.kpi_entry_to_interview_rate = 60;
    eventForm.value.kpi_interview_to_reservation_rate = 50;
    eventForm.value.kpi_reservation_to_application_rate = 40;
    eventForm.value.kpi_custom_steps = [];
  } else {
    eventForm.value.kpi_seat_to_entry_rate = 70;
    eventForm.value.kpi_entry_to_interview_rate = 60;
    eventForm.value.kpi_interview_to_reservation_rate = 50;
    eventForm.value.kpi_reservation_to_application_rate = 40;
    eventForm.value.kpi_custom_steps = [
      { label: '面談②', rate: 70, position: 1 },
      { label: '合格', rate: 80, position: 1 }
    ];
  }
};

// ─── Computed helpers ───

const monthly = computed(() => overview.value?.monthly);
const daily = computed(() => overview.value?.daily);
const funnel = computed(() => overview.value?.funnel);

const activeEvents = computed(() =>
  eventKpi.value.filter(e => e.deadline && e.days_remaining >= -1)
);

// \u5bfe\u8c61\u6708\u306e\u30a2\u30af\u30c6\u30a3\u30d6\u30a4\u30d9\u30f3\u30c8\uff1a\u7dde\u65e5\u304c\u9078\u629e\u6708\u306b\u542b\u307e\u308c\u308b\u3082\u306e\u3092\u671f\u65e5\u9806\u306b\u30bd\u30fc\u30c8
const activeEventsForMonth = computed(() => {
  const m = selectedMonth.value;
  const base = eventKpi.value
    .filter(e => {
      if (!e.deadline) return false;
      return e.deadline.startsWith(m) || e.days_remaining >= 0;
    })
    .sort((a, b) => {
      const da = a.deadline || '9999-12-31';
      const db = b.deadline || '9999-12-31';
      return da.localeCompare(db);
    });

  // eventAllocations (目標設定で保存した値) とマージして target_seats / target_entries を上書き
  return base.map(e => {
    const alloc = eventAllocations.value.find(ea => ea.event_id === e.event_id);
    const targetSeats  = alloc ? alloc.target_seats       : e.target_seats;
    const cvrRate      = alloc ? alloc.cvr_seat_to_entry  : e.kpi_seat_to_entry_rate;
    // 目標エントリー = 目標着座 / (着座→エントリー率/100)
    const targetEntries = targetSeats > 0 && cvrRate > 0
      ? Math.round(targetSeats / (cvrRate / 100))
      : e.target_entries;
    return {
      ...e,
      target_seats:              targetSeats,
      target_entries:            targetEntries,
      kpi_seat_to_entry_rate:    cvrRate,
      kpi_entry_to_interview_rate: alloc
        ? alloc.entry_to_interview_rate
        : e.kpi_entry_to_interview_rate,
    };
  });
});

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

const totalEventGuaranteedSales = computed(() =>
  eventAllocations.value.reduce((sum, ea) => sum + ea.guaranteed_sales, 0)
);

const salesTargetGap = computed(() =>
  totalEventGuaranteedSales.value - goalForm.value.sales_target
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
            @click="openGoalEditor('monthly')"
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
          {{ editorPeriodType === 'weekly' ? '週間' : editorPeriodType === 'daily' ? 'デイリー' : '月間' }}目標設定 ({{ 
              editorPeriodType === 'weekly' ? selectedWeek : 
              editorPeriodType === 'daily' ? selectedDate : 
              selectedMonth.replace('-', '年') + '月' 
          }})
        </h3>
        <div class="mb-6 max-w-xs">
          <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">売上目標 (円)</label>
          <input
            v-model.number="goalForm.sales_target"
            type="number"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Event Breakdown Table (New) -->
        <div v-if="eventAllocations.length > 0" class="mt-8 border-t border-gray-100 pt-6">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar class="w-3.5 h-3.5" />
              イベント別内訳 (月間担保設定)
            </h4>
            <div class="flex items-center gap-4">
              <div class="text-[10px] font-bold text-gray-400 uppercase">確約合計: <span class="text-gray-900 text-sm ml-1">¥{{ (totalEventGuaranteedSales || 0).toLocaleString() }}</span></div>
              <div :class="(salesTargetGap || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'" class="text-[10px] font-bold uppercase">
                乖離: <span class="text-sm ml-1">{{ (salesTargetGap || 0) >= 0 ? '+' : '' }}{{ (salesTargetGap || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th class="px-3 pb-2">イベント名</th>
                  <th class="px-3 pb-2 w-20 text-center">配分 (%)</th>
                  <th class="px-3 pb-2 text-center">単価</th>
                  <th class="px-3 pb-2 w-24">目標座席数</th>
                  <th class="px-3 pb-2 w-32">確約金額 (円)</th>
                  <th class="px-3 pb-2 w-24">目標出席率 (%)</th>
                  <th class="px-3 pb-2">必要数 (逆算)</th>
                  <th class="px-3 pb-2 text-right">期待売上 (参考)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ea in eventAllocations" :key="ea.event_id" class="bg-gray-50/50 hover:bg-gray-50 transition-colors rounded-lg overflow-hidden">
                  <td class="px-3 py-3 text-sm font-bold text-gray-700">{{ ea.event_title }}</td>
                  <td class="px-3 py-3">
                    <input 
                      v-model.number="ea.weight_pct" 
                      type="number" 
                      @input="onAllocationChange(ea, 'weight')"
                      class="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none text-center" 
                    />
                  </td>
                  <td class="px-3 py-3">
                    <div class="relative flex items-center gap-1">
                      <span class="text-xs text-gray-400">¥</span>
                      <input 
                        v-model.number="ea.unit_price" 
                        type="number" 
                        @input="onAllocationChange(ea, 'price')"
                        class="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none" 
                        :class="ea.unit_price === 0 ? 'bg-rose-50 border-rose-200' : ''"
                      />
                      <div v-if="ea.unit_price === 0" class="absolute -bottom-5 left-0 text-rose-500 text-[9px] font-bold whitespace-nowrap">
                        ※単価0のため計算不可
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <input 
                      v-model.number="ea.target_seats" 
                      type="number" 
                      @input="onAllocationChange(ea, 'seats')"
                      class="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </td>
                  <td class="px-3 py-3">
                    <input 
                      v-model.number="ea.guaranteed_sales" 
                      type="number" 
                      @input="onAllocationChange(ea, 'guaranteed')"
                      class="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </td>
                  <td class="px-3 py-3">
                    <!-- 目標出席率：イベントKPIマスタ値を初期値として表示・編集可能 -->
                    <div class="flex items-center gap-1.5">
                      <input
                        v-model.number="ea.cvr_seat_to_entry"
                        type="number"
                        min="1" max="100"
                        class="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-center"
                      />
                      <span class="text-[10px] text-gray-400 font-medium whitespace-nowrap">(マスタ:{{ ea.master_rate }}%)</span>
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-col gap-0.5">
                      <div class="text-[9px] text-gray-400 font-bold uppercase">必要数:</div>
                      <div class="text-[10px] font-bold text-gray-600 space-y-0.5">
                        <div>エ: <span class="text-blue-600">{{ ea.target_seats > 0 && ea.cvr_seat_to_entry > 0 ? Math.ceil(ea.target_seats / (ea.cvr_seat_to_entry / 100)) : '-' }}</span></div>
                        <div>面: <span class="text-indigo-600">{{ ea.target_seats > 0 && ea.cvr_seat_to_entry > 0 ? Math.ceil(ea.target_seats / (ea.cvr_seat_to_entry / 100) / ((ea.entry_to_interview_rate || 60) / 100)) : '-' }}</span></div>
                        <div>流: <span class="text-violet-600">{{ ea.target_seats > 0 && ea.cvr_seat_to_entry > 0 ? Math.ceil(ea.target_seats / (ea.cvr_seat_to_entry / 100) / ((ea.entry_to_interview_rate || 60) / 100) / ((ea.interview_to_res_rate || 50) / 100)) : '-' }}</span></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-sm font-bold text-emerald-600 text-right">
                    <!-- 期待売上：着座数 × 単価 -->
                    ¥{{ ((ea.target_seats || 0) * (ea.unit_price || 0)).toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
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
              { id: 'weekly', label: '日程別KPI' },
              { id: 'daily', label: 'デイリー' },
              { id: 'event', label: '全イベント' },
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

        <!-- Period selector -->
        <div class="flex items-center gap-4 mb-6 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-blue-600 uppercase">対象月</span>
            <select v-model="selectedMonth" class="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20">
              <option v-for="m in monthOptions" :key="m" :value="m">{{ m.replace('-', '年') }}月</option>
            </select>
          </div>
          
          <div class="ml-auto">
            <button
              @click="openGoalEditor('monthly')"
              class="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              <Settings2 class="w-4 h-4" />
              月間・イベント目標設定
            </button>
          </div>
        </div>

        <!-- ═══════ Monthly KPI Tab ═══════ -->
        <div v-if="activeTab === 'monthly' && overview">
          <!-- Summary cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" v-if="monthly">
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

            <!-- Event Sales Progress -->
            <div v-for="ev in activeEventsForMonth" :key="'sales-'+ev.event_id"
              class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm"
            >
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase truncate max-w-[150px]">{{ ev.event_title }}</span>
                <span class="text-xs font-bold" :class="rateColor(ev.target_seats > 0 ? (ev.current_seats / ev.target_seats) * 100 : 0)">
                  {{ ev.target_seats > 0 ? Math.round((ev.current_seats / ev.target_seats) * 100) : 0 }}%
                </span>
              </div>
              <p class="text-xs font-bold text-gray-400 mb-1">イベント目標振込</p>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-2xl font-black text-gray-900">¥{{ formatCurrency((ev.current_seats || 0) * (ev.unit_price || 0)) }}</span>
                <span class="text-xs text-gray-400">/ ¥{{ formatCurrency((ev.target_seats || 0) * (ev.unit_price || 0)) }}</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  v-if="ev.target_seats > 0"
                  class="h-full rounded-full transition-all duration-700"
                  :class="Math.round((ev.current_seats / ev.target_seats) * 100) >= 80 ? 'bg-emerald-500' : Math.round((ev.current_seats / ev.target_seats) * 100) >= 50 ? 'bg-amber-500' : 'bg-rose-500'"
                  :style="{ width: `${Math.min(Math.round((ev.current_seats / ev.target_seats) * 100), 100)}%` }"
                ></div>
                <div v-else class="h-full bg-gray-200 w-0"></div>
              </div>
              <p class="text-xs font-bold" :class="gapColor((ev.current_seats || 0) * (ev.unit_price || 0) - (ev.target_seats || 0) * (ev.unit_price || 0))">
                差分: {{ ((ev.current_seats || 0) * (ev.unit_price || 0) - (ev.target_seats || 0) * (ev.unit_price || 0)) >= 0 ? '+' : '' }}¥{{ formatCurrency((ev.current_seats || 0) * (ev.unit_price || 0) - (ev.target_seats || 0) * (ev.unit_price || 0)) }}
              </p>
            </div>
          </div>

          <!-- CVR summary -->
          <div class="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-4">CVR（コンバージョン率）</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div v-for="cvr in [
                { label: '着座→エントリー', value: monthly?.rates.seatToEntry },
                { label: 'エントリー→面談', value: monthly?.rates.entryToInterview },
                { label: '面談→設定', value: monthly?.rates.interviewToSetting },
                { label: '流入→設定', value: monthly?.rates.inflowToSetting },
              ]" :key="cvr.label" class="text-center p-3 bg-gray-50 rounded-xl">
                <p class="text-[10px] font-bold text-gray-500 mb-1 uppercase">{{ cvr.label }}</p>
                <p class="text-2xl font-black text-gray-900">{{ cvr.value }}<span class="text-sm text-gray-400">%</span></p>
              </div>
            </div>
          </div>

          <!-- Funnel -->
          <div v-if="funnel" class="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
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

          <!-- ══ デイリーKGI進捗テーブル ══ -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <div class="w-1 h-5 bg-blue-600 rounded-full"></div>
              <h3 class="text-sm font-bold text-gray-800">デイリーKGI進捗</h3>
              <span class="text-[10px] text-gray-400 ml-1">— 残り期間から逆算した必要アクション数</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">イベント名</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">締日</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">残日数</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-blue-600">目標着座</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-blue-400">現着座</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-indigo-600">目標エントリー</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-indigo-400">現エントリー</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-rose-600">残り必要<br>エントリー数</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-orange-600">デイリー<br>必要面談数</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="e in activeEventsForMonth" :key="e.event_id"
                    class="hover:bg-blue-50/30 transition-colors"
                    :class="{ 'opacity-60': e.days_remaining < 0 }"
                  >
                    <td class="px-4 py-3.5 font-bold text-gray-900 max-w-[160px] truncate" :title="e.event_title">
                      {{ e.event_title }}
                    </td>
                    <td class="px-4 py-3.5 text-center text-gray-600 font-medium">
                      {{ e.deadline ? e.deadline.slice(5).replace('-', '/') : '-' }}
                    </td>
                    <td class="px-4 py-3.5 text-center font-black"
                      :class="e.days_remaining <= 3 ? 'text-rose-600' : e.days_remaining <= 7 ? 'text-amber-600' : 'text-gray-700'"
                    >
                      {{ e.days_remaining >= 0 ? e.days_remaining : 0 }}
                    </td>
                    <!-- 目標着座 -->
                    <td class="px-4 py-3.5 text-center font-black text-blue-600 italic">
                      {{ e.target_seats > 0 ? e.target_seats : '-' }}
                    </td>
                    <!-- 現着座 -->
                    <td class="px-4 py-3.5 text-center font-bold text-blue-400 italic">
                      {{ e.current_seats }}
                    </td>
                    <!-- 目標エントリー -->
                    <td class="px-4 py-3.5 text-center font-black text-indigo-600 italic">
                      {{ e.target_entries > 0 ? e.target_entries : '-' }}
                    </td>
                    <!-- 現エントリー -->
                    <td class="px-4 py-3.5 text-center font-bold text-indigo-400 italic">
                      {{ e.current_entries }}
                    </td>
                    <!-- 残り必要エントリー数 -->
                    <td class="px-4 py-3.5 text-center">
                      <span v-if="e.target_entries > 0 && e.current_entries >= e.target_entries"
                        class="text-emerald-600 font-black text-xs">達成</span>
                      <span v-else-if="e.target_entries > 0"
                        class="font-black text-rose-600">{{ e.target_entries - e.current_entries }}</span>
                      <span v-else class="text-gray-400">-</span>
                    </td>
                    <!-- デイリー必要面談数: 残りエントリー ÷ 残日数 ÷ (面談→エントリー率) -->
                    <td class="px-4 py-3.5 text-center">
                      <span v-if="e.target_entries > 0 && e.current_entries >= e.target_entries"
                        class="font-black text-emerald-600">0</span>
                      <span v-else-if="e.target_entries > 0 && e.days_remaining > 0"
                        class="font-black text-orange-500">
                        {{ (((e.target_entries - e.current_entries) / e.days_remaining) / ((e.kpi_entry_to_interview_rate || 60) / 100)).toFixed(1) }}
                      </span>
                      <span v-else class="text-gray-400">-</span>
                    </td>
                  </tr>
                  <tr v-if="activeEventsForMonth.length === 0">
                    <td colspan="9" class="px-4 py-12 text-center text-gray-400">
                      対象月のイベントがありません。まず「目標設定」でイベントに確約金額を設定してください。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══════ 日程別KPIタブ ═══════ -->
        <div v-if="activeTab === 'weekly'" class="space-y-6">
          <!-- 各イベントを日程ごとに展開 -->
          <div
            v-for="ev in activeEventsForMonth"
            :key="ev.event_id"
            class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <!-- イベントヘッダー -->
            <div class="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-1 h-5 bg-indigo-600 rounded-full flex-shrink-0"></div>
                <div>
                  <h3 class="text-sm font-bold text-gray-900">{{ ev.event_title }}</h3>
                  <p class="text-[10px] text-gray-400 mt-0.5">
                    締日: {{ ev.deadline ? ev.deadline.slice(5).replace('-', '/') : '未設定' }}
                    ·
                    残<span :class="ev.days_remaining <= 3 ? 'text-rose-600 font-black' : ev.days_remaining <= 7 ? 'text-amber-600 font-bold' : 'text-gray-600'">{{ Math.max(ev.days_remaining, 0) }}</span>日
                  </p>
                </div>
              </div>

              <!-- 全体サマリー + 目標編集ボタン -->
              <div class="flex items-center gap-3 flex-wrap justify-end">
                <!-- インライン目標編集フォーム -->
                <div v-if="editingEventTargetId === ev.event_id" class="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1.5">
                      <label class="text-[10px] font-bold text-blue-600 whitespace-nowrap">目標着座</label>
                      <input
                        v-model.number="inlineTargetForm.target_seats"
                        type="number" min="0"
                        class="w-16 px-2 py-1 border border-blue-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div class="flex items-center gap-1.5">
                      <label class="text-[10px] font-bold text-indigo-600 whitespace-nowrap">目標E数</label>
                      <input
                        v-model.number="inlineTargetForm.target_entries"
                        type="number" min="0"
                        class="w-16 px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="自動"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <button
                      @click="saveInlineTarget(ev)"
                      :disabled="saving"
                      class="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                      <Save class="w-3 h-3" />
                      {{ saving ? '保存中' : '保存' }}
                    </button>
                    <button
                      @click="closeInlineTargetEdit()"
                      class="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-[10px] font-bold border border-gray-200 rounded-lg bg-white"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>

                <!-- 通常表示モード -->
                <div v-else class="hidden md:flex items-center gap-4">
                  <div class="flex items-center gap-5 text-center">
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">目標着座</p>
                      <p class="text-base font-black text-blue-600">{{ ev.target_seats > 0 ? ev.target_seats : '-' }}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">現着座</p>
                      <p class="text-base font-black text-blue-400">{{ ev.current_seats }}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">目標エントリー</p>
                      <p class="text-base font-black text-indigo-600">{{ ev.target_entries > 0 ? ev.target_entries : '-' }}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">現エントリー</p>
                      <p class="text-base font-black text-indigo-400">{{ ev.current_entries }}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">残必要エントリー</p>
                      <p class="text-base font-black" :class="ev.target_entries > 0 && ev.current_entries >= ev.target_entries ? 'text-emerald-600' : 'text-rose-600'">
                        <span v-if="ev.target_entries > 0 && ev.current_entries >= ev.target_entries">達成</span>
                        <span v-else-if="ev.target_entries > 0">{{ ev.target_entries - ev.current_entries }}</span>
                        <span v-else class="text-gray-400">-</span>
                      </p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">デイリー必要面談</p>
                      <p class="text-base font-black text-orange-500">
                        <span v-if="ev.target_entries > 0 && ev.current_entries >= ev.target_entries" class="text-emerald-600">0</span>
                        <span v-else-if="ev.target_entries > 0 && ev.days_remaining > 0">
                          {{ (((ev.target_entries - ev.current_entries) / ev.days_remaining) / ((ev.kpi_entry_to_interview_rate || 60) / 100)).toFixed(1) }}
                        </span>
                        <span v-else class="text-gray-400">-</span>
                      </p>
                    </div>
                    <div>
                      <p class="text-[9px] font-bold text-gray-400 uppercase">達成率</p>
                      <span class="px-2 py-1 rounded-lg text-xs font-black" :class="rateBgColor(ev.achievementRate)">
                        <span :class="rateColor(ev.achievementRate)">{{ ev.achievementRate }}%</span>
                      </span>
                    </div>
                  </div>
                  <!-- 目標値編集ボタン -->
                  <button
                    @click="openInlineTargetEdit(ev)"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-50 transition-all shadow-sm flex-shrink-0"
                    title="この日程別イベントの目標数値を手動設定"
                  >
                    <Edit3 class="w-3 h-3" />
                    目標設定
                  </button>
                </div>
              </div>
            </div>

            <!-- 日程別スロット -->
            <div v-if="ev.slots && ev.slots.length > 0" class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">開催日</th>
                    <th class="px-4 py-2 text-center text-[10px] font-bold text-indigo-500 uppercase">エントリー数</th>
                    <th class="px-4 py-2 text-center text-[10px] font-bold text-blue-500 uppercase">着座数</th>
                    <th class="px-4 py-2 text-center text-[10px] font-bold text-gray-400 uppercase">残必要エントリー(*)逆算</th>
                    <th class="px-4 py-2 text-center text-[10px] font-bold text-orange-500 uppercase">1日あたり必要面談(逆算)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="slot in ev.slots"
                    :key="slot.date"
                    class="hover:bg-indigo-50/20 transition-colors"
                  >
                    <td class="px-4 py-3 font-bold text-gray-700">
                      {{ slot.date ? slot.date.replace(/-/g, '/') : '-' }}
                      <!-- 当日識別 -->
                      <span v-if="slot.date === new Date().toISOString().slice(0, 10)" class="ml-2 text-[9px] font-black text-white bg-blue-500 px-1.5 py-0.5 rounded-full">TODAY</span>
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-indigo-500">
                      {{ slot.entries || 0 }}
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-blue-500">
                      {{ slot.seats || 0 }}
                    </td>
                    <!-- 残りエントリー逆算: スロット目標=全体目標/スロット数 として逆算 -->
                    <td class="px-4 py-3 text-center">
                      <template v-if="ev.target_entries > 0 && ev.slots.length > 0">
                        <span class="font-bold" :class="Math.ceil(ev.target_entries / ev.slots.length) - (slot.entries || 0) <= 0 ? 'text-emerald-600' : 'text-rose-600'">
                          <span v-if="Math.ceil(ev.target_entries / ev.slots.length) - (slot.entries || 0) <= 0">達成</span>
                          <span v-else>{{ Math.ceil(ev.target_entries / ev.slots.length) - (slot.entries || 0) }}</span>
                        </span>
                      </template>
                      <span v-else class="text-gray-400">-</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <template v-if="ev.target_entries > 0 && ev.days_remaining > 0">
                        <span class="font-black text-orange-500">
                          {{ (((Math.ceil(ev.target_entries / (ev.slots.length || 1)) - (slot.entries || 0)) / Math.max(ev.days_remaining, 1)) / ((ev.kpi_entry_to_interview_rate || 60) / 100)).toFixed(1) }}
                        </span>
                      </template>
                      <span v-else class="text-gray-400">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- スロットなしの場合 -->
            <div v-else class="px-5 py-6 text-center text-gray-400 text-xs">
              開催日程データがありません。イベント設定でスロットを追加してください。
            </div>
          </div>

          <!-- イベントなし -->
          <div v-if="activeEventsForMonth.length === 0" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
            対象月のイベントがありません
          </div>
        </div>

        <!-- ═══════ Daily KPI Tab ═══════ -->
        <div v-if="activeTab === 'daily' && overview?.daily">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div v-for="item in [
              { label: '本日必要売上', metric: overview.daily.sales, unit: '円' },
              { label: '本日必要着座', metric: overview.daily.seats, unit: '名' },
              { label: '本日必要エントリー', metric: overview.daily.entries, unit: '件' },
              { label: '本日必要面談', metric: overview.daily.interviews, unit: '件' },
            ]" :key="item.label" class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm text-center">
              <p class="text-[10px] font-bold text-gray-400 uppercase mb-2">{{ item.label }}</p>
              <p class="text-3xl font-black text-blue-800">{{ formatCurrency(item.metric.target) }}<span class="text-sm ml-1">{{ item.unit }}</span></p>
            </div>
          </div>

          <!-- Daily trend -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div class="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 class="text-sm font-bold text-gray-800">エントリー推移 (直近)</h3>
              <TrendingUp class="w-4 h-4 text-gray-400" />
            </div>
            <div class="p-6">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-[10px] font-bold text-gray-400 uppercase">
                    <th class="px-4 py-2 border-b">日付</th>
                    <th class="px-4 py-2 border-b text-right">件数</th>
                    <th class="px-4 py-2 border-b"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="d in overview.daily.trend.slice(0, 14)" :key="d.day" class="hover:bg-gray-50">
                    <td class="px-4 py-2 text-gray-700 font-medium whitespace-nowrap">{{ d.day.slice(5) }}</td>
                    <td class="px-4 py-2 text-right font-bold text-gray-900">{{ d.count }}</td>
                    <td class="px-4 py-2">
                      <div class="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-blue-500 rounded-full transition-all"
                          :style="{ width: `${Math.min((d.count / Math.max(...overview.daily.trend.map(t => t.count), 1)) * 100, 100)}%` }"
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
                    <th class="px-3 py-3 text-left text-xs font-bold text-gray-500 w-10"></th>
                    <th class="px-3 py-3 text-left text-xs font-bold text-gray-500">アクション</th>
                    <th class="px-3 py-3 text-left text-xs font-bold text-gray-500">イベント名</th>
                    <th class="px-3 py-3 text-right text-xs font-bold text-gray-500">締日</th>
                    <th class="px-3 py-3 text-center text-xs font-bold text-gray-400 bg-gray-100/30">申込 (週/日)</th>
                    <th class="px-3 py-3 text-center text-xs font-bold text-gray-400 bg-gray-100/30">予約 (週/日)</th>
                    <th class="px-3 py-3 text-center text-xs font-bold text-gray-400 bg-gray-100/30">面談 (週/日)</th>
                    <th class="px-3 py-3 text-center text-xs font-bold text-gray-400 bg-gray-100/30">Entry (週/日)</th>
                    <th class="px-3 py-3 text-right text-xs font-bold text-gray-500">目標着座</th>
                    <th class="px-3 py-3 text-right text-xs font-bold text-gray-500 border-l border-gray-100">達成率</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <template v-for="e in displayEvents" :key="e.event_id">
                    <tr class="hover:bg-gray-50/80 transition-colors" :class="{ 'opacity-60 bg-gray-50/50': e.days_remaining < -1 }">
                      <td class="px-3 py-3 text-center">
                        <button 
                          @click="toggleEvent(e.event_id)"
                          class="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <ChevronRight 
                            class="w-4 h-4 text-gray-400 transition-transform duration-200"
                            :class="{ 'rotate-90': expandedEvents[e.event_id] }"
                          />
                        </button>
                      </td>
                      <td class="px-3 py-3">
                        <button 
                          @click="openEventEditor(e)"
                          class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                          title="KPI設定を編集"
                        >
                          <Edit3 class="w-4 h-4" />
                        </button>
                      </td>
                      <td class="px-3 py-3 font-bold text-gray-900 max-w-[180px] truncate" :title="e.event_title">
                        <div class="flex items-center gap-2">
                          <span v-if="e.days_remaining < -1" class="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase">Finished</span>
                          {{ e.event_title }}
                        </div>
                      </td>
                      <td class="px-3 py-3 text-right">
                        <div class="flex flex-col items-end">
                          <span class="text-xs font-bold text-gray-900">{{ e.deadline ? e.deadline.slice(5) : '-' }}</span>
                          <span class="text-[10px]" :class="e.days_remaining <= 3 ? 'text-rose-600 font-black' : 'text-gray-400'">
                            あと{{ e.days_remaining }}日
                          </span>
                        </div>
                      </td>
                      
                      <!-- Weekly/Daily Required Actions -->
                      <td v-for="metricKey in ['applications', 'reservations', 'interviews', 'entries']" :key="metricKey" 
                        class="px-2 py-3 bg-gray-50/30 border-l border-gray-100/50"
                      >
                        <div class="flex flex-col items-center gap-0.5">
                          <div class="flex items-baseline gap-1">
                            <span class="text-sm font-black text-blue-700">
                              {{ (e as any)[`weekly_required_${metricKey}`] }}
                            </span>
                            <span class="text-[8px] font-bold text-blue-400 uppercase">W</span>
                          </div>
                          <div class="flex items-baseline gap-1 bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm">
                            <span class="text-[11px] font-bold text-indigo-600">
                              {{ (e as any)[`daily_required_${metricKey}`] }}
                            </span>
                            <span class="text-[8px] font-bold text-indigo-300 uppercase">D</span>
                          </div>
                        </div>
                      </td>

                      <td class="px-3 py-3 text-right">
                        <div class="flex flex-col items-end">
                          <span class="text-sm font-black text-gray-900">{{ e.current_seats }} / {{ e.target_seats }}</span>
                          <span class="text-[10px] text-gray-400">着座実績</span>
                        </div>
                      </td>

                      <td class="px-3 py-3 text-right border-l border-gray-100">
                        <div 
                          class="inline-flex flex-col items-end px-2 py-1 rounded-lg"
                          :class="rateBgColor(e.achievementRate)"
                        >
                          <span class="text-sm font-black" :class="rateColor(e.achievementRate)">{{ e.achievementRate }}%</span>
                        </div>
                      </td>
                    </tr>

                    <!-- Slot Breakdown Row (案B: 日程別の実績と目標表示) -->
                    <tr v-if="expandedEvents[e.event_id]">
                      <td colspan="10" class="px-6 py-4 bg-gray-50/80 border-y border-gray-100">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3">
                          <div v-for="slot in e.schedule_breakdown || (e.slots as any[])" :key="slot.date" 
                            class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 group hover:border-blue-400 transition-all"
                          >
                            <div class="flex items-center justify-between border-b border-gray-100 pb-2">
                              <div class="flex items-center gap-3">
                                <div class="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  <Calendar class="w-4 h-4" />
                                </div>
                                <div class="flex flex-col">
                                  <span class="text-xs font-black text-gray-900">{{ slot.date.replace('T', ' ').slice(5, 16) }}</span>
                                  <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-bold text-gray-400">開催日程</span>
                                    <span v-if="slot.capacity" class="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">枠: {{ slot.capacity }}名</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div class="grid grid-cols-4 gap-2">
                              <!-- エントリー -->
                              <div class="bg-gray-50 rounded p-2 text-center">
                                <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">エントリー</p>
                                <div class="flex items-baseline justify-center gap-1">
                                  <span class="text-xs font-black" :class="(slot.actuals?.entries || slot.entries || 0) >= (slot.targets?.entries || 0) ? 'text-indigo-600' : 'text-gray-900'">
                                    {{ slot.actuals?.entries || slot.entries || 0 }}
                                  </span>
                                  <span v-if="slot.targets" class="text-[10px] text-gray-400 font-bold">/ {{ slot.targets.entries }}</span>
                                </div>
                              </div>
                              
                              <!-- 面談 (目標のみ出せる場合は目標のみ) -->
                              <div class="bg-gray-50 rounded p-2 text-center">
                                <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">面談</p>
                                <div class="flex items-baseline justify-center gap-1">
                                  <span class="text-xs font-black text-gray-900">-</span>
                                  <span v-if="slot.targets" class="text-[10px] text-gray-400 font-bold">/ {{ slot.targets.interviews }}</span>
                                </div>
                              </div>
                              
                              <!-- 流入 -->
                              <div class="bg-gray-50 rounded p-2 text-center">
                                <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">流入</p>
                                <div class="flex items-baseline justify-center gap-1">
                                  <span class="text-xs font-black text-gray-900">-</span>
                                  <span v-if="slot.targets" class="text-[10px] text-gray-400 font-bold">/ {{ slot.targets.inflow }}</span>
                                </div>
                              </div>
                              
                              <!-- 着座 -->
                              <div class="bg-blue-50 rounded p-2 text-center border border-blue-100">
                                <p class="text-[9px] font-bold text-blue-600 uppercase mb-0.5">着座 (目標)</p>
                                <div class="flex items-baseline justify-center gap-1">
                                  <span class="text-xs font-black text-blue-700">
                                    {{ slot.actuals?.seats || slot.seats || 0 }}
                                  </span>
                                  <span v-if="slot.targets" class="text-[10px] text-blue-400 font-bold">/ {{ slot.targets.seats }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div v-if="(!e.schedule_breakdown || e.schedule_breakdown.length === 0) && (!e.slots || e.slots.length === 0)" class="col-span-full text-center py-4 text-xs text-gray-400 italic">
                            このイベントに紐づく個別の日程実績はありません。
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                  <tr v-if="activeEvents.length === 0">
                    <td colspan="10" class="px-4 py-12 text-center text-gray-400">データがありません</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Event Settings Drawer -->
        <div v-if="showEventEditor" class="fixed inset-0 z-50 flex justify-end">
          <div class="fixed inset-0 bg-black/30 backdrop-blur-sm" @click="showEventEditor = false"></div>
          <div class="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div class="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 class="text-xl font-black text-gray-900">KPI設定: {{ editingEvent?.event_title }}</h2>
                <p class="text-xs text-gray-500 mt-1">イベント別の目標値とカスタムフローを設定します。</p>
              </div>
              <button @click="showEventEditor = false" class="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X class="w-6 h-6" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Basic Targets -->
              <section class="space-y-4">
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">目標値設定</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1">目標着座数</label>
                    <input v-model.number="eventForm.target_seats" type="number" class="w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1">単価 (円)</label>
                    <input v-model.number="eventForm.unit_price" type="number" class="w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 mb-1">エントリー締切日</label>
                    <input v-model="eventForm.entry_deadline" type="date" class="w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                  </div>
                </div>
              </section>

              <!-- Conversion Rates -->
              <section class="space-y-4">
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">変換率（歩留まり）設定</h3>
                <div class="space-y-3">
                  <div v-for="[key, label] in [
                    ['kpi_seat_to_entry_rate', '着座 → エントリー率 (%)'],
                    ['kpi_entry_to_interview_rate', 'エントリー → 面談率 (%)'],
                    ['kpi_interview_to_reservation_rate', '面談 → 予約率 (%)'],
                    ['kpi_reservation_to_application_rate', '予約 → 申込率 (%)'],
                  ] as const" :key="key">
                    <label class="block text-xs font-bold text-gray-600 mb-1">{{ label }}</label>
                    <div class="flex items-center gap-3">
                      <input v-model.number="(eventForm as any)[key]" type="range" min="0" max="100" class="flex-1">
                      <input v-model.number="(eventForm as any)[key]" type="number" class="w-20 px-2 py-1 border rounded text-right font-bold">
                    </div>
                  </div>
                </div>
              </section>

              <!-- Custom Steps -->
              <section class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">カスタムフロー設定</h3>
                  <button @click="addCustomStep" class="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                    <Plus class="w-3 h-3" /> ステップ追加
                  </button>
                </div>
                <div v-if="eventForm.kpi_custom_steps.length === 0" class="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-dashed text-center">
                  追加のステップはありません
                </div>
                <div v-for="(step, idx) in eventForm.kpi_custom_steps" :key="idx" class="p-3 border rounded-xl space-y-2 bg-gray-50">
                  <div class="flex items-center justify-between gap-2">
                    <input v-model="step.label" placeholder="ステップ名" class="flex-1 px-2 py-1 text-sm border-none bg-transparent font-bold focus:ring-0 outline-none">
                    <button @click="removeCustomStep(idx)" class="text-red-400 hover:text-red-600">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-gray-400 uppercase">変換率:</span>
                    <input v-model.number="step.rate" type="number" class="w-16 px-1 text-xs border rounded text-right font-bold">
                    <span class="text-[10px] font-bold text-gray-400">%</span>
                  </div>
                </div>
              </section>

              <!-- Templates -->
              <section class="space-y-3">
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">テンプレート適用</h3>
                <div class="grid grid-cols-2 gap-2">
                  <button @click="applyTemplate('simple')" class="p-3 text-xs border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-left">
                    <p class="font-bold text-gray-900">シンプル版</p>
                    <p class="text-[10px] text-gray-400">標準フロー</p>
                  </button>
                  <button @click="applyTemplate('extended')" class="p-3 text-xs border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-left">
                    <p class="font-bold text-gray-900">Beyond版</p>
                    <p class="text-[10px] text-gray-400">合格フロー含む</p>
                  </button>
                </div>
              </section>
            </div>

            <div class="p-6 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button @click="showEventEditor = false" class="flex-1 px-4 py-2 border rounded-xl font-bold text-gray-600 hover:bg-white shadow-sm transition-all">
                キャンセル
              </button>
              <button 
                @click="saveEventSettings" 
                :disabled="saving"
                class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all"
              >
                <Save class="w-4 h-4" />
                {{ saving ? '保存中...' : '設定を更新' }}
              </button>
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
        <div v-if="activeTab === 'monthly' && !overview" class="text-center py-20">
          <p class="text-gray-400 mb-2">月間KPIデータがありません</p>
          <p class="text-sm text-gray-400">「目標設定」から月間目標を登録してください。</p>
        </div>
      </div>
    </div>
  </Layout>
</template>
