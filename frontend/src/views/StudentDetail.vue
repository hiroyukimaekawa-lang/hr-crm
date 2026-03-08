<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { api } from '../lib/api';
import Layout from '../components/Layout.vue';
import { getPinnedStudent, setPinnedStudent, clearPinnedStudent } from '../lib/pinnedStudent';
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
const interviewSchedules = ref<any[]>([]);
const matcherFunnel = ref<any | null>(null);
const matcherForm = ref({
  applied_at: '',
  message_sent_at: '',
  reservation_created_at: '',
  reservation_status: 'reserved',
  interview_scheduled_at: '',
  interview_actual_at: '',
  interview_status: 'completed'
});
const proposalEvents = ref<any[]>([]);
const proposalLostReasons = ref<any[]>([]);
const eventProposals = ref<any[]>([]);
const proposalForm = ref({
  event_id: '',
  selected_event_date: '',
  status: 'proposed',
  lost_reason_id: '',
  memo: ''
});
const expandedLogId = ref<number | null>(null);
const availableEvents = ref<any[]>([]);
const newTaskDate = ref('');
const newTaskContent = ref('');
const newScheduleDate = ref('');
const newScheduleType = ref<'流入日' | '面談' | 'リスケ'>('面談');

const newLog = ref('');
const newLogType = ref<'面談' | 'エントリー' | 'その他'>('面談');
const newLogEventId = ref('');
const selectedEventId = ref('');
const selectedEventDate = ref('');
const selectedEventStatus = ref<'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL'>('A_ENTRY');
const editingStatus = ref(false);
const referralStatusDraft = ref('不明');
const progressStageDraft = ref('面談調整中');
const progressStageOptions = ['面談調整中', '初回面談', '2回目面談', '顧客化', 'トビ'];
const editingBasic = ref(false);
const basicSaving = ref(false);
const basicSaveMessage = ref('');
const basicSaveError = ref('');
const basicDraft = ref({
  name: '',
  university: '',
  prefecture: '',
  academic_track: '',
  faculty: '',
  desired_industry: '',
  desired_role: '',
  graduation_year: '',
  email: '',
  phone: '',
  source_company: '',
  interview_reason: '',
  meeting_decided_date: '',
  first_interview_date: '',
  second_interview_date: '',
  next_meeting_date: '',
  next_action: ''
});

const draftStorageKey = computed(() => `student-detail-draft:${String(studentId)}`);

const restoreDraft = () => {
  try {
    const raw = sessionStorage.getItem(draftStorageKey.value);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.newTaskDate !== undefined) newTaskDate.value = d.newTaskDate || '';
    if (d.newTaskContent !== undefined) newTaskContent.value = d.newTaskContent || '';
    if (d.newScheduleDate !== undefined) newScheduleDate.value = d.newScheduleDate || '';
    if (d.newScheduleType !== undefined) newScheduleType.value = d.newScheduleType || '面談';
    if (d.newLog !== undefined) newLog.value = d.newLog || '';
    if (d.newLogType !== undefined) newLogType.value = d.newLogType || '面談';
    if (d.newLogEventId !== undefined) newLogEventId.value = d.newLogEventId || '';
    if (d.selectedEventId !== undefined) selectedEventId.value = d.selectedEventId || '';
    if (d.selectedEventDate !== undefined) selectedEventDate.value = d.selectedEventDate || '';
    if (d.selectedEventStatus !== undefined) selectedEventStatus.value = d.selectedEventStatus || 'A_ENTRY';
    if (d.editingStatus !== undefined) editingStatus.value = !!d.editingStatus;
    if (d.referralStatusDraft !== undefined) referralStatusDraft.value = d.referralStatusDraft || '不明';
    if (d.progressStageDraft !== undefined) progressStageDraft.value = d.progressStageDraft || '面談調整中';
    if (d.editingBasic !== undefined) editingBasic.value = !!d.editingBasic;
    if (d.basicDraft && typeof d.basicDraft === 'object') {
      basicDraft.value = {
        ...basicDraft.value,
        ...d.basicDraft
      };
    }
  } catch (e) {
    console.error('draft restore failed', e);
  }
};

