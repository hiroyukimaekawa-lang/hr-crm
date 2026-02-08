<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
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
  event_date?: string;
  location?: string;
  capacity?: number;
}

const route = useRoute();
const router = useRouter();
const eventId = route.params.id as string;

const event = ref<EventDetail | null>(null);
const participants = ref<Participant[]>([]);
const searchTerm = ref('');

const fetchDetail = async () => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`http://localhost:3000/api/events/${eventId}`, { headers: { Authorization: token } });
  event.value = res.data.event;
  participants.value = res.data.participants;
};

const updateStatus = async (studentId: number, status: string) => {
  const token = localStorage.getItem('token');
  await axios.put(`http://localhost:3000/api/events/${eventId}/participants/${studentId}`,
    { status },
    { headers: { Authorization: token } }
  );
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
          <h1 class="text-2xl font-bold text-gray-900 mb-4">{{ event.title }}</h1>
          <div class="space-y-3">
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
              <span>定員: {{ event.capacity || '-' }}名</span>
            </div>
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
