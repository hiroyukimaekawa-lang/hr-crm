<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import {
  ArrowLeft,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const studentId = route.params.id;
const student = ref<any>({});
const studentEvents = ref<any[]>([]);
const interviewLogs = ref<any[]>([]);
const tasks = ref<any[]>([]);
const expandedLogId = ref<number | null>(null);
const availableEvents = ref<any[]>([]);
const newTaskDate = ref('');
const newTaskContent = ref('');

const newLog = ref('');
const newLogType = ref<'面談' | 'エントリー' | 'その他'>('面談');
const newLogEventId = ref('');
const selectedEventId = ref('');
const editingStatus = ref(false);
const referralStatusDraft = ref('不明');
const progressStageDraft = ref('面談調整中');
const progressStageOptions = ['面談調整中', '初回面談', '2回目面談', '顧客化', 'トビ'];
const editingBasic = ref(false);
const basicDraft = ref({
  name: '',
  university: '',
  academic_track: '',
  faculty: '',
  desired_industry: '',
  desired_role: '',
  graduation_year: '',
  email: '',
  phone: '',
  source_company: '',
  interview_reason: '',
  next_meeting_date: '',
  next_action: ''
});

const resetBasicDraft = () => {
  basicDraft.value = {
    name: student.value?.name || '',
    university: student.value?.university || '',
    academic_track: student.value?.academic_track || '',
    faculty: student.value?.faculty || '',
    desired_industry: student.value?.desired_industry || '',
    desired_role: student.value?.desired_role || '',
    graduation_year: student.value?.graduation_year ? String(student.value.graduation_year) : '',
    email: student.value?.email || '',
    phone: student.value?.phone || '',
    source_company: student.value?.source_company || '',
    interview_reason: student.value?.interview_reason || '',
    next_meeting_date: student.value?.next_meeting_date || '',
    next_action: student.value?.next_action || ''
  };
};

const fetchDetail = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/students/${studentId}`, { headers: { Authorization: token } });
  student.value = res.data.student;
  studentEvents.value = res.data.events;
  interviewLogs.value = res.data.logs;
  tasks.value = res.data.tasks || [];
  referralStatusDraft.value = student.value?.referral_status || '不明';
  progressStageDraft.value = student.value?.progress_stage || '面談調整中';
  resetBasicDraft();
};

const fetchAllEvents = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/events', { headers: { Authorization: token } });
  availableEvents.value = res.data;
};

const addLog = async () => {
  if (!newLog.value) return;
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)"}');
  await api.post('/api/interview-logs', {
    student_id: studentId,
    staff_id: user.id,
    log_type: newLogType.value,
    event_id: newLogType.value === 'エントリー' ? newLogEventId.value : null,
    content: newLog.value,
    interview_date: new Date()
  }, { headers: { Authorization: token } });
  newLog.value = '';
  newLogEventId.value = '';
  newLogType.value = '面談';
  fetchDetail();
};

const deleteLog = async (logId: number) => {
  if (!confirm('このログを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/interview-logs/${logId}`, { headers: { Authorization: token } });
  fetchDetail();
};

const toggleLog = (logId: number) => {
  expandedLogId.value = expandedLogId.value === logId ? null : logId;
};

const addTask = async () => {
  if (!newTaskContent.value.trim()) return;
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/tasks`, {
    due_date: newTaskDate.value || null,
    content: newTaskContent.value
  }, { headers: { Authorization: token } });
  newTaskDate.value = '';
  newTaskContent.value = '';
  fetchDetail();
};

const deleteTask = async (taskId: number) => {
  if (!confirm('このタスクを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/tasks/${taskId}`, { headers: { Authorization: token } });
  fetchDetail();
};