const persistDraft = () => {
  try {
    sessionStorage.setItem(draftStorageKey.value, JSON.stringify({
      newTaskDate: newTaskDate.value,
      newTaskContent: newTaskContent.value,
      newScheduleDate: newScheduleDate.value,
      newScheduleType: newScheduleType.value,
      newLog: newLog.value,
      newLogType: newLogType.value,
      newLogEventId: newLogEventId.value,
      selectedEventId: selectedEventId.value,
      selectedEventDate: selectedEventDate.value,
      selectedEventStatus: selectedEventStatus.value,
      editingStatus: editingStatus.value,
      referralStatusDraft: referralStatusDraft.value,
      progressStageDraft: progressStageDraft.value,
      editingBasic: editingBasic.value,
      basicDraft: basicDraft.value
    }));
  } catch (e) {
    console.error('draft persist failed', e);
  }
};

const clearDraft = () => {
  sessionStorage.removeItem(draftStorageKey.value);
};

const resetBasicDraft = () => {
  basicDraft.value = {
    name: student.value?.name || '',
    university: student.value?.university || '',
    prefecture: student.value?.prefecture || '',
    academic_track: student.value?.academic_track || '',
    faculty: student.value?.faculty || '',
    desired_industry: student.value?.desired_industry || '',
    desired_role: student.value?.desired_role || '',
    graduation_year: student.value?.graduation_year ? String(student.value.graduation_year) : '',
    email: student.value?.email || '',
    phone: student.value?.phone || '',
    source_company: student.value?.source_company || '',
    interview_reason: student.value?.interview_reason || '',
    meeting_decided_date: student.value?.meeting_decided_date || '',
    first_interview_date: student.value?.first_interview_date || '',
    second_interview_date: student.value?.second_interview_date || '',
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
  interviewSchedules.value = res.data.schedules || [];
  matcherFunnel.value = res.data.matcher_funnel || null;
  matcherForm.value = {
    applied_at: toDateTimeLocalHour(res.data.matcher_funnel?.applied_at || student.value?.created_at),
    message_sent_at: toDateTimeLocalHour(res.data.matcher_funnel?.message_sent_at),
    reservation_created_at: toDateTimeLocalHour(res.data.matcher_funnel?.reservation_created_at || student.value?.meeting_decided_date),
    reservation_status: res.data.matcher_funnel?.reservation_status || 'reserved',
    interview_scheduled_at: toDateTimeLocalHour(res.data.matcher_funnel?.interview_scheduled_at || student.value?.first_interview_date),
    interview_actual_at: toDateTimeLocalHour(res.data.matcher_funnel?.interview_actual_at),
    interview_status: res.data.matcher_funnel?.interview_status || 'completed'
  };
  referralStatusDraft.value = student.value?.referral_status || '不明';
  progressStageDraft.value = student.value?.progress_stage || '面談調整中';
  resetBasicDraft();
};

const toDateTimeLocalHour = (value?: string | null) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T10:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:00`;
};

const normalizeHourDateTime = (value?: string | null) => {
  if (!value) return null;
  const v = toDateTimeLocalHour(value);
  return v || null;
};
const forceHourOnly = (value?: string | null) => toDateTimeLocalHour(value);

const registerMatcherApply = async () => {
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/matcher-funnel/apply`, {
    applied_at: normalizeHourDateTime(matcherForm.value.applied_at)
  }, { headers: { Authorization: token } });
  fetchDetail();
};

const registerMatcherMessage = async () => {
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/matcher-funnel/message`, {
    message_sent_at: normalizeHourDateTime(matcherForm.value.message_sent_at)
  }, { headers: { Authorization: token } });
  fetchDetail();
};

const registerMatcherReservation = async () => {
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/matcher-funnel/reservation`, {
    reservation_created_at: normalizeHourDateTime(matcherForm.value.reservation_created_at),
    reservation_status: matcherForm.value.reservation_status || 'reserved',
    interview_scheduled_at: normalizeHourDateTime(matcherForm.value.interview_scheduled_at)
  }, { headers: { Authorization: token } });
  fetchDetail();
};

