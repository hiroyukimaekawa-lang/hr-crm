<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import {
  TrendingUp,
  Users,
  Calendar,
  Target,
  ArrowUpRight,
  Loader2,
  DollarSign
} from 'lucide-vue-next';

interface EventSlot {
  datetime: string;
}

interface EventItem {
  id: number;
  title: string;
  event_date?: string;
  event_slots?: EventSlot[];
  unit_price: number;
  attended_count: number;
}

interface Participant {
  status: string;
  staff_name?: string;
}

const events = ref<EventItem[]>([]);
const loading = ref(true);
const loadingParticipants = ref(false);
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const monthlyTarget = ref<number>(0);
const participantsMap = ref<Record<number, Participant[]>>({});

// 月選択肢（当月含め過去13ヶ月）
const monthOptions = computed(() => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(d.toISOString().slice(0, 7));
  }
  return options;
});

const loadTarget = () => {
  const saved = localStorage.getItem(`monthlySalesTarget_${selectedMonth.value}`);
  monthlyTarget.value = saved ? Number(saved) : 0;
};

const saveTarget = () => {
  localStorage.setItem(`monthlySalesTarget_${selectedMonth.value}`, monthlyTarget.value.toString());
};

const fetchEvents = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/events', { headers: { Authorization: token } });
    events.value = res.data;
    await fetchRelevantParticipants();
  } catch (err) {
    console.error('Failed to fetch events:', err);
  } finally {
    loading.value = false;
  }
};

const fetchRelevantParticipants = async () => {
  loadingParticipants.value = true;
  try {
    const token = localStorage.getItem('token');
    const targetEvents = filteredEvents.value;
    
    // まだ取得していないイベントの参加者のみ取得
    const fetchPromises = targetEvents
      .filter(e => !participantsMap.value[e.id])
      .map(async (e) => {
        const res = await api.get(`/api/events/${e.id}`, { headers: { Authorization: token } });
        participantsMap.value[e.id] = res.data.participants || [];
      });
    
    await Promise.all(fetchPromises);
  } catch (err) {
    console.error('Failed to fetch participants:', err);
  } finally {
    loadingParticipants.value = false;
  }
};

const getEventMonth = (e: EventItem) => {
  if (Array.isArray(e.event_slots) && e.event_slots.length > 0) {
    const dates = e.event_slots
      .map((s) => new Date(s.datetime))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    return dates[0] ? dates[0].toISOString().slice(0, 7) : null;
  }
  return e.event_date ? e.event_date.slice(0, 7) : null;
};

const filteredEvents = computed(() => {
  return events.value
    .filter(e => getEventMonth(e) === selectedMonth.value)
    .sort((a, b) => (b.attended_count * b.unit_price) - (a.attended_count * a.unit_price));
});

const totalSales = computed(() => {
  return filteredEvents.value.reduce((sum, e) => sum + (e.attended_count * e.unit_price), 0);
});

const totalAttendance = computed(() => {
  return filteredEvents.value.reduce((sum, e) => sum + e.attended_count, 0);
});

const achievementRate = computed(() => {
  if (!monthlyTarget.value || monthlyTarget.value <= 0) return 0;
  return Math.round((totalSales.value / monthlyTarget.value) * 100);
});

const staffSales = computed(() => {
  const stats: Record<string, { staff_name: string; attendance: number; sales: number }> = {};
  
  filteredEvents.value.forEach(event => {
    const participants = participantsMap.value[event.id] || [];
    participants.forEach(p => {
      if (p.status === 'attended') {
        const name = p.staff_name || '未割当';
        if (!stats[name]) stats[name] = { staff_name: name, attendance: 0, sales: 0 };
        stats[name].attendance++;
        stats[name].sales += event.unit_price;
      }
    });
  });
  
  return Object.values(stats).sort((a, b) => b.sales - a.sales);
});

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    month: '2-digit',
    day: '2-digit'
  });
};

watch(selectedMonth, () => {
  loadTarget();
  fetchRelevantParticipants();
});

