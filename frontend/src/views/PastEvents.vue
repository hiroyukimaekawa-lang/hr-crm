<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import {
  History,
  Search,
  ChevronDown,
  ChevronUp,
  Users as UsersIcon,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-vue-next';

interface EventSlot {
  datetime: string;
}

interface EventItem {
  id: number;
  title: string;
  event_date?: string;
  event_slots?: EventSlot[];
  total_count: number;
  attended_count: number;
  a_entry_count: number;
  b_waiting_count: number;
  c_waiting_count: number;
  xa_cancel_count: number;
}

interface Participant {
  student_id: number;
  name: string;
  university?: string;
  status: string;
  staff_name?: string;
  selected_event_date?: string;
}

const events = ref<EventItem[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedMonth = ref('ALL');
const expandedRows = ref<Set<number>>(new Set());
const participantsData = ref<Record<number, Participant[]>>({});
const loadingParticipants = ref<Record<number, boolean>>({});
const router = useRouter();

const today = new Date();
today.setHours(0, 0, 0, 0);

const fetchEvents = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/projects', { headers: { Authorization: token } });
    events.value = res.data;
  } catch (err) {
    console.error('Failed to fetch events:', err);
  } finally {
    loading.value = false;
  }
};

const pastEvents = computed(() => {
  return events.value.filter((e) => {
    let lastDate: Date | null = null;
    if (Array.isArray(e.event_slots) && e.event_slots.length > 0) {
      const dates = e.event_slots
        .map((s) => new Date(s.datetime))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      if (dates.length > 0) {
        const d = dates[0];
        if (d) lastDate = d;
      }
    } else if (e.event_date) {
      lastDate = new Date(e.event_date);
    }
    
    return lastDate ? lastDate < today : false;
  });
});

const filteredEvents = computed(() => {
  return pastEvents.value.filter((e) => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    let matchesMonth = true;
    if (selectedMonth.value !== 'ALL') {
      const slotDate = (e.event_slots && e.event_slots.length > 0) ? e.event_slots[0]!.datetime : null;
      const date = e.event_date || slotDate;
      if (date) {
        matchesMonth = String(date).startsWith(selectedMonth.value);
      } else {
        matchesMonth = false;
      }
    }
    
    return matchesSearch && matchesMonth;
  });
});

const monthOptions = computed(() => {
  const months = new Set<string>();
  pastEvents.value.forEach((e) => {
    const slotDate = (e.event_slots && e.event_slots.length > 0) ? e.event_slots[0]!.datetime : null;
    const date = e.event_date || slotDate;
    if (date) {
      months.add(String(date).slice(0, 7));
    }
  });
  return Array.from(months).sort((a, b) => b.localeCompare(a));
});

const toggleRow = async (eventId: number) => {
  if (expandedRows.value.has(eventId)) {
    expandedRows.value.delete(eventId);
  } else {
    expandedRows.value.add(eventId);
    if (!participantsData.value[eventId]) {
      await fetchParticipants(eventId);
    }
  }
};