const registerMatcherInterview = async () => {
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/matcher-funnel/interview`, {
    interview_actual_at: normalizeHourDateTime(matcherForm.value.interview_actual_at),
    interview_status: matcherForm.value.interview_status || 'completed',
    interview_scheduled_at: normalizeHourDateTime(matcherForm.value.interview_scheduled_at)
  }, { headers: { Authorization: token } });
  fetchDetail();
};

const fetchAllEvents = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/events', { headers: { Authorization: token } });
  availableEvents.value = res.data;
};

const fetchProposalMaster = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/funnel/master', { headers: { Authorization: token } });
  proposalEvents.value = Array.isArray(res.data?.events) ? res.data.events : [];
  proposalLostReasons.value = Array.isArray(res.data?.lost_reasons) ? res.data.lost_reasons : [];
};

const fetchEventProposals = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/students/${studentId}/funnel/event-proposals`, { headers: { Authorization: token } });
  eventProposals.value = Array.isArray(res.data) ? res.data : [];
};

const submitEventProposal = async () => {
  if (!proposalForm.value.event_id) return;
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/funnel/event-proposal`, {
    event_id: Number(proposalForm.value.event_id),
    selected_event_date: proposalForm.value.selected_event_date || null,
    status: proposalForm.value.status || 'proposed',
    lost_reason_id: proposalForm.value.lost_reason_id ? Number(proposalForm.value.lost_reason_id) : null,
    memo: proposalForm.value.memo || null
  }, { headers: { Authorization: token } });
  proposalForm.value = {
    event_id: '',
    selected_event_date: '',
    status: 'proposed',
    lost_reason_id: '',
    memo: ''
  };
  await fetchEventProposals();
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
  persistDraft();
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
  persistDraft();
  fetchDetail();
};

const addInterviewSchedule = async () => {
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/interview-schedules`, {
    scheduled_at: newScheduleDate.value || null,
    schedule_type: newScheduleType.value,
    status: newScheduleType.value === 'リスケ' ? 'rescheduled' : 'scheduled'
  }, { headers: { Authorization: token } });
  newScheduleDate.value = '';
  newScheduleType.value = '面談';
  persistDraft();
  fetchDetail();
};

const updateInterviewSchedule = async (scheduleId: number, payload: { scheduled_at?: string | null; actual_at?: string | null; status?: string; schedule_type?: '流入日' | '面談' | 'リスケ' }) => {
  const token = localStorage.getItem('token');
  await api.put(`/api/students/interview-schedules/${scheduleId}`, payload, { headers: { Authorization: token } });
  fetchDetail();
};

