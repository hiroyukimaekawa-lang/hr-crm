<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import {
  Filter,
  ChevronRight,
  UserPlus,
  Download,
  Upload,
  Trash2
} from 'lucide-vue-next';

interface Student {
  id: number;
  name: string;
  university?: string;
  academic_track?: string;
  faculty?: string;
  referral_status?: string;
  progress_stage?: string;
  next_meeting_date?: string | null;
  next_action?: string | null;
  latest_task_due_date?: string | null;
  source_company?: string;
  interview_reason?: string;
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
const showAll = ref(user.role === 'admin');

const selectedNames = ref<string[]>([]);
const selectedUniversities = ref<string[]>([]);
const nameSearch = ref('');
const universitySearch = ref('');
const staffFilter = ref('ALL');
const sourceCompanyFilter = ref('ALL');
const academicTrackFilter = ref('ALL');
const referralStatusFilter = ref('ALL');
const nextMeetingFilter = ref('ALL');
const nextMeetingFrom = ref('');
const nextMeetingTo = ref('');
const graduationYearFilter = ref('ALL');
const taskDueFilter = ref<'ALL' | 'HAS' | 'NO'>('ALL');
const taskDueFrom = ref('');
const taskDueTo = ref('');

const showCreate = ref(false);
const newStudent = ref({
  source_company: '',
  name: '',
  university: '',
  academic_track: '',
  faculty: '',
  interview_reason: '',
  referral_status: '不明',
  progress_stage: '初回面談',
  next_meeting_date: '',
  next_action: '',
  graduation_year: '',
  email: '',
  status: '不明',
  staff_id: ''
});

const fetchStudents = async () => {
  try {
    const token = localStorage.getItem('token');
    let url = '/api/students';
    if (!showAll.value && user.id) {
      url += `?staffId=${user.id}`;
    }
    const res = await api.get(url, { headers: { Authorization: token } });
    students.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const fetchStaffUsers = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/auth/users', { headers: { Authorization: token } });
    staffUsers.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const updateStaff = async (studentId: number, staffId: number | null) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId}/staff`, {
      staff_id: staffId
    }, { headers: { Authorization: token } });
    fetchStudents();
  } catch (err) {
    console.error(err);
  }
};

const referralStatusOptions = ['キーマン', '出そう', 'ほぼ無理ワンチャン', '無理', '不明'];
const progressStageOptions = ['初回面談', '2回目面談', '顧客化', 'トビ'];

const updateStudentMeta = async (studentId: number, payload: { referral_status?: string; progress_stage?: string; source_company?: string; next_meeting_date?: string | null; next_action?: string | null }) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId}/meta`, payload, { headers: { Authorization: token } });
    fetchStudents();
  } catch (err) {
    console.error(err);
  }
};

const deleteStudent = async (studentId: number) => {
  if (!confirm('この学生を削除しますか？')) return;
  try {
    const token = localStorage.getItem('token');
    await api.delete(`/api/students/${studentId}`, { headers: { Authorization: token } });
    fetchStudents();
  } catch (err) {
    console.error(err);
  }
};

const createStudent = async () => {
  try {
    const token = localStorage.getItem('token');

    await api.post('/api/students', {
      source_company: newStudent.value.source_company,
      name: newStudent.value.name,
      university: newStudent.value.university,
      academic_track: newStudent.value.academic_track || null,
      faculty: newStudent.value.faculty,
      referral_status: newStudent.value.referral_status,
      progress_stage: newStudent.value.progress_stage,
      next_meeting_date: newStudent.value.next_meeting_date || null,
      next_action: newStudent.value.next_action || null,
      interview_reason: newStudent.value.interview_reason || null,
      graduation_year: newStudent.value.graduation_year ? Number(newStudent.value.graduation_year) : null,
      email: newStudent.value.email,
      status: newStudent.value.status || '面談',
      staff_id: user.role === 'admin'
        ? (newStudent.value.staff_id ? Number(newStudent.value.staff_id) : null)
        : user.id
    }, { headers: { Authorization: token } });

    showCreate.value = false;
    newStudent.value = {
      source_company: '',
      name: '',
      university: '',
      academic_track: '',
      faculty: '',
      interview_reason: '',
      referral_status: '不明',
      progress_stage: '初回面談',
      next_meeting_date: '',
      next_action: '',
      graduation_year: '',
      email: '',
      status: '不明',
      staff_id: ''
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

const names = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => s.name && set.add(s.name));
  return Array.from(set);
});

