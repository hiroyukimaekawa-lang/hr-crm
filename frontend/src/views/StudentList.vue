<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import {
  Search,
  Filter,
  ChevronRight,
  UserPlus,
  Download
} from 'lucide-vue-next';

interface Student {
  id: number;
  name: string;
  university?: string;
  faculty?: string;
  desired_industry?: string;
  desired_role?: string;
  graduation_year?: number | null;
  email?: string;
  phone?: string;
  status?: string;
  tags?: string[] | null;
  staff_id?: number | null;
  staff_name?: string;
}

interface StaffUser {
  id: number;
  name: string;
}

const students = ref<Student[]>([]);
const staffUsers = ref<StaffUser[]>([]);
const router = useRouter();
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');
const showAll = ref(false);

const searchTerm = ref('');
const statusFilter = ref('ALL');
const universityFilter = ref('ALL');

const showCreate = ref(false);
const newStudent = ref({
  name: '',
  university: '',
  faculty: '',
  desired_industry: '',
  desired_role: '',
  graduation_year: '',
  email: '',
  phone: '',
  status: 'active',
  tags: ''
});

const fetchStudents = async () => {
  try {
    const token = localStorage.getItem('token');
    let url = 'http://localhost:3000/api/students';
    if (!showAll.value && user.id) {
      url += `?staffId=${user.id}`;
    }
    const res = await axios.get(url, { headers: { Authorization: token } });
    students.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const fetchStaffUsers = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:3000/api/auth/users', { headers: { Authorization: token } });
    staffUsers.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const updateStaff = async (studentId: number, staffId: number | null) => {
  try {
    const token = localStorage.getItem('token');
    await axios.put(`http://localhost:3000/api/students/${studentId}/staff`, {
      staff_id: staffId
    }, { headers: { Authorization: token } });
    fetchStudents();
  } catch (err) {
    console.error(err);
  }
};

const createStudent = async () => {
  try {
    const token = localStorage.getItem('token');
    const tags = newStudent.value.tags
      ? newStudent.value.tags.split(',').map(t => t.trim()).filter(Boolean)
      : null;

    await axios.post('http://localhost:3000/api/students', {
      name: newStudent.value.name,
      university: newStudent.value.university,
      faculty: newStudent.value.faculty,
      desired_industry: newStudent.value.desired_industry,
      desired_role: newStudent.value.desired_role,
      graduation_year: newStudent.value.graduation_year ? Number(newStudent.value.graduation_year) : null,
      email: newStudent.value.email,
      phone: newStudent.value.phone,
      status: newStudent.value.status || 'active',
      tags,
      staff_id: user.id
    }, { headers: { Authorization: token } });

    showCreate.value = false;
    newStudent.value = {
      name: '',
      university: '',
      faculty: '',
      desired_industry: '',
      desired_role: '',
      graduation_year: '',
      email: '',
      phone: '',
      status: 'active',
      tags: ''
    };
    fetchStudents();
  } catch (err) {
    console.error(err);
  }
};

const universities = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => s.university && set.add(s.university));
  return ['ALL', ...Array.from(set)];
});

const statusOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => s.status && set.add(s.status));
  return ['ALL', ...Array.from(set)];
});