const deleteInterviewSchedule = async (scheduleId: number) => {
  if (!confirm('この面談予定を削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/interview-schedules/${scheduleId}`, { headers: { Authorization: token } });
  fetchDetail();
};

const deleteTask = async (taskId: number) => {
  if (!confirm('このタスクを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/tasks/${taskId}`, { headers: { Authorization: token } });
  fetchDetail();
};

const completeTask = async (taskId: number) => {
  const token = localStorage.getItem('token');
  await api.put(`/api/students/tasks/${taskId}/complete`, {}, { headers: { Authorization: token } });
  fetchDetail();
};

const linkEvent = async () => {
  if (!selectedEventId.value) return;
  const token = localStorage.getItem('token');
  await api.post(`/api/students/${studentId}/events`, {
    event_id: selectedEventId.value,
    selected_event_date: selectedEventDate.value || null,
    status: selectedEventStatus.value
  }, { headers: { Authorization: token } });
  selectedEventId.value = '';
  selectedEventDate.value = '';
  selectedEventStatus.value = 'A_ENTRY';
  persistDraft();
  fetchDetail();
};

const updateEventParticipationStatus = async (eventId: number, status: 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL') => {
  const token = localStorage.getItem('token');
  await api.put(`/api/events/${eventId}/participants/${studentId}`, { status }, { headers: { Authorization: token } });
  fetchDetail();
};

const updateEventParticipationDate = async (eventId: number, currentStatus: string, date: string) => {
  const token = localStorage.getItem('token');
  await api.put(
    `/api/events/${eventId}/participants/${studentId}`,
    { status: currentStatus || 'A_ENTRY', selected_event_date: date || null },
    { headers: { Authorization: token } }
  );
  fetchDetail();
};

const selectedLinkEvent = computed(() => {
  const id = Number(selectedEventId.value || 0);
  if (!id) return null;
  return availableEvents.value.find((e: any) => Number(e.id) === id) || null;
});

const selectedLinkEventDates = computed(() => {
  const e: any = selectedLinkEvent.value;
  if (!e) return [] as string[];
  const dates = Array.isArray(e.event_dates)
    ? e.event_dates.filter((d: any) => !!d).map((d: any) => String(d))
    : [];
  if (dates.length > 0) return dates;
  if (e.event_date) return [String(e.event_date)];
  return [] as string[];
});

const eventDateOptions = (event: any) => {
  const dates = Array.isArray(event?.event_dates)
    ? event.event_dates.filter((d: any) => !!d).map((d: any) => String(d))
    : [];
  if (dates.length > 0) return dates;
  if (event?.event_date) return [String(event.event_date)];
  return [] as string[];
};

const participationStatusClass = (status?: string) => {
  switch (status) {
    case 'A_ENTRY':
    case 'registered':
      return 'bg-blue-100 text-blue-700';
    case 'B_WAITING':
      return 'bg-amber-100 text-amber-700';
    case 'C_WAITING':
      return 'bg-purple-100 text-purple-700';
    case 'XA_CANCEL':
    case 'canceled':
      return 'bg-red-100 text-red-700';
    case 'attended':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const participationStatusLabel = (status?: string) => {
  switch (status) {
    case 'A_ENTRY':
    case 'registered':
      return 'A:エントリー';
    case 'B_WAITING':
      return 'B:回答待ち';
    case 'C_WAITING':
      return 'C:回答待ち';
    case 'XA_CANCEL':
    case 'canceled':
      return 'XA:エントリーキャンセル';
    case 'attended':
      return '出席';
    default:
      return '未設定';
  }
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
  try {
    basicSaving.value = true;
    basicSaveError.value = '';
    basicSaveMessage.value = '';
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId}`, {
      ...basicDraft.value,
      graduation_year: basicDraft.value.graduation_year ? Number(basicDraft.value.graduation_year) : null,
      meeting_decided_date: basicDraft.value.meeting_decided_date || null,
      first_interview_date: basicDraft.value.first_interview_date || null,
      second_interview_date: basicDraft.value.second_interview_date || null,
      next_meeting_date: basicDraft.value.next_meeting_date || null,
      next_action: basicDraft.value.next_action || null
    }, { headers: { Authorization: token } });
    basicSaveMessage.value = '基本情報を保存しました。';
    await fetchDetail();
    editingBasic.value = false;
  } catch (err: any) {
    basicSaveError.value = err?.response?.data?.error || '保存に失敗しました。入力内容を確認してください。';
  } finally {
    basicSaving.value = false;
  }
};

const startEditBasic = () => {
  resetBasicDraft();
  basicSaveError.value = '';
  basicSaveMessage.value = '';
  editingBasic.value = true;
};

const cancelEditBasic = () => {
  resetBasicDraft();
  basicSaveError.value = '';
  basicSaveMessage.value = '';
  editingBasic.value = false;
  persistDraft();
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

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ja-JP');
};

const tags = computed(() => Array.isArray(student.value?.tags) ? student.value.tags : []);
const selectedProposalEvent = computed(() => {
  const id = Number(proposalForm.value.event_id || 0);
  if (!id) return null;
  return proposalEvents.value.find((e: any) => Number(e.id) === id) || null;
});
const selectedProposalEventDates = computed(() => {
  const e: any = selectedProposalEvent.value;
  if (!e) return [] as string[];
  const dates = Array.isArray(e.event_dates)
    ? e.event_dates.filter((d: any) => !!d).map((d: any) => String(d))
    : [];
  if (dates.length > 0) return dates;
  if (e.event_date) return [String(e.event_date)];
  return [] as string[];
});
const isPinned = computed(() => getPinnedStudent()?.id === Number(studentId));

const pinCurrentStudent = () => {
  if (!student.value?.id) return;
  setPinnedStudent({ id: Number(student.value.id), name: String(student.value.name || '') });
};

const unpinCurrentStudent = () => {
  if (getPinnedStudent()?.id === Number(studentId)) {
    clearPinnedStudent();
  }
};

const hasUnsavedDraft = computed(() => {
  return Boolean(
    newLog.value.trim()
    || newTaskContent.value.trim()
    || newTaskDate.value
    || newScheduleDate.value
    || editingBasic.value
  );
});

const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (!hasUnsavedDraft.value) return;
  e.preventDefault();
  e.returnValue = '';
};

onMounted(() => {
  fetchDetail().then(restoreDraft);
  fetchAllEvents();
  fetchProposalMaster();
  fetchEventProposals();
  window.addEventListener('beforeunload', onBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload);
});

onBeforeRouteLeave((_to, _from, next) => {
  persistDraft();
  next();
});

watch(() => proposalForm.value.event_id, () => {
  const dates = selectedProposalEventDates.value;
  if (dates.length === 0) {
    proposalForm.value.selected_event_date = '';
    return;
  }
  if (!proposalForm.value.selected_event_date || !dates.includes(proposalForm.value.selected_event_date)) {
    proposalForm.value.selected_event_date = dates[0] || '';
  }
});

watch(
  [
    newTaskDate,
    newTaskContent,
    newScheduleDate,
    newScheduleType,
    newLog,
    newLogType,
    newLogEventId,
    selectedEventId,
    selectedEventDate,
    selectedEventStatus,
    editingStatus,
    referralStatusDraft,
    progressStageDraft,
    editingBasic,
    basicDraft
  ],
  () => {
    persistDraft();
  },
  { deep: true }
);

watch(selectedEventId, () => {
  const list = selectedLinkEventDates.value;
  if (list.length === 0) {
    selectedEventDate.value = '';
    return;
  }
  if (!selectedEventDate.value || !list.includes(selectedEventDate.value)) {
    selectedEventDate.value = list[0] || '';
  }
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="mb-8 flex items-center gap-4">
        <button @click="router.push('/students')" class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowLeft class="w-6 h-6" />
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ student.name }}</h1>
          <p class="text-gray-500">学生詳細情報・面談履歴</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            v-if="!isPinned"
            class="px-3 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50"
            @click="pinCurrentStudent"
          >
            この学生を固定表示
          </button>
          <button
            v-else
            class="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            @click="unpinCurrentStudent"
          >
            固定を解除
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
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
                  <p class="text-xs text-gray-500">流入経路</p>
                  <p class="text-sm font-medium">{{ student.source_company || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">大学</p>
                  <p class="text-sm font-medium">{{ student.university || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">所在地（都道府県）</p>
                  <p class="text-sm font-medium">{{ student.prefecture || '-' }}</p>
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
                <MessageSquare class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">面談理由</p>
                  <p class="text-sm font-medium">{{ student.interview_reason || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">卒業年度</p>
                  <p class="text-sm font-medium">{{ student.graduation_year || '-' }}</p>
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
                  <p class="text-xs text-gray-500">面談決定日</p>
                  <p class="text-sm font-medium">{{ student.meeting_decided_date || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">初回面談日</p>
                  <p class="text-sm font-medium">{{ student.first_interview_date || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">2回目面談日</p>
                  <p class="text-sm font-medium">{{ student.second_interview_date || '-' }}</p>
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
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">選考ステータス</p>
                  <p class="text-sm font-medium">{{ student.status || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">担当ID</p>
                  <p class="text-sm font-medium">{{ student.staff_id || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">登録日時</p>
                  <p class="text-sm font-medium">{{ formatDateTime(student.created_at) }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-xs text-gray-500">更新日時</p>
                  <p class="text-sm font-medium">{{ formatDateTime(student.updated_at) }}</p>
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
                <div class="flex items-center gap-2">
                  <label class="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" @change="completeTask(t.id)" />
                    完了
                  </label>
                  <button class="text-gray-400 hover:text-red-600" @click="deleteTask(t.id)">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
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
            <h2 class="text-lg font-bold text-gray-900 mb-4">面談スケジュール</h2>
            <div class="space-y-2 mb-4">
              <div v-for="sc in interviewSchedules" :key="sc.id" class="rounded-lg border border-gray-200 p-3">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="text-sm font-semibold text-gray-900">第{{ sc.round_no }}回</div>
                  <button class="text-gray-400 hover:text-red-600" @click="deleteInterviewSchedule(sc.id)">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="date"
                    :value="sc.scheduled_at ? new Date(sc.scheduled_at).toISOString().slice(0,10) : ''"
                    @change="updateInterviewSchedule(sc.id, { scheduled_at: ($event.target as HTMLInputElement).value || null })"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    :value="sc.schedule_type || '面談'"
                    @change="updateInterviewSchedule(sc.id, { schedule_type: ($event.target as HTMLSelectElement).value as '流入日' | '面談' | 'リスケ' })"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="流入日">流入日</option>
                    <option value="面談">面談</option>
                    <option value="リスケ">リスケ</option>
                  </select>
                </div>
                <p class="text-xs text-gray-500 mt-2">リスケ回数: {{ sc.reschedule_count || 0 }}</p>
              </div>
              <p v-if="interviewSchedules.length === 0" class="text-sm text-gray-400">面談予定はまだありません</p>
            </div>
            <div class="pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
              <input v-model="newScheduleDate" type="date" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <select v-model="newScheduleType" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="流入日">流入日</option>
                <option value="面談">面談</option>
                <option value="リスケ">リスケ</option>
              </select>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" @click="addInterviewSchedule">
                追加
              </button>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">Matcher面談ファネル</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="border border-gray-200 rounded-lg p-3">
                <p class="text-sm font-semibold mb-2">1) 申込</p>
                <input v-model="matcherForm.applied_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" @change="matcherForm.applied_at = forceHourOnly(matcherForm.applied_at)" />
                <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="registerMatcherApply">申込登録</button>
              </div>
              <div class="border border-gray-200 rounded-lg p-3">
                <p class="text-sm font-semibold mb-2">2) メッセージ送信</p>
                <input v-model="matcherForm.message_sent_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" @change="matcherForm.message_sent_at = forceHourOnly(matcherForm.message_sent_at)" />
                <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="registerMatcherMessage">メッセージ送信登録</button>
              </div>
              <div class="border border-gray-200 rounded-lg p-3">
                <p class="text-sm font-semibold mb-2">3) 予約</p>
                <input v-model="matcherForm.reservation_created_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" @change="matcherForm.reservation_created_at = forceHourOnly(matcherForm.reservation_created_at)" />
                <select v-model="matcherForm.reservation_status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2">
                  <option value="pending">pending</option>
                  <option value="reserved">reserved</option>
                  <option value="cancel">cancel</option>
                  <option value="no_response">no_response</option>
                </select>
                <input v-model="matcherForm.interview_scheduled_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" @change="matcherForm.interview_scheduled_at = forceHourOnly(matcherForm.interview_scheduled_at)" />
                <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="registerMatcherReservation">予約登録</button>
              </div>
              <div class="border border-gray-200 rounded-lg p-3">
                <p class="text-sm font-semibold mb-2">4) 面談実施</p>
                <input v-model="matcherForm.interview_actual_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" @change="matcherForm.interview_actual_at = forceHourOnly(matcherForm.interview_actual_at)" />
                <select v-model="matcherForm.interview_status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2">
                  <option value="scheduled">scheduled</option>
                  <option value="completed">completed</option>
                  <option value="no_show">no_show</option>
                  <option value="rescheduled">rescheduled</option>
                  <option value="cancel">cancel</option>
                </select>
                <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="registerMatcherInterview">面談実施登録</button>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">イベント提案管理（複数登録）</h2>
            <div class="space-y-2 mb-4">
              <div v-for="p in eventProposals" :key="`proposal-${p.id}`" class="rounded-lg border border-gray-200 p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-gray-900">{{ p.event_name || '-' }}</span>
                  <span class="text-xs text-gray-500">{{ formatDateTime(p.proposed_at) }}</span>
                  <span v-if="p.selected_event_date" class="text-xs text-blue-600">参加日: {{ formatDateTime(p.selected_event_date) }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{{ p.status || '-' }}</span>
                  <span v-if="p.lost_reason_name" class="text-xs text-red-600">失注理由: {{ p.lost_reason_name }}</span>
                </div>
                <p v-if="p.memo" class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{{ p.memo }}</p>
              </div>
              <p v-if="eventProposals.length === 0" class="text-sm text-gray-400">提案履歴はまだありません</p>
            </div>
            <div class="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2">
              <select v-model="proposalForm.event_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">イベントを選択</option>
                <option v-for="e in proposalEvents" :key="`proposal-event-${e.id}`" :value="String(e.id)">
                  {{ e.event_name || e.title }}（{{ e.event_date ? formatDateTime(e.event_date) : '-' }}）
                </option>
              </select>
              <select v-model="proposalForm.selected_event_date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" :disabled="!proposalForm.event_id">
                <option value="">参加日程を選択</option>
                <option v-for="d in selectedProposalEventDates" :key="`proposal-date-${d}`" :value="d">{{ formatDateTime(d) }}</option>
              </select>
              <select v-model="proposalForm.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="proposed">提案済み</option>
                <option value="joined">参加</option>
                <option value="lost">失注</option>
              </select>
              <select v-model="proposalForm.lost_reason_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">失注理由（任意）</option>
                <option v-for="r in proposalLostReasons" :key="`proposal-lost-${r.id}`" :value="String(r.id)">{{ r.reason_name }}</option>
              </select>
              <input v-model="proposalForm.memo" type="text" placeholder="メモ（任意）" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button class="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" @click="submitEventProposal">
              イベント提案を追加
            </button>
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
                  <p class="text-xs text-gray-500">{{ e.selected_event_date ? formatDateTime(e.selected_event_date) : formatDateTime(e.event_date) }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <select
                    v-if="eventDateOptions(e).length > 1"
                    class="px-2 py-1 border border-gray-300 rounded-md text-xs bg-white max-w-[180px]"
                    :value="e.selected_event_date || ''"
                    @change="updateEventParticipationDate(e.id, e.participation_status, ($event.target as HTMLSelectElement).value)"
                  >
                    <option disabled value="">参加日を選択</option>
                    <option v-for="d in eventDateOptions(e)" :key="`student-event-date-${e.id}-${d}`" :value="d">
                      {{ formatDateTime(d) }}
                    </option>
                  </select>
                  <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="participationStatusClass(e.participation_status)">
                    {{ participationStatusLabel(e.participation_status) }}
                  </span>
                  <select
                    class="px-2 py-1 border border-gray-300 rounded-md text-xs bg-white"
                    :value="e.participation_status === 'registered' ? 'A_ENTRY' : (e.participation_status || 'A_ENTRY')"
                    @change="updateEventParticipationStatus(e.id, ($event.target as HTMLSelectElement).value as 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'XA_CANCEL')"
                  >
                    <option value="A_ENTRY">A:エントリー</option>
                    <option value="B_WAITING">B:回答待ち</option>
                    <option value="C_WAITING">C:回答待ち</option>
                    <option value="XA_CANCEL">XA:エントリーキャンセル</option>
                  </select>
                </div>
              </div>
              <div v-if="studentEvents.length === 0" class="text-sm text-gray-400 text-center py-4">
                イベントへの参加はありません
              </div>
            </div>

            <div class="pt-4 border-t border-gray-100">
              <label class="block text-xs font-medium text-gray-500 mb-2">イベントに紐付ける</label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select v-model="selectedEventId" class="sm:col-span-6 w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option disabled value="">選択してください</option>
                  <option v-for="ae in availableEvents" :key="ae.id" :value="ae.id">{{ ae.title }}</option>
                </select>
                <select
                  v-if="selectedLinkEventDates.length > 1"
                  v-model="selectedEventDate"
                  class="sm:col-span-6 w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option v-for="d in selectedLinkEventDates" :key="`add-link-date-${d}`" :value="d">{{ formatDateTime(d) }}</option>
                </select>
                <select v-model="selectedEventStatus" class="sm:col-span-4 w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="A_ENTRY">A:エントリー</option>
                  <option value="B_WAITING">B:回答待ち</option>
                  <option value="C_WAITING">C:回答待ち</option>
                  <option value="XA_CANCEL">XA:エントリーキャンセル（誤登録時）</option>
                </select>
                <button @click="linkEvent" class="sm:col-span-2 w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">追加</button>
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
          <p v-if="basicSaveError" class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ basicSaveError }}
          </p>
          <p v-if="basicSaveMessage" class="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {{ basicSaveMessage }}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input v-model="basicDraft.name" type="text" placeholder="氏名" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.university" type="text" placeholder="大学" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.prefecture" type="text" placeholder="所在地（都道府県）" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
              <option value="企業相談">企業相談</option>
              <option value="面接対策">面接対策</option>
            </select>
            <input v-model="basicDraft.meeting_decided_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.first_interview_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.second_interview_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.desired_industry" type="text" placeholder="志望業界" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.desired_role" type="text" placeholder="志望職種" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.next_meeting_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="basicDraft.next_action" type="text" placeholder="ネクストアクション" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2" />
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" @click="cancelEditBasic">
              やめる
            </button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="basicSaving" @click="saveBasic">
              {{ basicSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </Layout>
</template>