const fetchParticipants = async (eventId: number) => {
  loadingParticipants.value[eventId] = true;
  try {
    const token = localStorage.getItem('token');
    const res = await api.get(`/api/projects/${eventId}`, { headers: { Authorization: token } });
    participantsData.value[eventId] = res.data.participants || [];
  } catch (err) {
    console.error(`Failed to fetch participants for event ${eventId}:`, err);
  } finally {
    loadingParticipants.value[eventId] = false;
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const getEventDate = (e: EventItem) => {
  if (Array.isArray(e.event_slots) && e.event_slots.length > 0) {
    const dates = e.event_slots
      .map((s) => new Date(s.datetime))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    const d = dates[0];
    return d ? formatDate(d.toISOString()) : '-';
  }
  return formatDate(e.event_date);
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'attended': return '出席';
    case 'A_ENTRY':
    case 'registered': return 'A:エントリー';
    case 'B_WAITING': return 'B:予約待ち';
    case 'C_WAITING': return 'C:日程調整';
    case 'XA_CANCEL':
    case 'canceled': return 'XA:キャンセル';
    default: return status;
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'attended': return 'bg-emerald-100 text-emerald-700';
    case 'A_ENTRY':
    case 'registered': return 'bg-blue-100 text-blue-700';
    case 'B_WAITING': return 'bg-amber-100 text-amber-700';
    case 'C_WAITING': return 'bg-slate-100 text-slate-700';
    case 'XA_CANCEL':
    case 'canceled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

onMounted(fetchEvents);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <!-- ヘッダーセクション -->
      <div class="flex flex-col gap-4 md:flex-row md:items-center justify-between mb-8">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <div class="p-2 bg-slate-100 rounded-xl">
              <History class="w-6 h-6 text-slate-600" />
            </div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">過去案件一覧</h1>
          </div>
          <p class="text-sm text-gray-500 mt-1">終了した案件の実績・参加者を確認できます。</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative min-w-[240px]">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="案件名で検索..."
              class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <select
            v-model="selectedMonth"
            class="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
          >
            <option value="ALL">すべての期間</option>
            <option v-for="month in monthOptions" :key="month" :value="month">{{ month }}</option>
          </select>
        </div>
      </div>

      <!-- メインコンテンツ -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 class="w-10 h-10 text-blue-600 animate-spin" />
        <p class="text-gray-500 font-medium">案件データを読み込み中...</p>
      </div>

      <div v-else-if="filteredEvents.length === 0" class="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <History class="w-8 h-8 text-slate-300" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 mb-1">案件が見つかりません</h3>
        <p class="text-gray-500 text-sm">検索条件を変更するか、新しい案件を作成してください。</p>
      </div>

      <div v-else class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-gray-200">
                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">案件名</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">開催日</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">着座数</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">エントリー</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div class="flex items-center justify-center gap-4">
                    <span>A</span>
                    <span>B</span>
                    <span>C</span>
                    <span>XA</span>
                  </div>
                </th>
                <th class="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <template v-for="event in filteredEvents" :key="event.id">
                <!-- 親行 -->
                <tr
                  @click="toggleRow(event.id)"
                  class="group hover:bg-blue-50/40 transition-colors cursor-pointer"
                  :class="{ 'bg-blue-50/20': expandedRows.has(event.id) }"
                >
                  <td class="px-6 py-5">
                    <div class="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{{ event.title }}</div>
                  </td>
                  <td class="px-6 py-5">
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar class="w-4 h-4 text-gray-400" />
                      {{ getEventDate(event) }}
                    </div>
                  </td>
                  <td class="px-6 py-5 text-center">
                    <span class="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-sm border border-emerald-100">
                      {{ event.attended_count }}
                    </span>
                  </td>
                  <td class="px-6 py-5 text-center">
                    <div class="text-sm font-semibold text-gray-700">{{ event.total_count }}</div>
                  </td>
                  <td class="px-6 py-5">
                    <div class="flex items-center justify-center gap-4 text-xs font-bold">
                      <span class="text-blue-600">{{ event.a_entry_count }}</span>
                      <span class="text-amber-600">{{ event.b_waiting_count }}</span>
                      <span class="text-slate-500">{{ event.c_waiting_count }}</span>
                      <span class="text-red-500">{{ event.xa_cancel_count }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-5 text-right">
                    <component :is="expandedRows.has(event.id) ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
                  </td>
                </tr>

                <!-- 子行（参加者詳細） -->
                <tr v-if="expandedRows.has(event.id)">
                  <td colspan="6" class="px-6 py-0 bg-slate-50/30">
                    <div class="py-6 px-4 border-t border-gray-100">
                      <div class="flex items-center justify-between mb-4 px-2">
                        <div class="flex items-center gap-2">
                          <UsersIcon class="w-4 h-4 text-gray-400" />
                          <h4 class="text-sm font-bold text-gray-700">参加者リスト</h4>
                        </div>
                        <button
                          @click.stop="router.push(`/projects/${event.id}`)"
                          class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-3 py-1.5 border border-blue-100 rounded-lg shadow-sm"
                        >
                          <ExternalLink class="w-3 h-3" />
                          管理画面へ
                        </button>
                      </div>

                      <div v-if="loadingParticipants[event.id]" class="flex items-center justify-center py-8 gap-3">
                        <Loader2 class="w-4 h-4 text-blue-600 animate-spin" />
                        <span class="text-xs text-gray-400 font-medium">読み込み中...</span>
                      </div>

                      <div v-else-if="!participantsData[event.id]?.length" class="py-12 text-center bg-white border border-gray-100 rounded-2xl">
                        <UsersIcon class="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p class="text-sm text-gray-400 font-medium tracking-tight">参加者がいません</p>
                      </div>

                      <div v-else class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table class="w-full text-left text-xs">
                          <thead>
                            <tr class="bg-gray-50/50 border-b border-gray-100">
                              <th class="px-4 py-3 font-bold text-gray-500">氏名</th>
                              <th class="px-4 py-3 font-bold text-gray-500">大学</th>
                              <th class="px-4 py-3 font-bold text-gray-500">担当</th>
                              <th class="px-4 py-3 font-bold text-gray-500">ステータス</th>
                              <th class="px-4 py-3 font-bold text-gray-500">最終日程</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-50">
                            <tr
                              v-for="p in participantsData[event.id]"
                              :key="p.student_id"
                              @click.stop="router.push(`/students/${p.student_id}`)"
                              class="hover:bg-blue-50/30 transition-colors cursor-pointer"
                            >
                              <td class="px-4 py-3 font-bold text-blue-600 hover:underline">{{ p.name }}</td>
                              <td class="px-4 py-3 text-gray-600">{{ p.university || '-' }}</td>
                              <td class="px-4 py-3 text-gray-600">{{ p.staff_name || '-' }}</td>
                              <td class="px-4 py-3">
                                <span
                                  class="px-2 py-0.5 rounded-full text-[10px] font-bold border border-current opacity-90"
                                  :class="getStatusClass(p.status)"
                                >
                                  {{ getStatusLabel(p.status) }}
                                </span>
                              </td>
                              <td class="px-4 py-3 text-gray-400 font-medium">
                                {{ p.selected_event_date ? formatDate(p.selected_event_date) : '-' }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Layout>
</template>

<style scoped>
/* スムーズな展開アニメーションが必要な場合はここに追加 */
</style>
