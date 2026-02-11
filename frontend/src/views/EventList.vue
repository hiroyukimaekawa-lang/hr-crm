<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import {
  Calendar,
  MapPin,
  Users as UsersIcon,
  Plus,
  ChevronRight,
  Trash2
} from 'lucide-vue-next';

interface EventItem {
  id: number;
  title: string;
  description?: string;
  event_date?: string;
  location?: string;
  capacity?: number;
  target_seats?: number;
  unit_price?: number;
  target_sales?: number;
  current_sales?: number;
  registered_count?: number;
  attended_count?: number;
  total_count?: number;
  registered_participants?: { id: number; name: string }[];
}

const events = ref<EventItem[]>([]);
const newEvent = ref({
  title: '',
  description: '',
  event_date: '',
  location: '',
  target_seats: '',
  unit_price: '',
  target_sales: '',
  current_sales: ''
});
const showCreate = ref(false);
const router = useRouter();

const fetchEvents = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/events', { headers: { Authorization: token } });
  events.value = res.data;
};

const createEvent = async () => {
  const token = localStorage.getItem('token');
  await api.post('/api/events', {
    ...newEvent.value,
    target_seats: newEvent.value.target_seats ? Number(newEvent.value.target_seats) : null,
    unit_price: newEvent.value.unit_price ? Number(newEvent.value.unit_price) : null,
    target_sales: newEvent.value.target_sales ? Number(newEvent.value.target_sales) : null,
    current_sales: newEvent.value.current_sales ? Number(newEvent.value.current_sales) : 0
  }, { headers: { Authorization: token } });
  newEvent.value = { title: '', description: '', event_date: '', location: '', target_seats: '', unit_price: '', target_sales: '', current_sales: '' };
  showCreate.value = false;
  fetchEvents();
};

const deleteEvent = async (eventId: number) => {
  if (!confirm('このイベントを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/events/${eventId}`, { headers: { Authorization: token } });
  fetchEvents();
};

const eventStatus = (eventDate?: string) => {
  if (!eventDate) return '未定';
  return new Date(eventDate) > new Date() ? '開催予定' : '終了';
};

const progressRate = (event: EventItem) => {
  const target = event.target_seats || 0;
  if (target === 0) return 0;
  return Math.min(Math.round(((event.registered_count || 0) / target) * 100), 100);
};

onMounted(fetchEvents);
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">イベント一覧</h1>
          <p class="text-gray-500 mt-2">開催予定および過去のイベントを一覧で確認できます。</p>
        </div>
        <button
          @click="showCreate = true"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>イベント作成</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="e in events" :key="e.id" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <Calendar class="w-3.5 h-3.5" />
                {{ e.event_date ? new Date(e.event_date).toLocaleDateString('ja-JP') : '日程未定' }}
              </span>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full" :class="eventStatus(e.event_date) === '開催予定' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'">
                  {{ eventStatus(e.event_date) }}
                </span>
                <button
                  class="text-gray-400 hover:text-red-600"
                  @click="deleteEvent(e.id)"
                  title="削除"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-2">{{ e.title }}</h3>
            <p class="text-sm text-gray-500 mb-4 line-clamp-2">{{ e.description || '説明は未登録です' }}</p>

            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <MapPin class="w-4 h-4" />
                <span>{{ e.location || '会場未設定' }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <UsersIcon class="w-4 h-4" />
                <span>目標着座: {{ e.target_seats || '-' }}名</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span>単価: {{ (e.unit_price || 0).toLocaleString() }}円</span>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div class="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>エントリー: {{ e.registered_count || 0 }}名</span>
              <span>出席: {{ e.attended_count || 0 }}名</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>目標売上: {{ (e.target_sales || 0).toLocaleString() }}円</span>
              <span>実績売上: {{ (e.current_sales || 0).toLocaleString() }}円</span>
            </div>
            <div class="mb-4">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>充足率（エントリー）</span>
                <span>{{ progressRate(e) }}%</span>
              </div>
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full bg-blue-600" :style="{ width: `${progressRate(e)}%` }" />
              </div>
            </div>
            <div class="mb-4">
              <p class="text-xs font-semibold text-gray-600 mb-2">参加者一覧（エントリー）</p>
              <div v-if="e.registered_participants && e.registered_participants.length" class="flex flex-wrap gap-2">
                <span v-for="p in e.registered_participants" :key="p.id" class="text-xs px-2 py-1 bg-white border border-gray-200 rounded-full">
                  {{ p.name }}
                </span>
              </div>
              <p v-else class="text-xs text-gray-400">エントリーはまだありません</p>
            </div>
            <button
              class="w-full text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center justify-center gap-2 py-2 border border-blue-100 rounded-lg bg-white"
              @click="router.push(`/events/${e.id}`)"
            >
              詳細・参加者管理
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4 text-gray-900">新規イベント作成</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">イベント名</label>
            <input v-model="newEvent.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea v-model="newEvent.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開催日時</label>
            <input v-model="newEvent.event_date" type="datetime-local" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">会場</label>
            <input v-model="newEvent.location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">目標着座人数</label>
            <input v-model="newEvent.target_seats" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">単価（円）</label>
            <input v-model="newEvent.unit_price" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">目標売上（円）</label>
            <input v-model="newEvent.target_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">実績売上（円）</label>
            <input v-model="newEvent.current_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button @click="showCreate = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
          <button @click="createEvent" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">作成</button>
        </div>
      </div>
    </div>
  </Layout>
</template>
