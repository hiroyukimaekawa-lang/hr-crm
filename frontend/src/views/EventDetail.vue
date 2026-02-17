<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users as UsersIcon,
  Search,
  CheckCircle,
  XCircle
} from 'lucide-vue-next';

interface Participant {
  student_id: number;
  status: string;
  created_at: string;
  name: string;
  university?: string;
  email?: string;
  phone?: string;
  graduation_year?: number | null;
}

interface EventDetail {
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
  lp_url?: string;
}

const route = useRoute();
const router = useRouter();
const eventId = route.params.id as string;

const event = ref<EventDetail | null>(null);
const participants = ref<Participant[]>([]);
const searchTerm = ref('');
const isEditing = ref(false);
const saveMessage = ref('');
const form = ref({
  title: '',
  description: '',
  event_date: '',
  location: '',
  lp_url: '',
  target_seats: '',
  unit_price: '',
  target_sales: '',
  current_sales: ''
});

const fetchDetail = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/events/${eventId}`, { headers: { Authorization: token } });
  event.value = res.data.event;
  participants.value = res.data.participants;
  form.value = {
    title: event.value?.title || '',
    description: event.value?.description || '',
    event_date: event.value?.event_date ? new Date(event.value.event_date).toISOString().slice(0, 16) : '',
    location: event.value?.location || '',
    lp_url: event.value?.lp_url || '',
    target_seats: event.value?.target_seats ? String(event.value.target_seats) : '',
    unit_price: event.value?.unit_price ? String(event.value.unit_price) : '',
    target_sales: event.value?.target_sales ? String(event.value.target_sales) : '',
    current_sales: event.value?.current_sales ? String(event.value.current_sales) : ''
  };
};

const updateStatus = async (studentId: number, status: string) => {
  const token = localStorage.getItem('token');
  await api.put(`/api/events/${eventId}/participants/${studentId}`,
    { status },
    { headers: { Authorization: token } }
  );
  fetchDetail();
};

const updateEvent = async () => {
  const token = localStorage.getItem('token');
  saveMessage.value = '';
  await api.put(`/api/events/${eventId}`, {
    title: form.value.title,
    description: form.value.description,
    event_date: form.value.event_date || null,
    location: form.value.location || null,
    lp_url: form.value.lp_url || null,
    target_seats: form.value.target_seats ? Number(form.value.target_seats) : null,
    unit_price: form.value.unit_price ? Number(form.value.unit_price) : null,
    target_sales: form.value.target_sales ? Number(form.value.target_sales) : null,
    current_sales: form.value.current_sales ? Number(form.value.current_sales) : 0
  }, { headers: { Authorization: token } });
  isEditing.value = false;
  saveMessage.value = 'イベント情報を更新しました。';
  fetchDetail();
};

const filteredParticipants = computed(() => {
  const term = searchTerm.value.toLowerCase();
  return participants.value.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.university || '').toLowerCase().includes(term)
  );
});

const statusBadge = (status: string) => {
  switch (status) {
    case 'attended':
      return 'bg-green-100 text-green-700';
    case 'registered':
      return 'bg-blue-100 text-blue-700';
    case 'canceled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

onMounted(fetchDetail);
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <button @click="router.push('/events')" class="text-gray-600 hover:text-gray-900 flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          一覧に戻る
        </button>
      </div>

      <div v-if="!event" class="text-gray-500">イベントが見つかりませんでした。</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-2xl font-bold text-gray-900">{{ event.title }}</h1>
            <button
              class="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
              @click="isEditing = !isEditing"
            >
              {{ isEditing ? '編集を閉じる' : 'イベント編集' }}
            </button>
          </div>
          <div class="space-y-3 mb-4">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <Calendar class="w-4 h-4" />
              <span>{{ event.event_date ? new Date(event.event_date).toLocaleString('ja-JP') : '未定' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <MapPin class="w-4 h-4" />
              <span>{{ event.location || '会場未設定' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <UsersIcon class="w-4 h-4" />
              <span>目標人数: {{ event.target_seats || '-' }}名</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span>単価: {{ (event.unit_price || 0).toLocaleString() }}円</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="font-medium">LP:</span>
              <a
                v-if="event.lp_url"
                :href="event.lp_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-700 break-all"
              >
                {{ event.lp_url }}
              </a>
              <span v-else>-</span>
            </div>
          </div>
          <div v-if="saveMessage" class="text-xs text-green-600 mb-3">{{ saveMessage }}</div>

          <div v-if="isEditing" class="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">イベント名</label>
              <input v-model="form.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">開催日時</label>
              <input v-model="form.event_date" type="datetime-local" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">場所（オンライン/会場）</label>
              <input v-model="form.location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">LPリンク</label>
              <input v-model="form.lp_url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">目標人数</label>
              <input v-model="form.target_seats" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">単価（円）</label>
              <input v-model="form.unit_price" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">目標売上（円）</label>
              <input v-model="form.target_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">実績売上（円）</label>
              <input v-model="form.current_sales" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">説明</label>
              <textarea v-model="form.description" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24"></textarea>
            </div>
            <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700" @click="updateEvent">
              保存
            </button>
          </div>
        </div>

        <div class="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-900">参加学生一覧</h2>
            <div class="relative w-64">
              <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                v-model="searchTerm"
                type="text"
                placeholder="学生名で検索..."
                class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">氏名</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">大学</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">申込日</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="p in filteredParticipants" :key="p.student_id" class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <button class="text-blue-600 hover:text-blue-800" @click="router.push(`/students/${p.student_id}`)">
                      {{ p.name }}
                    </button>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{{ p.university || '-' }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ new Date(p.created_at).toLocaleDateString('ja-JP') }}</td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="statusBadge(p.status)">
                      {{ p.status === 'attended' ? '出席' : p.status === 'registered' ? '申込' : 'キャンセル' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="inline-flex items-center gap-2">
                      <button class="text-green-600 hover:text-green-700" @click="updateStatus(p.student_id, 'attended')" title="出席">
                        <CheckCircle class="w-4 h-4" />
                      </button>
                      <button class="text-gray-500 hover:text-gray-600" @click="updateStatus(p.student_id, 'registered')" title="申込">
                        <UsersIcon class="w-4 h-4" />
                      </button>
                      <button class="text-red-600 hover:text-red-700" @click="updateStatus(p.student_id, 'canceled')" title="キャンセル">
                        <XCircle class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredParticipants.length === 0">
                  <td colSpan="5" class="px-4 py-10 text-center text-gray-400">参加者は見つかりませんでした。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