onMounted(() => {
  fetchEvents();
  loadTarget();
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <!-- ヘッダー -->
      <div class="flex flex-col gap-6 md:flex-row md:items-center justify-between mb-8">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <div class="p-2 bg-blue-50 rounded-xl">
              <TrendingUp class="w-6 h-6 text-blue-600" />
            </div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">月間売上管理</h1>
          </div>
          <p class="text-sm text-gray-500 mt-1">イベントごとの収益と担当者別の貢献度を確認できます。</p>
        </div>

        <div class="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          <div class="w-full sm:w-auto">
            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">対象月</label>
            <select
              v-model="selectedMonth"
              class="w-full sm:w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
            >
              <option v-for="m in monthOptions" :key="m" :value="m">{{ m.replace('-', '年') }}月</option>
            </select>
          </div>
          <div class="w-full sm:w-auto">
            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">月間目標売上 (円)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">¥</span>
              <input
                v-model.number="monthlyTarget"
                @input="saveTarget"
                type="number"
                placeholder="目標を入力..."
                class="w-full sm:w-56 pl-7 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 class="w-10 h-10 text-blue-600 animate-spin" />
        <p class="text-gray-500 font-medium">売上データを集計中...</p>
      </div>

      <div v-else>
        <!-- サマリーカード -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <!-- 売上合計 -->
          <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-blue-50 rounded-lg">
                <DollarSign class="w-5 h-5 text-blue-600" />
              </div>
              <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Total Sales</span>
            </div>
            <p class="text-xs font-bold text-gray-400 mb-1">月間売上合計</p>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-gray-900">{{ totalSales.toLocaleString() }}</span>
              <span class="text-xs font-bold text-gray-500">円</span>
            </div>
          </div>

          <!-- 目標 -->
          <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-slate-50 rounded-lg">
                <Target class="w-5 h-5 text-slate-600" />
              </div>
              <span class="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full uppercase">Monthly Target</span>
            </div>
            <p class="text-xs font-bold text-gray-400 mb-1">月間目標売上</p>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-gray-900">{{ monthlyTarget.toLocaleString() }}</span>
              <span class="text-xs font-bold text-gray-500">円</span>
            </div>
          </div>

          <!-- 達成率 -->
          <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 rounded-lg" :class="achievementRate >= 100 ? 'bg-emerald-50' : 'bg-amber-50'">
                <ArrowUpRight class="w-5 h-5" :class="achievementRate >= 100 ? 'text-emerald-600' : 'text-amber-600'" />
              </div>
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                :class="achievementRate >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
              >
                Achievement
              </span>
            </div>
            <p class="text-xs font-bold text-gray-400 mb-1">目標達成率</p>
            <div class="flex items-baseline gap-1 mb-3">
              <span
                class="text-2xl font-black"
                :class="achievementRate >= 100 ? 'text-emerald-600' : (achievementRate >= 50 ? 'text-amber-600' : 'text-rose-600')"
              >
                {{ achievementRate }}
              </span>
              <span class="text-xs font-bold text-gray-500">%</span>
            </div>
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-1000"
                :class="achievementRate >= 100 ? 'bg-emerald-500' : (achievementRate >= 50 ? 'bg-amber-500' : 'bg-rose-500')"
                :style="{ width: `${Math.min(achievementRate, 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- 着座数 -->
          <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-indigo-50 rounded-lg">
                <Users class="w-5 h-5 text-indigo-600" />
              </div>
              <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Attendance</span>
            </div>
            <p class="text-xs font-bold text-gray-400 mb-1">総着座数</p>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-gray-900">{{ totalAttendance.toLocaleString() }}</span>
              <span class="text-xs font-bold text-gray-500">名</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- イベント別売上テーブル -->
          <div class="lg:col-span-2">
            <div class="flex items-center justify-between mb-4 px-2">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar class="w-5 h-5 text-gray-400" />
                イベント別売上実績
              </h2>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead>
                    <tr class="bg-slate-50 border-b border-gray-200">
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">イベント名</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">開催日</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">着座数</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">単価</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">売上</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="event in filteredEvents" :key="event.id" class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-bold text-gray-900">{{ event.title }}</td>
                      <td class="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">{{ formatDate(event.event_date) }}</td>
                      <td class="px-6 py-4 text-right">
                        <span class="font-bold text-gray-700">{{ event.attended_count }}</span>
                      </td>
                      <td class="px-6 py-4 text-right text-gray-400 text-xs">
                        ¥{{ event.unit_price.toLocaleString() }}
                      </td>
                      <td class="px-6 py-4 text-right">
                        <span class="font-black text-blue-600">¥{{ (event.attended_count * event.unit_price).toLocaleString() }}</span>
                      </td>
                    </tr>
                    <tr v-if="filteredEvents.length === 0">
                      <td colspan="5" class="px-6 py-12 text-center text-gray-400 font-medium">対象月のイベントはありません</td>
                    </tr>
                  </tbody>
                  <tfoot v-if="filteredEvents.length > 0" class="bg-slate-50 font-black border-t border-gray-200">
                    <tr>
                      <td colspan="2" class="px-6 py-4 text-gray-900">合計</td>
                      <td class="px-6 py-4 text-right text-gray-900">{{ totalAttendance }}名</td>
                      <td></td>
                      <td class="px-6 py-4 text-right text-blue-700 font-black">¥{{ totalSales.toLocaleString() }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <!-- 担当者別集計 -->
          <div>
            <div class="flex items-center justify-between mb-4 px-2">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users class="w-5 h-5 text-gray-400" />
                担当者別売上貢献
              </h2>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div v-if="loadingParticipants" class="flex items-center justify-center py-12 gap-3">
                <Loader2 class="w-5 h-5 text-blue-600 animate-spin" />
                <span class="text-sm text-gray-400 font-medium">名簿を集計中...</span>
              </div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead>
                    <tr class="bg-slate-50 border-b border-gray-200">
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">担当者</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">着座</th>
                      <th class="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">売上</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="staff in staffSales" :key="staff.staff_name" class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                          <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                            {{ staff.staff_name.slice(0, 1) }}
                          </div>
                          <span class="font-bold text-gray-900">{{ staff.staff_name }}</span>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-right font-bold text-gray-700">
                        {{ staff.attendance }}
                      </td>
                      <td class="px-6 py-4 text-right">
                        <span class="font-black text-indigo-600">¥{{ staff.sales.toLocaleString() }}</span>
                      </td>
                    </tr>
                    <tr v-if="staffSales.length === 0">
                      <td colspan="3" class="px-6 py-12 text-center text-gray-400 font-medium uppercase tracking-tighter">No data available</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<style scoped>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}
</style>