const linkEvent = async () => {
  if (!selectedEventId.value) return;
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/events`, {
    event_id: selectedEventId.value
  }, { headers: { Authorization: token } });
  selectedEventId.value = '';
  fetchDetail();
};

const updateStatus = async () => {
  const token = localStorage.getItem('token');
  await api.put(`/api/students/${studentId}/meta`, {
    referral_status: referralStatusDraft.value,
    progress_stage: progressStageDraft.value
  }, { headers: { Authorization: token } });
  editingStatus.value = false;
  fetchDetail();
};

const saveBasic = async () => {
  const token = localStorage.getItem('token');
  await api.put(`/api/students/${studentId}`, {
    ...basicDraft.value,
    graduation_year: basicDraft.value.graduation_year ? Number(basicDraft.value.graduation_year) : null,
    next_meeting_date: basicDraft.value.next_meeting_date || null,
    next_action: basicDraft.value.next_action || null
  }, { headers: { Authorization: token } });
  editingBasic.value = false;
  fetchDetail();
};

const startEditBasic = () => {
  resetBasicDraft();
  editingBasic.value = true;
};

const cancelEditBasic = () => {
  resetBasicDraft();
  editingBasic.value = false;
};

const statusClass = (status?: string) => {
  switch (status) {
    case 'キーマン':
      return 'bg-green-100 text-green-700';
    case '出そう':
      return 'bg-blue-100 text-blue-700';
    case 'ほぼ無理ワンチャン':
      return 'bg-amber-100 text-amber-700';
    case '無理':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const tags = computed(() => Array.isArray(student.value?.tags) ? student.value.tags : []);

onMounted(() => {
  fetchDetail();
  fetchAllEvents();
});
</script>

<template>
  <Layout>
    <div class="p-8">
      <div class="mb-8 flex items-center gap-4">
        <button @click="router.push('/students')" class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowLeft class="w-6 h-6" />
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ student.name }}</h1>
          <p class="text-gray-500">学生詳細情報・面談履歴</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1 space-y-8">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold text-gray-900 mb-1">基本情報</h2>
                <p class="text-sm text-gray-500">{{ student.university }} / {{ student.graduation_year || '-' }}年卒</p>
              </div>
              <button class="text-gray-400 hover:text-gray-600" @click="editingStatus = !editingStatus">
                <Edit class="w-4 h-4" />
              </button>
            </div>
            <div class="mb-4">
              <button
                class="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
                @click="startEditBasic"
              >
                基本情報を編集
              </button>
            </div>

            <div class="flex items-center gap-2 mb-4">
              <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="statusClass(student.referral_status)">
                {{ student.referral_status || '不明' }}
              </span>
              <span class="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                進捗: {{ student.progress_stage || '面談調整中' }}
              </span>
              <div v-if="editingStatus" class="flex items-center gap-2">
                <select v-model="referralStatusDraft" class="px-2 py-1 border border-gray-300 rounded-md text-xs">
                  <option value="キーマン">キーマン</option>
                  <option value="出そう">出そう</option>
                  <option value="ほぼ無理ワンチャン">ほぼ無理ワンチャン</option>
                  <option value="無理">無理</option>
                  <option value="不明">不明</option>
                </select>
                <select v-model="progressStageDraft" class="px-2 py-1 border border-gray-300 rounded-md text-xs">
                  <option v-for="v in progressStageOptions" :key="`detail-progress-${v}`" :value="v">{{ v }}</option>
                </select>
                <button class="text-xs px-2 py-1 bg-blue-600 text-white rounded-md" @click="updateStatus">保存</button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">大学</p>
                  <p class="text-sm font-medium">{{ student.university }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">文理</p>
                  <p class="text-sm font-medium">{{ student.academic_track || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">学部</p>
                  <p class="text-sm font-medium">{{ student.faculty || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">志望業界</p>
                  <p class="text-sm font-medium">{{ student.desired_industry || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">志望職種</p>
                  <p class="text-sm font-medium">{{ student.desired_role || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Mail class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">メールアドレス</p>
                  <p class="text-sm font-medium">{{ student.email }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Phone class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">電話番号</p>
                  <p class="text-sm font-medium">{{ student.phone }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">次回面談日</p>
                  <p class="text-sm font-medium">{{ student.next_meeting_date || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0 sm:col-span-2">
                <MessageSquare class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">ネクストアクション</p>
                  <p class="text-sm font-medium">{{ student.next_action || '-' }}</p>
                </div>
              </div>
            </div>

            <div v-if="tags.length" class="mt-4 flex flex-wrap gap-2">
              <span v-for="tag in tags" :key="tag" class="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{{ tag }}</span>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">タスク</h2>
            <div class="space-y-2 mb-4">
              <div v-for="t in tasks" :key="t.id" class="flex items-start justify-between gap-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <p class="text-xs text-gray-500">{{ t.due_date || '履行日未設定' }}</p>
                  <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ t.content }}</p>
                </div>
                <button class="text-gray-400 hover:text-red-600" @click="deleteTask(t.id)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
              <p v-if="tasks.length === 0" class="text-sm text-gray-400">タスクはまだありません</p>
            </div>
            <div class="space-y-2">
              <label class="block text-xs text-gray-500">タスク履行日</label>
              <input v-model="newTaskDate" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <textarea v-model="newTaskContent" placeholder="やることを入力..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24"></textarea>
              <button class="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" @click="addTask">
                タスクを追加
              </button>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar class="w-5 h-5 text-blue-600" />
              参加・エントリーイベント
            </h2>
            <div class="space-y-3 mb-6">
              <div v-for="e in studentEvents" :key="e.id" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span class="text-sm font-medium text-gray-800">{{ e.title }}</span>
                  <p class="text-xs text-gray-500">{{ new Date(e.event_date).toLocaleDateString('ja-JP') }}</p>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="e.participation_status === 'attended' ? 'bg-green-100 text-green-700' : e.participation_status === 'registered' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  {{ e.participation_status === 'attended' ? '出席' : e.participation_status === 'registered' ? '申込' : 'キャンセル' }}
                </span>
              </div>
              <div v-if="studentEvents.length === 0" class="text-sm text-gray-400 text-center py-4">
                イベントへの参加はありません
              </div>
            </div>

            <div class="pt-4 border-t border-gray-100">
              <label class="block text-xs font-medium text-gray-500 mb-2">イベントに紐付ける</label>
              <div class="flex gap-2">
                <select v-model="selectedEventId" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option disabled value="">選択してください</option>
                  <option v-for="ae in availableEvents" :key="ae.id" :value="ae.id">{{ ae.title }}</option>
                </select>
                <button @click="linkEvent" class="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">追加</button>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[560px] lg:h-[600px] overflow-hidden">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare class="w-5 h-5 text-blue-600" />
                面談ログ・メモ
              </h2>
            </div>

            <div class="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
              <div v-for="log in interviewLogs" :key="log.id" class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col gap-2">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span class="font-semibold text-blue-600">
                        {{ log.log_type || '面談' }}
                        <span v-if="log.log_type === 'エントリー' && log.event_title" class="text-xs text-gray-500 ml-2">
                          ({{ log.event_title }})
                        </span>
                      </span>
                      <span class="text-gray-400">・</span>
                      <span>{{ new Date(log.interview_date).toLocaleDateString('ja-JP') }}</span>
                      <span v-if="log.staff_name" class="text-gray-400">・</span>
                      <span v-if="log.staff_name">{{ log.staff_name }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        class="text-gray-400 hover:text-gray-600"
                        @click="toggleLog(log.id)"
                        title="詳細"
                      >
                        <component :is="expandedLogId === log.id ? ChevronUp : ChevronDown" class="w-4 h-4" />
                      </button>
                      <button
                        class="text-gray-400 hover:text-red-600"
                        @click="deleteLog(log.id)"
                        title="削除"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div v-if="expandedLogId === log.id" class="text-sm text-gray-800 whitespace-pre-wrap">
                    {{ log.content }}
                  </div>
                </div>
              </div>
              <div v-if="interviewLogs.length === 0" class="text-center text-gray-400 py-10">
                記録がまだありません
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 bg-gray-50">
              <div class="flex flex-col sm:flex-row gap-2 mb-3">
                <select v-model="newLogType" class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="面談">面談</option>
                  <option value="エントリー">エントリー</option>
                  <option value="その他">その他</option>
                </select>
                <select
                  v-if="newLogType === 'エントリー'"
                  v-model="newLogEventId"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option disabled value="">エントリーしたイベントを選択</option>
                  <option v-for="ae in availableEvents" :key="ae.id" :value="ae.id">{{ ae.title }}</option>
                </select>
              </div>
              <textarea
                v-model="newLog"
                :placeholder="newLogType === '面談' ? '面談内容を入力...' : newLogType === 'エントリー' ? 'エントリー内容を入力...' : 'メモを入力...'"
                class="w-full p-4 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 mb-3 bg-white"
              ></textarea>
              <div class="flex justify-end">
                <button @click="addLog" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  <span>ログを追加</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div v-if="editingBasic" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[90]">
        <div class="bg-white rounded-xl shadow-xl w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">基本情報を編集</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input v-model="basicDraft.name" type="text" placeholder="氏名" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.university" type="text" placeholder="大学" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select v-model="basicDraft.academic_track" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">文理（未設定）</option>
              <option value="文系">文系</option>
              <option value="理系">理系</option>
            </select>
            <input v-model="basicDraft.faculty" type="text" placeholder="学部" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.graduation_year" type="number" placeholder="卒業年" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.email" type="email" placeholder="メールアドレス" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.phone" type="text" placeholder="電話番号" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.source_company" type="text" placeholder="流入経路" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select v-model="basicDraft.interview_reason" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">面談理由（未設定）</option>
              <option value="就活相談">就活相談</option>
              <option value="企業分析">企業分析</option>
            </select>
            <input v-model="basicDraft.desired_industry" type="text" placeholder="志望業界" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.desired_role" type="text" placeholder="志望職種" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.next_meeting_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.next_action" type="text" placeholder="ネクストアクション" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2" />
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" @click="cancelEditBasic">
              やめる
            </button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" @click="saveBasic">
              保存
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </Layout>
</template>
