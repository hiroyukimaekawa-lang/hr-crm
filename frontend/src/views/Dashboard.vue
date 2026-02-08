<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import Layout from '../components/Layout.vue';
import { Users, Calendar, UserPlus, FileCheck, Link as LinkIcon } from 'lucide-vue-next';

interface Student {
  id: number;
  name: string;
  status?: string;
  created_at?: string;
}

interface EventItem {
  id: number;
  title: string;
  event_date?: string;
  total_count?: number;
  attended_count?: number;
}

const students = ref<Student[]>([]);
const events = ref<EventItem[]>([]);
const inviteUrl = ref('');
const inviteMessage = ref('');
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const [studentRes, eventRes] = await Promise.all([
      axios.get('http://localhost:3000/api/students', { headers: { Authorization: token } }),
      axios.get('http://localhost:3000/api/events', { headers: { Authorization: token } })
    ]);
    students.value = studentRes.data;
    events.value = eventRes.data;
  } catch (err) {
    console.error(err);
  }
};

const createInvite = async () => {
  try {
    inviteMessage.value = '';
    const token = localStorage.getItem('token');
    const res = await axios.post('http://localhost:3000/api/auth/invite', {}, { headers: { Authorization: token } });
    inviteUrl.value = res.data.invite_url;
  } catch (err) {
    inviteMessage.value = '招待URLの発行に失敗しました。';
  }
};

const copyInvite = async () => {
  if (!inviteUrl.value) return;
  await navigator.clipboard.writeText(inviteUrl.value);
  inviteMessage.value = 'コピーしました。';
};

const totalParticipants = computed(() =>
  events.value.reduce((sum, e) => sum + Number(e.total_count || 0), 0)
);

const attendedParticipants = computed(() =>
  events.value.reduce((sum, e) => sum + Number(e.attended_count || 0), 0)
);

const upcomingEvents = computed(() => {
  const now = new Date();
  return events.value.filter(e => e.event_date && new Date(e.event_date) > now).length;
});

const statusData = computed(() => {
  const map: Record<string, number> = {};
  students.value.forEach(s => {
    const key = s.status || '未設定';
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count }));
});

const recentStudents = computed(() => {
  return [...students.value]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);
});

const stats = computed(() => [
  { label: '総学生数', value: students.value.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
  { label: 'イベント数', value: events.value.length, icon: Calendar, color: 'bg-green-50 text-green-600' },
  { label: '参加者数', value: totalParticipants.value, icon: UserPlus, color: 'bg-purple-50 text-purple-600' },
  { label: '出席者数', value: attendedParticipants.value, icon: FileCheck, color: 'bg-amber-50 text-amber-600' }
]);

onMounted(fetchData);
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p class="text-gray-500 mt-2">最新の統計と活動状況を確認できます。</p>
      </div>

      <div v-if="user.role === 'admin'" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-gray-900">担当者招待URL</h2>
          <button @click="createInvite" class="px-4 py-2 bg-blue-600 text-white rounded-lg">発行</button>
        </div>
        <div v-if="inviteUrl" class="flex items-center gap-2">
          <input :value="inviteUrl" readonly class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button @click="copyInvite" class="px-3 py-2 border border-gray-200 rounded-lg text-sm flex items-center gap-2">
            <LinkIcon class="w-4 h-4" />
            コピー
          </button>
        </div>
        <p v-if="inviteMessage" class="text-xs text-gray-500 mt-2">{{ inviteMessage }}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div v-for="card in stats" :key="card.label" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center gap-4">
            <div :class="`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center`">
              <component :is="card.icon" class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm text-gray-500">{{ card.label }}</p>
              <p class="text-2xl font-bold text-gray-900">{{ card.value }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-900">ステータス別学生数</h2>
            <span class="text-sm text-gray-500">開催予定: {{ upcomingEvents }}件</span>
          </div>
          <div class="space-y-3">
            <div v-for="item in statusData" :key="item.name" class="flex items-center gap-4">
              <span class="text-sm text-gray-700 w-24">{{ item.name }}</span>
              <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-600 rounded-full"
                  :style="{ width: `${Math.round((item.count / Math.max(students.length, 1)) * 100)}%` }"
                />
              </div>
              <span class="text-sm text-gray-500 w-10 text-right">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-4">最近登録された学生</h2>
          <div class="space-y-3">
            <div v-for="s in recentStudents" :key="s.id" class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ s.name }}</p>
                <p class="text-xs text-gray-500">{{ s.status || '未設定' }}</p>
              </div>
              <span class="text-xs text-gray-400">{{ s.created_at ? new Date(s.created_at).toLocaleDateString('ja-JP') : '-' }}</span>
            </div>
            <div v-if="recentStudents.length === 0" class="text-sm text-gray-400">学生データがありません。</div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