const filteredNames = computed(() => {
  const term = nameSearch.value.trim().toLowerCase();
  if (!term) return names.value;
  return names.value.filter(n => n.toLowerCase().includes(term));
});

const filteredUniversityOptions = computed(() => {
  const term = universitySearch.value.trim().toLowerCase();
  const list = universities.value.slice(1);
  if (!term) return list;
  return list.filter(u => u.toLowerCase().includes(term));
});

const graduationYearOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => {
    if (s.graduation_year) set.add(String(s.graduation_year));
  });
  return ['ALL', ...Array.from(set).sort()];
});

const filteredStudents = computed(() => {
  const normalizeDateKey = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const raw = String(value);
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  };

  return students.value.filter(s => {
    const matchesName =
      selectedNames.value.length === 0 ||
      selectedNames.value.includes(s.name || '');
    const matchesUniversity =
      selectedUniversities.value.length === 0 ||
      selectedUniversities.value.includes(s.university || '');
    const matchesStaff =
      staffFilter.value === 'ALL' ||
      String(s.staff_id || '') === staffFilter.value;
    const matchesSourceCompany =
      sourceCompanyFilter.value === 'ALL' ||
      (s.source_company || '') === sourceCompanyFilter.value;
    const matchesAcademicTrack =
      academicTrackFilter.value === 'ALL' ||
      (s.academic_track || '') === academicTrackFilter.value;
    const matchesReferral =
      referralStatusFilter.value === 'ALL' ||
      (s.referral_status || '不明') === referralStatusFilter.value;
    const hasNextMeeting = !!s.next_meeting_date;
    const matchesNextMeeting =
      nextMeetingFilter.value === 'ALL' ||
      (nextMeetingFilter.value === 'SET' ? hasNextMeeting : !hasNextMeeting);
    const nextMeetingKey = normalizeDateKey(s.next_meeting_date);
    const matchesNextMeetingDate =
      (!nextMeetingFrom.value || (nextMeetingKey && nextMeetingKey >= nextMeetingFrom.value)) &&
      (!nextMeetingTo.value || (nextMeetingKey && nextMeetingKey <= nextMeetingTo.value));
    const matchesGraduationYear =
      graduationYearFilter.value === 'ALL' ||
      String(s.graduation_year || '') === graduationYearFilter.value;
    const hasTaskDue = !!s.latest_task_due_date;
    const matchesTaskDue =
      taskDueFilter.value === 'ALL' ||
      (taskDueFilter.value === 'HAS' ? hasTaskDue : !hasTaskDue);
    const taskDueKey = normalizeDateKey(s.latest_task_due_date);
    const matchesTaskDueDate =
      (!taskDueFrom.value || (taskDueKey && taskDueKey >= taskDueFrom.value)) &&
      (!taskDueTo.value || (taskDueKey && taskDueKey <= taskDueTo.value));
    return matchesName
      && matchesUniversity
      && matchesStaff
      && matchesSourceCompany
      && matchesAcademicTrack
      && matchesGraduationYear
      && matchesReferral
      && matchesNextMeeting
      && matchesNextMeetingDate
      && matchesTaskDueDate
      && matchesTaskDue;
  });
});

const sourceCompanyOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => s.source_company && set.add(s.source_company));
  return Array.from(set);
});

const clearFilters = () => {
  selectedNames.value = [];
  selectedUniversities.value = [];
  nameSearch.value = '';
  universitySearch.value = '';
  staffFilter.value = 'ALL';
  sourceCompanyFilter.value = 'ALL';
  academicTrackFilter.value = 'ALL';
  referralStatusFilter.value = 'ALL';
  nextMeetingFilter.value = 'ALL';
  nextMeetingFrom.value = '';
  nextMeetingTo.value = '';
  graduationYearFilter.value = 'ALL';
  taskDueFilter.value = 'ALL';
  taskDueFrom.value = '';
  taskDueTo.value = '';
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ja-JP');
};