const filteredStudents = computed(() => {
  const term = searchTerm.value.toLowerCase();
  return students.value.filter(s => {
    const matchesSearch = !term ||
      (s.name || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.university || '').toLowerCase().includes(term) ||
      (s.faculty || '').toLowerCase().includes(term) ||
      (s.desired_industry || '').toLowerCase().includes(term) ||
      (s.desired_role || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter.value === 'ALL' || s.status === statusFilter.value;
    const matchesUniversity = universityFilter.value === 'ALL' || s.university === universityFilter.value;
    return matchesSearch && matchesStatus && matchesUniversity;
  });
});

const statusClass = (status?: string) => {
  switch (status) {
    case '内定':
      return 'bg-green-100 text-green-700';
    case '選考中':
      return 'bg-blue-100 text-blue-700';
    case '辞退':
      return 'bg-gray-100 text-gray-600';
    case '不合格':
      return 'bg-red-100 text-red-700';
    case '未着手':
      return 'bg-amber-100 text-amber-700';
    case '面談':
      return 'bg-indigo-100 text-indigo-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const downloadCsv = () => {
  const rows = filteredStudents.value.map(s => ({
    name: s.name,
    university: s.university || '',
    faculty: s.faculty || '',
    desired_industry: s.desired_industry || '',
    desired_role: s.desired_role || '',
    graduation_year: s.graduation_year || '',
    email: s.email || '',
    phone: s.phone || '',
    status: s.status || '',
    tags: Array.isArray(s.tags) ? s.tags.join('|') : ''
  }));
  const header = ['name', 'university', 'faculty', 'desired_industry', 'desired_role', 'graduation_year', 'email', 'phone', 'status', 'tags'];
  const csv = [header.join(','), ...rows.map(r => header.map(h => `"${String((r as any)[h]).replace(/\"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'students.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

onMounted(() => {
  fetchStudents();
  if (user.role === 'admin') {
    fetchStaffUsers();
  }
});
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">学生一覧</h1>
          <p class="text-gray-500 mt-2">登録されている学生の情報を管理・確認できます。</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="downloadCsv"
            class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Download class="w-4 h-4" />
            CSV出力
          </button>
          <button
            @click="showCreate = true"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <UserPlus class="w-4 h-4" />
            学生登録
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-col gap-4">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="flex-1 relative">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchTerm"
              type="text"
              placeholder="名前・メール・大学・学部・志望で検索..."
              class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-gray-400" />
            <select
              v-model="statusFilter"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="s in statusOptions" :key="s" :value="s">
                {{ s === 'ALL' ? 'ステータス: すべて' : s }}
              </option>
            </select>
            <select
              v-model="universityFilter"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="u in universities" :key="u" :value="u">
                {{ u === 'ALL' ? '大学: すべて' : u }}
              </option>
            </select>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" v-model="showAll" @change="fetchStudents" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          全学生を表示
        </label>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大学</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学部</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">卒業年</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メール</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="s in filteredStudents" :key="s.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">{{ s.name }}</div>
                <div v-if="Array.isArray(s.tags) && s.tags.length" class="mt-1 flex flex-wrap gap-1">
                  <span v-for="tag in s.tags.slice(0, 2)" :key="tag" class="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ s.university }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ s.faculty || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ s.graduation_year || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ s.email }}</td>
              <td class="px-6 py-4">
                <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="statusClass(s.status)">
                  {{ s.status || '未設定' }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">
                <div v-if="user.role === 'admin'" class="max-w-[180px]">
                  <select
                    :value="s.staff_id || ''"
                    @change="updateStaff(s.id, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
                    class="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">未割当</option>
                    <option v-for="u in staffUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
                  </select>
                </div>
                <span v-else>{{ s.staff_name || '-' }}</span>
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  class="text-blue-600 hover:text-blue-800 text-sm font-semibold inline-flex items-center gap-1"
                  @click="router.push(`/students/${s.id}`)"
                >
                  詳細
                  <ChevronRight class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="filteredStudents.length === 0">
              <td colSpan="8" class="px-6 py-10 text-center text-sm text-gray-400">
                該当する学生が見つかりませんでした。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4 text-gray-900">新規学生登録</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">氏名</label>
            <input v-model="newStudent.name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">大学</label>
            <input v-model="newStudent.university" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">学部</label>
            <input v-model="newStudent.faculty" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">志望業界</label>
            <input v-model="newStudent.desired_industry" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">志望職種</label>
            <input v-model="newStudent.desired_role" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">卒業年</label>
            <input v-model="newStudent.graduation_year" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input v-model="newStudent.email" type="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
            <input v-model="newStudent.phone" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select v-model="newStudent.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="active">active</option>
              <option value="面談">面談</option>
              <option value="選考中">選考中</option>
              <option value="内定">内定</option>
              <option value="辞退">辞退</option>
              <option value="不合格">不合格</option>
              <option value="未着手">未着手</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">タグ（カンマ区切り）</label>
            <input v-model="newStudent.tags" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: エンジニア志望, 海外経験">
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button @click="showCreate = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
          <button @click="createStudent" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
        </div>
      </div>
    </div>
  </Layout>
</template>