const downloadCsv = () => {
  const rows = filteredStudents.value.map(s => ({
    source_company: s.source_company || '',
    name: s.name,
    university: s.university || '',
    faculty: s.faculty || '',
    referral_status: s.referral_status || '不明',
    progress_stage: s.progress_stage || '初回面談',
    graduation_year: s.graduation_year || '',
    email: s.email || '',
    status: s.status || '',
    staff_name: s.staff_name || '',
    interview_reason: s.interview_reason || ''
  }));
  const header = ['流入経路', '氏名', '大学', '学部', '紹介打診', '進捗', '卒業年', 'メール', 'ステータス', '担当', '面談理由'];
  const csv = [
    header.join(','),
    ...rows.map(r => [
      r.source_company,
      r.name,
      r.university,
      r.faculty,
      r.referral_status,
      r.progress_stage,
      r.graduation_year,
      r.email,
      r.status,
      r.staff_name,
      r.interview_reason
    ].map(v => `"${String(v).replace(/\"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'students.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current !== '' || row.length > 0) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current !== '' || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
};

const mapHeaderIndex = (header: string[]) => {
  const map: Record<string, number> = {};
  header.forEach((h, idx) => {
    map[h.trim()] = idx;
  });
  return map;
};

const importCsv = async (file: File) => {
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return;
  const header = rows[0] || [];
  const map = mapHeaderIndex(header);

  const getVal = (row: string[], key: string) => {
    const idx = map[key];
    if (idx === undefined) return '';
    return row[idx] || '';
  };

  const items = rows.slice(1).map(r => ({
    source_company: getVal(r, '流入経路'),
    name: getVal(r, '氏名'),
    university: getVal(r, '大学'),
    faculty: getVal(r, '学部'),
    referral_status: getVal(r, '紹介打診') || '不明',
    progress_stage: getVal(r, '進捗') || '初回面談',
    graduation_year: getVal(r, '卒業年'),
    email: getVal(r, 'メール'),
    status: getVal(r, 'ステータス') || '面談',
    staff_name: getVal(r, '担当'),
    interview_reason: getVal(r, '面談理由')
  })).filter(i => i.name || i.university);

  const staffMap = new Map(staffUsers.value.map(s => [s.name, s.id]));
  const payload = items.map(i => ({
    name: i.name,
    university: i.university,
    faculty: i.faculty,
    graduation_year: i.graduation_year ? Number(i.graduation_year) : null,
    email: i.email,
    status: i.status,
    staff_id: staffMap.get(i.staff_name) || null,
    source_company: i.source_company,
    interview_reason: i.interview_reason,
    referral_status: i.referral_status,
    progress_stage: i.progress_stage
  }));

  const token = localStorage.getItem('token');
  await api.post('/api/students/import', {
    students: payload
  }, { headers: { Authorization: token } });

  fetchStudents();
};

const onCsvFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  await importCsv(file);
  target.value = '';
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
    <div class="p-4 md:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">学生一覧</h1>
          <p class="text-gray-500 mt-2">登録されている学生の情報を管理・確認できます。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="downloadCsv"
            class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Download class="w-4 h-4" />
            CSV出力
          </button>
          <label class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
            <Upload class="w-4 h-4" />
            CSV入力
            <input type="file" accept=".csv" class="hidden" @change="onCsvFileChange" />
          </label>
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
        <div class="flex flex-wrap items-center gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <Filter class="w-4 h-4 text-gray-400" />
              <details class="relative">
                <summary class="list-none px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer bg-white">
                  氏名: {{ selectedNames.length ? `${selectedNames.length}件` : 'すべて' }}
                </summary>
                <div class="absolute z-20 mt-1 w-64 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow">
                  <div class="p-2 border-b border-gray-100">
                    <input
                      v-model="nameSearch"
                      type="text"
                      placeholder="氏名で検索..."
                      class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label v-for="n in filteredNames" :key="n" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" :value="n" v-model="selectedNames" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>{{ n }}</span>
                  </label>
                  <div v-if="filteredNames.length === 0" class="px-3 py-2 text-xs text-gray-400">
                    該当する氏名がありません
                  </div>
                </div>
              </details>
              <details class="relative">
                <summary class="list-none px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer bg-white">
                  大学: {{ selectedUniversities.length ? `${selectedUniversities.length}件` : 'すべて' }}
                </summary>
                <div class="absolute z-20 mt-1 w-72 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow">
                  <div class="p-2 border-b border-gray-100">
                    <input
                      v-model="universitySearch"
                      type="text"
                      placeholder="大学名で検索..."
                      class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label v-for="u in filteredUniversityOptions" :key="u" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" :value="u" v-model="selectedUniversities" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>{{ u }}</span>
                  </label>
                  <div v-if="filteredUniversityOptions.length === 0" class="px-3 py-2 text-xs text-gray-400">
                    該当する大学がありません
                  </div>
                </div>
              </details>
              <select
                v-if="user.role === 'admin'"
                v-model="staffFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">担当者: すべて</option>
                <option v-for="u in staffUsers" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
              </select>
              <select
                v-model="sourceCompanyFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">流入経路: すべて</option>
                <option v-for="v in sourceCompanyOptions" :key="v" :value="v">{{ v }}</option>
              </select>
              <select
                v-model="academicTrackFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">文理: すべて</option>
                <option value="文系">文系</option>
                <option value="理系">理系</option>
                <option value="">未設定</option>
              </select>
              <select
                v-model="referralStatusFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">ステータス: すべて</option>
                <option v-for="s in referralStatusOptions" :key="s" :value="s">{{ s }}</option>
              </select>
              <select
                v-model="graduationYearFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="g in graduationYearOptions" :key="g" :value="g">
                  {{ g === 'ALL' ? '卒業年度: すべて' : `${g}年` }}
                </option>
              </select>
              <select
                v-model="nextMeetingFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">次回面談: すべて</option>
                <option value="SET">設定あり</option>
                <option value="UNSET">未設定</option>
              </select>
              <div class="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg bg-white">
                <span class="text-xs text-gray-500 whitespace-nowrap">次回面談日</span>
                <input
                  v-model="nextMeetingFrom"
                  type="date"
                  class="px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-xs text-gray-400">〜</span>
                <input
                  v-model="nextMeetingTo"
                  type="date"
                  class="px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                v-model="taskDueFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">履行日: すべて</option>
                <option value="HAS">履行日あり</option>
                <option value="NO">履行日なし</option>
              </select>
              <div class="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg bg-white">
                <span class="text-xs text-gray-500 whitespace-nowrap">履行日</span>
                <input
                  v-model="taskDueFrom"
                  type="date"
                  class="px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-xs text-gray-400">〜</span>
                <input
                  v-model="taskDueTo"
                  type="date"
                  class="px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
        </div>
        <label v-if="user.role === 'admin'" class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" v-model="showAll" @change="fetchStudents" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          全学生を表示
        </label>
        <div class="flex justify-end">
          <button
            @click="clearFilters"
            class="px-3 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50"
          >
            フィルタクリア
          </button>
        </div>
      </div>

      <div class="md:hidden space-y-3">
        <div v-for="s in filteredStudents" :key="`mobile-${s.id}`" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ s.name }}</p>
              <p class="text-xs text-gray-500">{{ s.university || '-' }}</p>
            </div>
            <span class="text-xs text-gray-500">{{ s.graduation_year || '-' }}卒</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <p class="text-gray-400">流入経路</p>
              <p class="text-gray-700">{{ s.source_company || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">文理</p>
              <p class="text-gray-700">{{ s.academic_track || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">次回面談日</p>
              <p class="text-gray-700">{{ formatDate(s.next_meeting_date) }}</p>
            </div>
            <div>
              <p class="text-gray-400">タスク履行日</p>
              <p class="text-gray-700">{{ formatDate(s.latest_task_due_date) }}</p>
            </div>
          </div>
          <div class="space-y-2 mb-3">
            <label class="block text-xs text-gray-500">ステータス(打診)</label>
            <select
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.referral_status || '不明'"
              @change="updateStudentMeta(s.id, { referral_status: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="v in referralStatusOptions" :key="`mobile-ref-${s.id}-${v}`" :value="v">{{ v }}</option>
            </select>
            <label class="block text-xs text-gray-500">進捗</label>
            <select
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.progress_stage || '初回面談'"
              @change="updateStudentMeta(s.id, { progress_stage: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="v in progressStageOptions" :key="`mobile-prog-${s.id}-${v}`" :value="v">{{ v }}</option>
            </select>
            <label class="block text-xs text-gray-500">次回面談日</label>
            <input
              type="date"
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.next_meeting_date || ''"
              @change="updateStudentMeta(s.id, { next_meeting_date: ($event.target as HTMLInputElement).value || null })"
            />
            <label class="block text-xs text-gray-500">ネクストアクション</label>
            <input
              type="text"
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.next_action || ''"
              @blur="updateStudentMeta(s.id, { next_action: ($event.target as HTMLInputElement).value || null })"
              placeholder="次にやること"
            />
            <div v-if="user.role === 'admin'">
              <label class="block text-xs text-gray-500 mb-1">担当</label>
              <select
                :value="s.staff_id || ''"
                @change="updateStaff(s.id, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
                class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              >
                <option value="">未割当</option>
                <option v-for="u in staffUsers" :key="`mobile-staff-${s.id}-${u.id}`" :value="u.id">{{ u.name }}</option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <button
              class="text-blue-600 hover:text-blue-800 text-sm font-semibold inline-flex items-center gap-1"
              @click="router.push(`/students/${s.id}`)"
            >
              詳細
              <ChevronRight class="w-4 h-4" />
            </button>
            <button
              v-if="user.role === 'admin'"
              class="text-gray-400 hover:text-red-600 inline-flex items-center"
              @click="deleteStudent(s.id)"
              title="削除"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div v-if="filteredStudents.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          該当する学生が見つかりませんでした。
        </div>
      </div>

      <div class="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table class="w-full min-w-[1100px]">
          <thead class="bg-gray-50 border-b border-gray-200 text-xs">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">流入経路</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">氏名</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">大学</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">文理</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">卒業年度</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">担当</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">次回面談日</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">タスク履行日</th>
              <th class="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="s in filteredStudents" :key="s.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{{ s.source_company || '-' }}</td>
              <td class="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{{ s.name }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{{ s.university }}</td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{{ s.academic_track || '-' }}</td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{{ s.graduation_year || '-' }}</td>
              <td class="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
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
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                <select
                  class="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs"
                  :value="s.referral_status || '不明'"
                  @change="updateStudentMeta(s.id, { referral_status: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="v in referralStatusOptions" :key="v" :value="v">{{ v }}</option>
                </select>
              </td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{{ formatDate(s.next_meeting_date) }}</td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{{ formatDate(s.latest_task_due_date) }}</td>
              <td class="px-6 py-3 text-right text-xs whitespace-nowrap">
                <button
                  class="text-blue-600 hover:text-blue-800 text-sm font-semibold inline-flex items-center gap-1"
                  @click="router.push(`/students/${s.id}`)"
                >
                  詳細
                  <ChevronRight class="w-4 h-4" />
                </button>
                <button
                  v-if="user.role === 'admin'"
                  class="ml-3 text-gray-400 hover:text-red-600 inline-flex items-center"
                  @click="deleteStudent(s.id)"
                  title="削除"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="filteredStudents.length === 0">
              <td colSpan="10" class="px-6 py-10 text-center text-sm text-gray-400">
                該当する学生が見つかりませんでした。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]">
        <div class="bg-white rounded-xl shadow-xl w-[80vw] max-w-4xl h-[80vh] overflow-y-auto p-6">
          <h2 class="text-xl font-bold mb-4 text-gray-900">新規学生登録</h2>
          <div class="space-y-4">
            <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">流入経路</label>
            <input v-model="newStudent.source_company" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">氏名</label>
            <input v-model="newStudent.name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">大学</label>
            <input v-model="newStudent.university" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">文理</label>
            <select v-model="newStudent.academic_track" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">未設定</option>
              <option value="文系">文系</option>
              <option value="理系">理系</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">学部</label>
            <input v-model="newStudent.faculty" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select v-model="newStudent.referral_status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option v-for="v in referralStatusOptions" :key="v" :value="v">{{ v }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">進捗</label>
            <select v-model="newStudent.progress_stage" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option v-for="v in progressStageOptions" :key="v" :value="v">{{ v }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">次回面談日</label>
            <input v-model="newStudent.next_meeting_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ネクストアクション</label>
            <input v-model="newStudent.next_action" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="次にやること">
          </div>
            <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">面談理由</label>
            <select v-model="newStudent.interview_reason" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">未設定</option>
              <option value="就活相談">就活相談</option>
              <option value="企業分析">企業分析</option>
            </select>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">選考ステータス</label>
            <select v-model="newStudent.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="キーマン">キーマン</option>
              <option value="出そう">出そう</option>
              <option value="ほぼ無理ワンチャン">ほぼ無理ワンチャン</option>
              <option value="無理">無理</option>
              <option value="不明">不明</option>
            </select>
          </div>
          <div v-if="user.role === 'admin'">
            <label class="block text-sm font-medium text-gray-700 mb-1">担当</label>
            <select v-model="newStudent.staff_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">未割当</option>
              <option v-for="u in staffUsers" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
            </select>
          </div>
        </div>
          <div class="mt-6 flex justify-end gap-3">
            <button @click="showCreate = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
            <button @click="createStudent" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
          </div>
        </div>
      </div>
    </teleport>
  </Layout>
</template>
