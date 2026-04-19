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
  ChevronUp,
  Activity,
  TrendingUp,
  Coins,
  CheckCircle2,
  UserCheck
} from 'lucide-vue-next';
import StatusChangeModal from '../components/StatusChangeModal.vue'
import AgentSchedulePicker from '../components/AgentSchedulePicker.vue'
import { getStatusLabel, getStatusBadgeClass } from '../lib/statusConfig'

const route = useRoute();
const router = useRouter();
const studentId = computed(() => route.params.id);
const activeTab = ref('基本情報');
const student = ref<any>({});
const studentEvents = ref<any[]>([]);
const interviewLogs = ref<any[]>([]);
const tasks = ref<any[]>([]);
const interviewSchedules = ref<any[]>([]);
const matcherFunnel = ref<any | null>(null);
const showMatcherFunnel = ref(false);
const showEventOverviewPanel = ref(false);
const expandedOverviewEventId = ref<number | null>(null);
const matcherForm = ref({
  applied_at: '',
  reservation_created_at: '',
  interview_scheduled_at: '',
  interview_actual_at: '',
  interview_status: 'completed'
});
const hourOptions = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const newScheduleHour = ref('10:00');
const newTaskHour = ref('10:00');
const proposalEvents = ref<any[]>([]);
const proposalLostReasons = ref<any[]>([]);
const participationReasons = ['興味がある', '日程が合う', '友人と参加', '選考対策になる', 'その他'];
const eventProposals = ref<any[]>([]);
const proposalForm = ref({
  event_id: '',
  selected_event_date: '',
  status: 'proposed',
  reason: '',
  memo: ''
});
const expandedLogId = ref<number | null>(null);
const editingLogId = ref<number | null>(null);
const editingLogContent = ref('');
const savingLogId = ref<number | null>(null);
const availableEvents = ref<any[]>([]);
const newTaskDate = ref('');
const newTaskContent = ref('');
const newScheduleDate = ref('');
const newScheduleType = ref<'流入日' | '面談' | 'リスケ'>('面談');
const allStudents = ref<any[]>([]);

const statusModalOpen = ref(false)
const statusModalTarget = ref<any>(null)
const openStatusModal = (e: any) => {
  statusModalTarget.value = e
  statusModalOpen.value = true
}

const newLog = ref('');
const newLogType = ref<'面談' | 'エントリー' | 'その他'>('面談');
const newLogEventId = ref('');
const selectedEventId = ref('');
const selectedEventDate = ref('');
const agentScheduleDate = ref(''); // For agent-type events: YYYY-MM-DDTHH:00
const selectedEventStatus = ref<'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'D_PASS' | 'E_FAIL' | 'XA_CANCEL'>('A_ENTRY');
const editingStatus = ref(false);
const referralStatusDraft = ref('不明');
const progressStageDraft = ref('面談調整中');
const progressStageOptions = ['面談調整中', '初回面談', '2回目面談', '顧客化', 'トビ'];
const editingBasic = ref(false);
const loading = ref(false);
const fetchError = ref('');
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
  next_action: '',
  referred_by_id: ''
});

// Matcher Funnel v-model bindings
const matcherAppliedAtDate = computed({
  get: () => getDatePart(matcherForm.value.applied_at),
  set: (val: string) => matcherForm.value.applied_at = mergeDateHour(val || '', getHourPart(matcherForm.value.applied_at))
});
const matcherAppliedAtHour = computed({
  get: () => getHourPart(matcherForm.value.applied_at) + ':00',
  set: (val: string) => matcherForm.value.applied_at = mergeDateHour(getDatePart(matcherForm.value.applied_at) || '', (val || '10:00').split(':')[0] || '10')
});

const matcherReservationCreatedAtDate = computed({
  get: () => getDatePart(matcherForm.value.reservation_created_at),
  set: (val: string) => matcherForm.value.reservation_created_at = mergeDateHour(val || '', getHourPart(matcherForm.value.reservation_created_at))
});
const matcherReservationCreatedAtHour = computed({
  get: () => getHourPart(matcherForm.value.reservation_created_at) + ':00',
  set: (val: string) => matcherForm.value.reservation_created_at = mergeDateHour(getDatePart(matcherForm.value.reservation_created_at) || '', (val || '10:00').split(':')[0] || '10')
});

const matcherInterviewScheduledAtDate = computed({
  get: () => getDatePart(matcherForm.value.interview_scheduled_at),
  set: (val: string) => matcherForm.value.interview_scheduled_at = mergeDateHour(val || '', getHourPart(matcherForm.value.interview_scheduled_at))
});
const matcherInterviewScheduledAtHour = computed({
  get: () => getHourPart(matcherForm.value.interview_scheduled_at) + ':00',
  set: (val: string) => matcherForm.value.interview_scheduled_at = mergeDateHour(getDatePart(matcherForm.value.interview_scheduled_at) || '', (val || '10:00').split(':')[0] || '10')
});

const matcherInterviewActualAtDate = computed({
  get: () => getDatePart(matcherForm.value.interview_actual_at),
  set: (val: string) => matcherForm.value.interview_actual_at = mergeDateHour(val || '', getHourPart(matcherForm.value.interview_actual_at))
});
const matcherInterviewActualAtHour = computed({
  get: () => getHourPart(matcherForm.value.interview_actual_at) + ':00',
  set: (val: string) => matcherForm.value.interview_actual_at = mergeDateHour(getDatePart(matcherForm.value.interview_actual_at) || '', (val || '10:00').split(':')[0] || '10')
});

const draftStorageKey = computed(() => `student-detail-draft:${String(studentId.value)}`);

const restoreDraft = () => {
  try {
    const raw = sessionStorage.getItem(draftStorageKey.value);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.newScheduleDate !== undefined) newScheduleDate.value = d.newScheduleDate || '';
    if (d.newScheduleHour !== undefined) newScheduleHour.value = d.newScheduleHour || '10:00';
    if (d.newScheduleType !== undefined) newScheduleType.value = d.newScheduleType || '面談';
    if (d.newTaskDate !== undefined) newTaskDate.value = d.newTaskDate || '';
    if (d.newTaskHour !== undefined) newTaskHour.value = d.newTaskHour || '10:00';
    if (d.newTaskContent !== undefined) newTaskContent.value = d.newTaskContent || '';
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
      newTaskHour: newTaskHour.value,
      newTaskContent: newTaskContent.value,
      newScheduleDate: newScheduleDate.value,
      newScheduleHour: newScheduleHour.value,
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
    next_action: student.value?.next_action || '',
    referred_by_id: student.value?.referred_by_id || ''
  };
};

const fetchDetail = async () => {
  if (!studentId.value) return;
  loading.value = true;
  fetchError.value = '';
  try {
    const token = localStorage.getItem('token');
    const res = await api.get(`/api/students/${studentId.value}`, { headers: { Authorization: token } });
    
    // Check if response has data
    if (!res.data || !res.data.student) {
      throw new Error(`学生データ（ID: ${studentId.value}）が見つかりません。`);
    }

    student.value = res.data.student;
    studentEvents.value = res.data.events;
    interviewLogs.value = res.data.logs;
    tasks.value = res.data.tasks || [];
    interviewSchedules.value = res.data.schedules || [];
    matcherFunnel.value = res.data.matcher_funnel || null;
    matcherForm.value = {
      applied_at: toDateTimeLocalHour(res.data.matcher_funnel?.applied_at || student.value?.created_at),
      reservation_created_at: toDateTimeLocalHour(res.data.matcher_funnel?.reservation_created_at || student.value?.meeting_decided_date),
      interview_scheduled_at: toDateTimeLocalHour(res.data.matcher_funnel?.interview_scheduled_at || student.value?.first_interview_date),
      interview_actual_at: toDateTimeLocalHour(res.data.matcher_funnel?.interview_actual_at),
      interview_status: res.data.matcher_funnel?.interview_status || 'completed'
    };
    referralStatusDraft.value = student.value?.referral_status || '不明';
    progressStageDraft.value = student.value?.progress_stage || '面談調整中';
    resetBasicDraft();

    // また、紹介元選択用に全学生リストも必要なら取得
    if (allStudents.value.length === 0) {
      const listRes = await api.get('/api/students', { headers: { Authorization: token } });
      allStudents.value = listRes.data;
    }
  } catch (err: any) {
    console.error('Fetch error:', err);
    fetchError.value = err.response?.data?.error || err.message || 'データの取得に失敗しました。';
  } finally {
    loading.value = false;
  }
};

const toLocalDateTimeString = (value: any) => {
  if (!value) return '';
  return String(value).replace('Z', '').replace(/\+09:?00$/, '').substring(0, 16);
};

const toDateTimeLocalHour = (value?: string | null) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T10:00`;
  // Z付きUTC文字列はJSTに変換（+9時間）、それ以外はローカル時刻として解釈
  const isUTC = raw.endsWith('Z') || /[+\-]\d{2}:?\d{2}$/.test(raw);
  let yyyy: number, mm: number, dd: number, hh: number;
  if (isUTC) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    yyyy = jst.getUTCFullYear();
    mm = jst.getUTCMonth() + 1;
    dd = jst.getUTCDate();
    hh = jst.getUTCHours();
  } else {
    const d = new Date(raw.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    yyyy = d.getFullYear();
    mm = d.getMonth() + 1;
    dd = d.getDate();
    hh = d.getHours();
  }
  return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T${String(hh).padStart(2,'0')}:00`;
};

const normalizeHourDateTime = (value?: string | null) => {
  if (!value) return null;
  const v = toDateTimeLocalHour(value);
  return v || null;
};
const forceHourOnly = (value?: string | null) => toDateTimeLocalHour(value);
const getDatePart = (value?: string | null) => {
  const v = toDateTimeLocalHour(value);
  return v ? v.slice(0, 10) : '';
};
const getHourPart = (value?: string | null) => {
  const v = toDateTimeLocalHour(value);
  return v ? v.slice(11, 13) : '10';
};
const mergeDateHour = (date: string, hour: string) => {
  if (!date) return '';
  const hh = (hour || '10').padStart(2, '0');
  return `${date}T${hh}:00`;
};

const registerMatcherApply = async () => {
  try {
    const token = localStorage.getItem('token');
    const appliedAt = normalizeHourDateTime(matcherForm.value.applied_at);
    await api.post(`/api/students/${studentId.value}/funnel/application`, {
      source: student.value?.source_company || null,
      applied_at: appliedAt
    }, { headers: { Authorization: token } });
    await api.post(`/api/students/${studentId.value}/matcher-funnel/apply`, {
      applied_at: appliedAt
    }, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const registerMatcherReservation = async () => {
  try {
    const token = localStorage.getItem('token');
    const reservationCreatedAt = normalizeHourDateTime(matcherForm.value.reservation_created_at);
    const interviewScheduledAt = normalizeHourDateTime(matcherForm.value.interview_scheduled_at);
    await api.put(`/api/students/${studentId.value}/funnel/reservation`, {
      reservation_status: '初回面談',
      reservation_created_at: reservationCreatedAt,
      reservation_date: interviewScheduledAt
    }, { headers: { Authorization: token } });
    await api.post(`/api/students/${studentId.value}/matcher-funnel/reservation`, {
      reservation_created_at: reservationCreatedAt,
      reservation_status: '初回面談',
      interview_scheduled_at: interviewScheduledAt
    }, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const registerMatcherInterview = async () => {
  try {
    const token = localStorage.getItem('token');
    const interviewActualAt = normalizeHourDateTime(matcherForm.value.interview_actual_at);
    const interviewScheduledAt = normalizeHourDateTime(matcherForm.value.interview_scheduled_at);
    await api.post(`/api/students/${studentId.value}/matcher-funnel/interview`, {
      interview_actual_at: interviewActualAt,
      interview_status: matcherForm.value.interview_status || 'completed',
      interview_scheduled_at: interviewScheduledAt
    }, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) {
    console.error('面談実施登録エラー:', e);
    alert('エラーが発生しました: ' + e.message);
  }
};

const fetchAllEvents = async () => {
  const token = localStorage.getItem('token');
  try {
    const [eventsRes, projectsRes] = await Promise.all([
      api.get('/api/events', { headers: { Authorization: token } }),
      api.get('/api/projects', { headers: { Authorization: token } })
    ]);
    availableEvents.value = [
      ...eventsRes.data.map((e: any) => ({ ...e, source: 'event' })),
      ...projectsRes.data.map((p: any) => ({ ...p, source: 'project' }))
    ];
  } catch (err) {
    console.error('Failed to fetch events:', err);
  }
};

const fetchProposalMaster = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/funnel/master', { headers: { Authorization: token } });
  proposalEvents.value = Array.isArray(res.data?.events) ? res.data.events : [];
  proposalLostReasons.value = Array.isArray(res.data?.lost_reasons) ? res.data.lost_reasons : [];
};

const fetchEventProposals = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/students/${studentId.value}/funnel/event-proposals`, { headers: { Authorization: token } });
  eventProposals.value = Array.isArray(res.data) ? res.data : [];
};

const submitEventProposal = async () => {
  if (!proposalForm.value.event_id) return;
  const token = localStorage.getItem('token');
  const selectedReason = proposalForm.value.reason || '';
  const matchedLostReason = proposalLostReasons.value.find((r: any) => String(r.reason_name || '') === selectedReason);
  const lostReasonId = proposalForm.value.status === 'lost' && matchedLostReason ? Number(matchedLostReason.id) : null;
  await api.post(`/api/students/${studentId.value}/funnel/event-proposal`, {
    event_id: Number(proposalForm.value.event_id),
    selected_event_date: proposalForm.value.selected_event_date || null,
    status: proposalForm.value.status || 'proposed',
    lost_reason_id: lostReasonId,
    reason: selectedReason || null,
    memo: proposalForm.value.memo || null
  }, { headers: { Authorization: token } });
  proposalForm.value = {
    event_id: '',
    selected_event_date: '',
    status: 'proposed',
    reason: '',
    memo: ''
  };
  await fetchEventProposals();
};

const addLog = async () => {
  try {
    if (!newLog.value) return;
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)"}');
    await api.post('/api/interview-logs', {
      student_id: studentId.value,
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
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const deleteLog = async (logId: number) => {
  try {
    if (!confirm('このログを削除しますか？')) return;
    const token = localStorage.getItem('token');
    await api.delete(`/api/students/interview-logs/${logId}`, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const toggleLog = (logId: number) => {
  if (editingLogId.value === logId) return; // 編集中は開閉しない
  expandedLogId.value = expandedLogId.value === logId ? null : logId;
};

const startEditLog = (log: any) => {
  editingLogId.value = log.id;
  editingLogContent.value = log.content || '';
  // 編集開始時は詳細を開いた状態にする
  expandedLogId.value = log.id;
};

const cancelEditLog = () => {
  editingLogId.value = null;
  editingLogContent.value = '';
};

const updateLog = async (logId: number) => {
  if (!editingLogContent.value.trim()) return;
  try {
    savingLogId.value = logId;
    const token = localStorage.getItem('token');
    await api.put(`/api/students/interview-logs/${logId}`, {
      content: editingLogContent.value
    }, { headers: { Authorization: token } });
    editingLogId.value = null;
    editingLogContent.value = '';
    await fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + (e.response?.data?.error || e.message)); 
  } finally {
    savingLogId.value = null;
  }
};

const addTask = async () => {
  try {
    if (!newTaskContent.value.trim()) return;
    const token = localStorage.getItem('token');
    await api.post(`/api/students/${studentId.value}/tasks`, {
      due_date: mergeDateHour(newTaskDate.value || '', (newTaskHour.value || '10:00').split(':')[0] || '10') || null,
      content: newTaskContent.value
    }, { headers: { Authorization: token } });
    newTaskDate.value = '';
    newTaskContent.value = '';
    persistDraft();
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const addInterviewSchedule = async () => {
  try {
    const token = localStorage.getItem('token');
    await api.post(`/api/students/${studentId.value}/interview-schedules`, {
      scheduled_at: mergeDateHour(newScheduleDate.value || '', (newScheduleHour.value || '10:00').split(':')[0] || '10') || null,
      schedule_type: newScheduleType.value,
      status: newScheduleType.value === 'リスケ' ? 'rescheduled' : 'scheduled'
    }, { headers: { Authorization: token } });
    newScheduleDate.value = '';
    newScheduleType.value = '面談';
    persistDraft();
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const updateInterviewSchedule = async (scheduleId: number, payload: { scheduled_at?: string | null; actual_at?: string | null; status?: string; schedule_type?: '流入日' | '面談' | 'リスケ' }) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/interview-schedules/${scheduleId}`, payload, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const deleteInterviewSchedule = async (scheduleId: number) => {
  try {
    if (!confirm('この面談予定を削除しますか？')) return;
    const token = localStorage.getItem('token');
    await api.delete(`/api/students/interview-schedules/${scheduleId}`, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const deleteTask = async (taskId: number) => {
  try {
    if (!confirm('このタスクを削除しますか？')) return;
    const token = localStorage.getItem('token');
    await api.delete(`/api/students/tasks/${taskId}`, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const completeTask = async (taskId: number) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/tasks/${taskId}/complete`, {}, { headers: { Authorization: token } });
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const linkEvent = async () => {
  try {
    if (!selectedEventId.value) return;
    const token = localStorage.getItem('token');
    // For agent-type events, use the calendar-picked datetime; otherwise the slot dropdown
    const dateToSave = isSelectedEventAgent.value
      ? (agentScheduleDate.value || null)
      : (selectedEventDate.value || null);
    await api.post(`/api/students/${studentId.value}/events`, {
      event_id: selectedEventId.value,
      selected_event_date: dateToSave,
      status: selectedEventStatus.value,
      source: selectedLinkEvent.value?.source
    }, { headers: { Authorization: token } });
    selectedEventId.value = '';
    selectedEventDate.value = '';
    agentScheduleDate.value = '';
    selectedEventStatus.value = 'A_ENTRY';
    persistDraft();
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const updateEventParticipationStatus = async (
  eventId: number,
  studentEventId: number,
  status: 'A_ENTRY' | 'B_WAITING' | 'C_WAITING' | 'D_PASS' | 'E_FAIL' | 'XA_CANCEL',
  source?: string
) => {
  try {
    const token = localStorage.getItem('token');
    const endpoint = source === 'project' ? 'projects' : 'events';
    await api.put(
      `/api/${endpoint}/${eventId}/participants/${studentEventId}`,
      { status },
      { headers: { Authorization: token } }
    );
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const updateEventParticipationDate = async (
  eventId: number,
  studentEventId: number,
  currentStatus: string,
  date: string,
  source?: string
) => {
  try {
    const token = localStorage.getItem('token');
    const endpoint = source === 'project' ? 'projects' : 'events';
    await api.put(
      `/api/${endpoint}/${eventId}/participants/${studentEventId}`,
      { status: currentStatus || 'A_ENTRY', selected_event_date: date || null },
      { headers: { Authorization: token } }
    );
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const selectedLinkEvent = computed(() => {
  const id = Number(selectedEventId.value || 0);
  if (!id) return null;
  return availableEvents.value.find((e: any) => Number(e.id) === id) || null;
});

const isSelectedEventAgent = computed(() =>
  selectedLinkEvent.value?.type === 'agent_interview'
);

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

// イベント参加回数（全参加）
const totalEventCount = computed(() =>
  (studentEvents.value ?? []).length
);

// 着座済み回数（status='attended'）
const attendedEventCount = computed(() =>
  (studentEvents.value ?? []).filter((e: any) => e.participation_status === 'attended').length
);

// LTV: 着座済みイベントのunit_priceの合計
const ltv = computed(() =>
  (studentEvents.value ?? [])
    .filter((e: any) => e.participation_status === 'attended')
    .reduce((sum: number, e: any) => sum + Number(e.unit_price || 0), 0)
);

// LTV表示用フォーマット
const ltvFormatted = computed(() =>
  ltv.value.toLocaleString('ja-JP')
);

const funnelStages = computed(() => [
  { label: '申込', completed: !!(matcherFunnel.value?.applied_at || student.value?.created_at) },
  { label: '面談予約', completed: !!(matcherFunnel.value?.reservation_created_at || student.value?.meeting_decided_date) },
  { label: '面談実施', completed: !!(matcherFunnel.value?.interview_actual_at || student.value?.first_interview_date) },
  { label: '完了', completed: matcherFunnel.value?.interview_status === 'completed' && !!matcherFunnel.value?.interview_actual_at }
]);

const funnelProgressWidth = computed(() => {
  const completedCount = funnelStages.value.filter(s => s.completed).length;
  if (completedCount <= 1) return '0%';
  return `${((completedCount - 1) / (funnelStages.value.length - 1)) * 100}%`;
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
    case 'D_PASS':
      return 'bg-green-100 text-green-700';
    case 'E_FAIL':
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
    case 'D_PASS':
      return 'D:合格';
    case 'E_FAIL':
      return 'E:不合格';
    case 'attended':
      return '出席';
    default:
      return '未設定';
  }
};

const updateStatus = async () => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId.value}/meta`, {
      referral_status: referralStatusDraft.value,
      progress_stage: progressStageDraft.value
    }, { headers: { Authorization: token } });
    editingStatus.value = false;
    fetchDetail();
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    alert("エラー発生: " + e.message); 
  }
};

const saveBasic = async () => {
  try {
    basicSaving.value = true;
    basicSaveError.value = '';
    basicSaveMessage.value = '';
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId.value}`, {
      ...basicDraft.value,
      graduation_year: basicDraft.value.graduation_year ? Number(basicDraft.value.graduation_year) : null,
      meeting_decided_date: basicDraft.value.meeting_decided_date || null,
      first_interview_date: basicDraft.value.first_interview_date || null,
      second_interview_date: basicDraft.value.second_interview_date || null,
      next_meeting_date: basicDraft.value.next_meeting_date || null,
      next_action: basicDraft.value.next_action || null,
      referred_by_id: basicDraft.value.referred_by_id ? Number(basicDraft.value.referred_by_id) : null
    }, { headers: { Authorization: token } });
    basicSaveMessage.value = '基本情報を保存しました。';
    await fetchDetail();
    editingBasic.value = false;
  } catch (e: any) { 
    console.error("DEBUG ERROR:", e); 
    basicSaveError.value = e?.response?.data?.error || '保存に失敗しました。入力内容を確認してください。';
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

const formatDateTime = (value?: string | null, event?: any) => {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (!d) return String(value) || '-';
  
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${month}/${day} ${hours}:${minutes}`;

  if (event && Array.isArray(event.event_slots) && event.event_slots.length > 0) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const matchStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const slot = event.event_slots.find((s: any) => s.datetime && s.datetime.startsWith(matchStr));
    if (slot?.location) {
      return `${timeStr} ${slot.location}`;
    }
  }
  return timeStr;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return ''
  const s = String(value).slice(0, 10) // "2026-03-22" のみ取得
  const parts = s.split('-')
  if (parts.length < 3) return s
  const [, m, d] = parts
  return `${Number(m)}/${Number(d)}`
}

const parseLocalDate = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim().replace('Z', '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0)
  );
};

const eventDateList = (event: any) => {
  const dates = Array.isArray(event?.event_dates) && event.event_dates.length > 0
    ? event.event_dates
    : (event?.event_date ? [event.event_date] : []);
  return dates.map((d: any) => String(d)).filter(Boolean);
};

const upcomingEvents = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return availableEvents.value
    .filter((event: any) => {
      const dates = eventDateList(event);
      if (dates.length === 0) return true;
      return dates.some((d: string) => {
        const parsed = parseLocalDate(d);
        return parsed ? parsed >= todayStart : false;
      });
    })
    .sort((a: any, b: any) => {
      const ad = eventDateList(a).map((d: string) => parseLocalDate(d)).find(Boolean) as Date | undefined;
      const bd = eventDateList(b).map((d: string) => parseLocalDate(d)).find(Boolean) as Date | undefined;
      return (ad?.getTime() || Number.MAX_SAFE_INTEGER) - (bd?.getTime() || Number.MAX_SAFE_INTEGER);
    });
});

const toggleOverviewEvent = (eventId: number) => {
  expandedOverviewEventId.value = expandedOverviewEventId.value === eventId ? null : eventId;
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
const unifiedReasonOptions = computed(() => {
  const all = [
    ...proposalLostReasons.value.map((r: any) => String(r.reason_name || '').trim()).filter(Boolean),
    ...participationReasons
  ];
  return Array.from(new Set(all));
});
const isPinned = computed(() => getPinnedStudent()?.id === Number(studentId.value));

const pinCurrentStudent = () => {
  if (!student.value?.id) return;
  setPinnedStudent({ id: Number(student.value.id), name: String(student.value.name || '') });
};

const unpinCurrentStudent = () => {
  if (getPinnedStudent()?.id === Number(studentId.value)) {
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

watch(studentId, (newId) => {
  if (newId) {
    // Reset state before fetching
    student.value = {};
    studentEvents.value = [];
    interviewLogs.value = [];
    tasks.value = [];
    interviewSchedules.value = [];
    matcherFunnel.value = null;
    
    fetchDetail().then(restoreDraft);
    fetchEventProposals();
  }
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
  const normalized = toLocalDateTimeString(proposalForm.value.selected_event_date);
  if (!proposalForm.value.selected_event_date || !dates.some((d: string) => toLocalDateTimeString(d) === normalized)) {
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
  const normalized = toLocalDateTimeString(selectedEventDate.value);
  if (!selectedEventDate.value || !list.some((d: string) => toLocalDateTimeString(d) === normalized)) {
    selectedEventDate.value = list[0] || '';
  }
});

</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <!-- モバイルのみタブ表示 -->
      <div class="flex md:hidden border-b border-gray-200 mb-6 bg-white sticky top-0 z-10 -mx-4 px-4">
        <button
          v-for="tab in ['基本情報', 'ログ', '案件', 'その他']"
          :key="tab"
          @click="activeTab = tab"
          class="flex-1 py-3 text-sm font-bold border-b-2 transition-colors"
          :class="activeTab === tab
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-400'"
        >{{ tab }}</button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-40">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-500 font-bold">データを読み込み中...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="fetchError" class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center my-8">
        <div class="text-red-600 text-5xl mb-4">⚠️</div>
        <h2 class="text-xl font-bold text-red-900 mb-2">データの取得に失敗しました</h2>
        <p class="text-red-700 mb-6 font-medium">{{ fetchError }}</p>
        <div class="flex flex-col items-center gap-4 text-sm text-gray-500">
          <p>対象学生ID: <span class="font-mono font-bold bg-white px-2 py-1 rounded border text-black">{{ studentId }}</span></p>
          <div class="flex items-center gap-3">
            <button 
              @click="fetchDetail" 
              class="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
            >
              再読み込みを試す
            </button>
            <button 
              @click="router.push('/students')" 
              class="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              一覧に戻る
            </button>
          </div>
        </div>
      </div>

      <div v-else>
        <button @click="router.push('/students')" class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowLeft class="w-6 h-6" />
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ student.name }}</h1>
          <p class="text-gray-500">学生詳細情報・面談履歴</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            class="px-3 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            @click="showMatcherFunnel = true"
          >
            面談ファネルを開く
          </button>
          <button
            class="px-3 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            @click="showEventOverviewPanel = true"
          >
            案件概要を開く
          </button>
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
          <!-- KPI & サマリーカード (常に表示) -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-blue-600" />
              実績・ステータス
            </h2>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">総参加案件</p>
                <div class="flex items-center gap-2">
                  <Activity class="w-4 h-4 text-blue-500" />
                  <span class="text-xl font-bold text-blue-900">{{ totalEventCount }}</span>
                  <span class="text-xs text-blue-600">件</span>
                </div>
              </div>
              <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">LTV (売上)</p>
                <div class="flex items-center gap-1">
                  <Coins class="w-4 h-4 text-emerald-500" />
                  <span class="text-xl font-bold text-emerald-900">¥{{ ltvFormatted }}</span>
                </div>
              </div>
            </div>

            <!-- Matcher面談ファネル進捗 (常に表示) -->
            <div v-if="student.source_company === 'Matcher' || matcherFunnel" class="space-y-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-bold text-gray-500">Matcher面談フェーズ</p>
                <button @click="showMatcherFunnel = true" class="text-[10px] text-blue-600 font-bold hover:underline">詳細編集</button>
              </div>
              <div class="relative flex items-center justify-between px-2">
                <!-- 線 -->
                <div class="absolute left-0 right-0 top-3 h-0.5 bg-gray-100 -z-0"></div>
                <div class="absolute left-0 top-3 h-0.5 bg-blue-500 transition-all duration-500 -z-0" :style="{ width: funnelProgressWidth }"></div>
                
                <div v-for="(stage, idx) in funnelStages" :key="stage.label" class="relative z-10 flex flex-col items-center gap-1.5">
                  <div 
                    class="w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm"
                    :class="stage.completed ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-300'"
                  >
                    <CheckCircle2 v-if="stage.completed" class="w-4 h-4" />
                    <span v-else class="text-[10px] font-bold">{{ idx + 1 }}</span>
                  </div>
                  <span class="text-[10px] font-bold" :class="stage.completed ? 'text-blue-600' : 'text-gray-400'">{{ stage.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <div :class="activeTab === '基本情報' ? 'block' : 'hidden md:block'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
              <span class="text-base md:text-sm font-semibold px-2 py-1 rounded-full" :class="statusClass(student.referral_status)">
                {{ student.referral_status || '不明' }}
              </span>
              <span class="text-base md:text-sm font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                進捗: {{ student.progress_stage || '面談調整中' }}
              </span>
              <div v-if="editingStatus" class="flex items-center gap-2">
                <select v-model="referralStatusDraft" class="px-2 py-1 border border-gray-300 rounded-md text-base md:text-sm">
                  <option value="キーマン">キーマン</option>
                  <option value="出そう">出そう</option>
                  <option value="ほぼ無理ワンチャン">ほぼ無理ワンチャン</option>
                  <option value="無理">無理</option>
                  <option value="不明">不明</option>
                </select>
                <select v-model="progressStageDraft" class="px-2 py-1 border border-gray-300 rounded-md text-base md:text-sm">
                  <option v-for="v in progressStageOptions" :key="`detail-progress-${v}`" :value="v">{{ v }}</option>
                </select>
                <button class="text-base md:text-sm px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-md" @click="updateStatus">保存</button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">流入経路</p>
                  <p class="text-sm font-medium">{{ student.source_company || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">大学</p>
                  <p class="text-sm font-medium">{{ student.university || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">所在地（都道府県）</p>
                  <p class="text-sm font-medium">{{ student.prefecture || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">文理</p>
                  <p class="text-sm font-medium">{{ student.academic_track || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">学部</p>
                  <p class="text-sm font-medium">{{ student.faculty || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <MessageSquare class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">面談理由</p>
                  <p class="text-sm font-medium">{{ student.interview_reason || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">卒業年度</p>
                  <p class="text-sm font-medium">{{ student.graduation_year || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">志望業界</p>
                  <p class="text-sm font-medium">{{ student.desired_industry || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">志望職種</p>
                  <p class="text-sm font-medium">{{ student.desired_role || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5 text-green-600" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">被紹介人数</p>
                  <p class="text-sm font-bold text-green-700">{{ student.referral_count || 0 }}人</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Mail class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">メールアドレス</p>
                  <p class="text-sm font-medium">{{ student.email || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Phone class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">電話番号</p>
                  <p class="text-sm font-medium">{{ student.phone || '-' }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3 text-gray-600 min-w-0 sm:col-span-2">
                <MessageSquare class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">ネクストアクション</p>
                  <p class="text-sm font-medium">{{ student.next_action || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">選考ステータス</p>
                  <p class="text-sm font-medium">{{ student.status || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <GraduationCap class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">担当ID</p>
                  <p class="text-sm font-medium">{{ student.staff_id || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">登録日時</p>
                  <p class="text-sm font-medium">{{ formatDateTime(student.created_at) }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">更新日時</p>
                  <p class="text-sm font-medium">{{ formatDateTime(student.updated_at) }}</p>
                </div>
              </div>
            </div>

            <div v-if="tags.length" class="mt-4 flex flex-wrap gap-2">
              <span v-for="tag in tags" :key="tag" class="text-base md:text-sm px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{{ tag }}</span>
            </div>
          </div>

          <!-- 面談日程カード -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">面談日程</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">面談決定日</p>
                  <p class="text-sm font-medium">{{ formatDate(matcherFunnel?.reservation_created_at || student.meeting_decided_date) || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">初回面談日</p>
                  <p class="text-sm font-medium">{{ formatDate(matcherFunnel?.interview_actual_at || matcherFunnel?.interview_scheduled_at || student.first_interview_date) || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">2回目面談日</p>
                  <p class="text-sm font-medium">{{ formatDate(student.second_interview_date) || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 text-gray-600 min-w-0">
                <Calendar class="w-5 h-5" />
                <div>
                  <p class="text-base md:text-sm text-gray-500">次回面談日</p>
                  <p class="text-sm font-medium">{{ formatDate(student.next_meeting_date) || '-' }}</p>
                </div>
              </div>
            </div>
          </div>

          <div :class="activeTab === 'その他' ? 'block' : 'hidden md:block'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">タスク</h2>
            <div class="space-y-2 mb-4">
              <div v-for="t in tasks" :key="t.id" class="flex items-start justify-between gap-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <p class="text-base md:text-sm text-gray-500">{{ t.due_date ? formatDate(t.due_date) : '履行日未設定' }}</p>
                  <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ t.content }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <label class="inline-flex items-center gap-1 text-base md:text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" @change="completeTask(t.id)" />
                    完了
                  </label>
                  <button class="text-gray-400 hover:text-red-600" @click="deleteTask(t.id)">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p v-if="tasks.length === 0" class="text-base md:text-sm text-gray-400">タスクはまだありません</p>
            </div>
            <div class="space-y-2">
              <label class="block text-base md:text-sm text-gray-500">タスク履行日</label>
              <div class="flex gap-2">
                <input v-model="newTaskDate" type="date" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
                <select v-model="newTaskHour" class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                  <option v-for="h in hourOptions" :key="`task-hour-${h}`" :value="h">{{ h }}</option>
                </select>
              </div>
              <textarea v-model="newTaskContent" placeholder="やることを入力..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm h-24"></textarea>
              <button class="w-full bg-blue-600 text-white px-4 py-2 min-h-[44px] rounded-lg text-base md:text-sm hover:bg-blue-700" @click="addTask">
                タスクを追加
              </button>
            </div>
          </div>

          <div :class="activeTab === 'その他' ? 'block' : 'hidden md:block'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">面談スケジュール</h2>
            <div class="space-y-2 mb-4">
              <div v-for="sc in interviewSchedules" :key="sc.id" class="rounded-lg border border-gray-200 p-3">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="text-base md:text-sm font-semibold text-gray-900">第{{ sc.round_no }}回</div>
                  <button class="text-gray-400 hover:text-red-600" @click="deleteInterviewSchedule(sc.id)">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="date"
                    :value="getDatePart(sc.scheduled_at)"
                    @change="updateInterviewSchedule(sc.id, { scheduled_at: mergeDateHour(($event.target as HTMLInputElement).value || '', getHourPart(sc.scheduled_at)) })"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm sm:col-span-2"
                  />
                  <select
                    :value="getHourPart(sc.scheduled_at) + ':00'"
                    @change="updateInterviewSchedule(sc.id, { scheduled_at: mergeDateHour(getDatePart(sc.scheduled_at), (($event.target as HTMLSelectElement).value).split(':')[0] || '10') })"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                  >
                    <option v-for="h in hourOptions" :key="`edit-sc-hour-${sc.id}-${h}`" :value="h">{{ h }}</option>
                  </select>
                  <select
                    :value="sc.schedule_type || '面談'"
                    @change="updateInterviewSchedule(sc.id, { schedule_type: ($event.target as HTMLSelectElement).value as '流入日' | '面談' | 'リスケ' })"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                  >
                    <option value="流入日">流入日</option>
                    <option value="面談">面談</option>
                    <option value="リスケ">リスケ</option>
                  </select>
                </div>
                <p class="text-base md:text-sm text-gray-500 mt-2">リスケ回数: {{ sc.reschedule_count || 0 }}</p>
              </div>
              <p v-if="interviewSchedules.length === 0" class="text-base md:text-sm text-gray-400">面談予定はまだありません</p>
            </div>
            <div class="pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
              <input v-model="newScheduleDate" type="date" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
              <select v-model="newScheduleHour" class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                <option v-for="h in hourOptions" :key="`new-sc-hour-${h}`" :value="h">{{ h }}</option>
              </select>
              <select v-model="newScheduleType" class="px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                <option value="流入日">流入日</option>
                <option value="面談">面談</option>
                <option value="リスケ">リスケ</option>
              </select>
              <button class="bg-blue-600 text-white px-4 py-2 min-h-[44px] rounded-lg text-base md:text-sm hover:bg-blue-700" @click="addInterviewSchedule">
                追加
              </button>
            </div>
          </div>


          <div :class="activeTab === '案件' ? 'block' : 'hidden md:block'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">案件提案管理（複数登録）</h2>
            <div class="space-y-2 mb-4">
              <div v-for="p in eventProposals" :key="`proposal-${p.id}`" class="rounded-lg border border-gray-200 p-3 text-base md:text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-gray-900">{{ p.event_name || '-' }}</span>
                  <span class="text-base md:text-sm text-gray-500">{{ formatDateTime(p.proposed_at) }}</span>
                  <span v-if="p.selected_event_date" class="text-base md:text-sm text-blue-600">参加日: {{ formatDateTime(p.selected_event_date, p) }}</span>
                  <span class="text-base md:text-sm px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{{ p.status || '-' }}</span>
                  <span v-if="p.reason || p.lost_reason_name" class="text-base md:text-sm text-gray-700">理由: {{ p.reason || p.lost_reason_name }}</span>
                </div>
                <p v-if="p.memo" class="text-base md:text-sm text-gray-600 mt-1 whitespace-pre-wrap">{{ p.memo }}</p>
              </div>
              <p v-if="eventProposals.length === 0" class="text-base md:text-sm text-gray-400">提案履歴はまだありません</p>
            </div>
            <div class="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2">
              <select v-model="proposalForm.event_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                <option value="">案件を選択</option>
                <option v-for="e in proposalEvents" :key="`proposal-event-${e.id}`" :value="String(e.id)">
                  {{ e.event_name || e.title }}（{{ e.event_date ? formatDateTime(e.event_date) : '-' }}）
                </option>
              </select>
              <select v-model="proposalForm.selected_event_date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" :disabled="!proposalForm.event_id">
                <option value="">参加日程を選択</option>
                <option v-for="d in selectedProposalEventDates" :key="`proposal-date-${d}`" :value="d">{{ formatDateTime(d, selectedProposalEvent) }}</option>
              </select>
              <select v-model="proposalForm.status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                <option value="proposed">提案済み</option>
                <option value="joined">参加</option>
                <option value="lost">失注</option>
              </select>
              <select v-model="proposalForm.reason" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm">
                <option value="">理由（任意）</option>
                <option v-for="reason in unifiedReasonOptions" :key="`proposal-reason-${reason}`" :value="reason">{{ reason }}</option>
              </select>
              <input v-model="proposalForm.memo" type="text" placeholder="メモ（任意）" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm" />
            </div>
            <button class="mt-3 bg-blue-600 text-white px-4 py-2 min-h-[44px] rounded-lg text-base md:text-sm hover:bg-blue-700" @click="submitEventProposal">
              案件提案を追加
            </button>
          </div>

          <div :class="activeTab === '案件' ? 'block' : 'hidden md:block'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar class="w-5 h-5 text-blue-600" />
              参加・エントリー案件
            </h2>
            <div class="space-y-3 mb-6">
              <div v-for="e in studentEvents" :key="e.student_event_id || e.id" class="p-3 bg-gray-50 rounded-lg">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <span class="text-base md:text-sm font-bold text-gray-900 block truncate">{{ e.title }}</span>
                    <p class="text-base md:text-sm text-gray-500 mt-0.5">{{ e.selected_event_date ? formatDateTime(e.selected_event_date, e) : formatDateTime(e.event_date, e) }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                    <select
                      v-if="eventDateOptions(e).length > 1"
                      class="px-2 py-1.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px]"
                      :value="e.selected_event_date || ''"
                      @change="updateEventParticipationDate(e.id, e.student_event_id, e.participation_status, ($event.target as HTMLSelectElement).value, e.source)"
                    >
                      <option disabled value="">参加日を選択</option>
                      <option v-for="d in eventDateOptions(e)" :key="`student-event-date-${e.id}-${d}`" :value="d">
                        {{ formatDateTime(d, e) }}
                      </option>
                    </select>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" :class="participationStatusClass(e.participation_status)">
                      {{ participationStatusLabel(e.participation_status) }}
                    </span>
                    <button
                      @click="openStatusModal(e)"
                      class="text-base md:text-sm font-bold px-2 py-1 rounded-full border whitespace-nowrap"
                      :class="getStatusBadgeClass(e.participation_status)"
                    >{{ getStatusLabel(e.participation_status) }} ▼</button>
                  </div>
                </div>
              </div>
              <div v-if="studentEvents.length === 0" class="text-base md:text-sm text-gray-400 text-center py-4">
                イベントへの参加はありません
              </div>
            </div>

            <div class="pt-5 border-t border-gray-100">
              <label class="block text-base md:text-sm font-bold text-gray-600 mb-3 ml-1">新しいイベントに紐付ける</label>
              <div class="flex flex-col gap-2">
                <!-- Event selector -->
                <select v-model="selectedEventId" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option disabled value="">案件を選択</option>
                  <optgroup label="エージェント面談">
                    <option v-for="ae in availableEvents.filter((e:any) => e.type === 'agent_interview')" :key="ae.id" :value="ae.id">
                      🤝 {{ ae.title }}
                    </option>
                  </optgroup>
                  <optgroup label="イベント">
                    <option v-for="ae in availableEvents.filter((e:any) => e.type !== 'agent_interview')" :key="ae.id" :value="ae.id">
                      📅 {{ ae.title }}
                    </option>
                  </optgroup>
                </select>

                <!-- Agent-type: Calendar picker -->
                <div v-if="selectedEventId && isSelectedEventAgent" class="mt-1">
                  <AgentSchedulePicker v-model="agentScheduleDate" />
                </div>

                <!-- Non-agent: date slot dropdown (existing behavior) -->
                <select
                  v-else-if="selectedEventId && !isSelectedEventAgent && selectedLinkEventDates.length > 1"
                  v-model="selectedEventDate"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option v-for="d in selectedLinkEventDates" :key="`add-link-date-${d}`" :value="d">{{ formatDateTime(d, selectedLinkEvent) }}</option>
                </select>

                <!-- Status + submit -->
                <div class="flex gap-2" v-if="selectedEventId">
                  <select v-model="selectedEventStatus" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="A_ENTRY">A:エントリー</option>
                    <option value="B_WAITING">B:回答待ち</option>
                    <option value="C_WAITING">C:回答待ち</option>
                    <option value="D_PASS">D:合格</option>
                    <option value="E_FAIL">E:不合格</option>
                    <option value="XA_CANCEL">XA:キャンセル</option>
                  </select>
                  <button
                    @click="linkEvent"
                    :disabled="isSelectedEventAgent && !agentScheduleDate"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg text-base md:text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >追加</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div :class="activeTab === 'ログ' ? 'block' : 'hidden md:block'" class="lg:col-span-2">
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
                    <div class="flex flex-wrap items-center gap-2 text-base md:text-sm text-gray-600">
                      <span class="font-semibold text-blue-600">
                        {{ log.log_type || '面談' }}
                        <span v-if="log.log_type === 'エントリー' && log.event_title" class="text-base md:text-sm text-gray-500 ml-2">
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
                        v-if="editingLogId !== log.id"
                        class="text-gray-400 hover:text-blue-600"
                        @click="startEditLog(log)"
                        title="編集"
                      >
                        <Edit class="w-4 h-4" />
                      </button>
                      <button
                        class="text-gray-400 hover:text-gray-600"
                        @click="toggleLog(log.id)"
                        title="詳細"
                      >
                        <component :is="expandedLogId === log.id ? ChevronUp : ChevronDown" class="w-4 h-4" />
                      </button>
                      <button
                        v-if="editingLogId !== log.id"
                        class="text-gray-400 hover:text-red-600"
                        @click="deleteLog(log.id)"
                        title="削除"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div v-if="expandedLogId === log.id" class="text-base md:text-sm text-gray-800">
                    <div v-if="editingLogId === log.id" class="space-y-3">
                      <textarea
                        v-model="editingLogContent"
                        class="w-full p-3 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 h-32 bg-white"
                        placeholder="ログ内容を編集..."
                      ></textarea>
                      <div class="flex justify-end gap-2">
                        <button
                          class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-base md:text-sm hover:bg-gray-50 transition-colors"
                          @click="cancelEditLog"
                        >
                          キャンセル
                        </button>
                        <button
                          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-base md:text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                          :disabled="savingLogId === log.id"
                          @click="updateLog(log.id)"
                        >
                          {{ savingLogId === log.id ? '保存中...' : '保存' }}
                        </button>
                      </div>
                    </div>
                    <div v-else class="whitespace-pre-wrap">{{ log.content }}</div>
                  </div>
                </div>
              </div>
              <div v-if="interviewLogs.length === 0" class="text-center text-gray-400 py-10">
                記録がまだありません
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 bg-gray-50">
              <div class="flex flex-col sm:flex-row gap-2 mb-3">
                <select v-model="newLogType" class="px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="面談">面談</option>
                  <option value="エントリー">エントリー</option>
                  <option value="その他">その他</option>
                </select>
                <select
                  v-if="newLogType === 'エントリー'"
                  v-model="newLogEventId"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option disabled value="">エントリーしたイベントを選択</option>
                  <option v-for="ae in availableEvents" :key="ae.id" :value="ae.id">{{ ae.title }}</option>
                </select>
              </div>
              <textarea
                v-model="newLog"
                :placeholder="newLogType === '面談' ? '面談内容を入力...' : newLogType === 'エントリー' ? 'エントリー内容を入力...' : 'メモを入力...'"
                class="w-full p-4 border border-gray-300 rounded-xl text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 mb-3 bg-white"
              ></textarea>
              <div class="flex justify-end">
                <button @click="addLog" class="bg-blue-600 text-white px-6 py-2 min-h-[44px] rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
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
      <div
        v-if="showMatcherFunnel"
        class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        @click.self="showMatcherFunnel = false"
      >
        <div class="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-extrabold text-gray-900">Matcher面談ファネル</h2>
            <button class="px-3 py-1.5 text-base md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="showMatcherFunnel = false">閉じる</button>
          </div>
          <p class="text-base md:text-sm text-gray-600 mb-4">申込 → 予約（初回面談） → 初回面談実施 を順番に登録します。</p>

          <div class="mb-6 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <div class="flex items-center justify-between gap-2 text-base md:text-sm sm:text-base md:text-sm font-semibold text-slate-700">
              <span class="inline-flex items-center gap-2"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">1</span>申込</span>
              <span class="h-1 flex-1 bg-slate-300 rounded-full"></span>
              <span class="inline-flex items-center gap-2"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">2</span>予約</span>
              <span class="h-1 flex-1 bg-slate-300 rounded-full"></span>
              <span class="inline-flex items-center gap-2"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">3</span>面談実施</span>
            </div>
          </div>

          <div class="flex flex-col lg:flex-row lg:items-stretch gap-4">
            <div :class="['flex-1 rounded-2xl border p-5 shadow-sm transition-all', matcherFunnel?.applied_at ? 'border-blue-500 bg-blue-50/50' : 'border-blue-200 bg-blue-50/30']">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xl font-extrabold text-gray-900">1) 申込登録</p>
                <span v-if="matcherFunnel?.applied_at" class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-white px-2 py-1 rounded-full border border-blue-200">
                  ✅ 登録済み
                </span>
              </div>
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-2">申込日</label>
              <div class="grid grid-cols-12 gap-2 mb-4">
                <input
                  v-model="matcherAppliedAtDate"
                  type="date"
                  class="col-span-8 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                />
                <select
                  v-model="matcherAppliedAtHour"
                  class="col-span-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                >
                  <option v-for="h in hourOptions" :key="`matcher-apply-hour-${h}`" :value="h">{{ h }}</option>
                </select>
              </div>
              <button
                class="w-full h-11 px-4 rounded-xl text-base md:text-sm font-bold text-white transition-colors"
                :class="matcherFunnel?.applied_at ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'"
                @click="registerMatcherApply"
              >
                {{ matcherFunnel?.applied_at ? '申込情報を更新' : '申込登録' }}
              </button>
            </div>

            <div class="hidden lg:flex items-center text-3xl font-black text-slate-300 px-1">→</div>

            <div :class="['flex-1 rounded-2xl border p-5 shadow-sm transition-all', matcherFunnel?.reservation_created_at ? 'border-amber-500 bg-amber-50/50' : 'border-amber-200 bg-amber-50/30']">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xl font-extrabold text-gray-900">2) 予約登録</p>
                <span v-if="matcherFunnel?.reservation_created_at" class="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-white px-2 py-1 rounded-full border border-amber-200">
                  ✅ 登録済み
                </span>
              </div>
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-2">予約作成日（TimeRex）</label>
              <div class="grid grid-cols-12 gap-2 mb-4">
                <input
                  v-model="matcherReservationCreatedAtDate"
                  type="date"
                  class="col-span-8 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                />
                <select
                  v-model="matcherReservationCreatedAtHour"
                  class="col-span-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                >
                  <option v-for="h in hourOptions" :key="`matcher-reserve-hour-${h}`" :value="h">{{ h }}</option>
                </select>
              </div>
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-2">初回面談予定日</label>
              <div class="grid grid-cols-12 gap-2 mb-4">
                <input
                  v-model="matcherInterviewScheduledAtDate"
                  type="date"
                  class="col-span-8 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                />
                <select
                  v-model="matcherInterviewScheduledAtHour"
                  class="col-span-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                >
                  <option v-for="h in hourOptions" :key="`matcher-scheduled-hour-${h}`" :value="h">{{ h }}</option>
                </select>
              </div>
              <div class="mb-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-base md:text-sm font-semibold border border-amber-200">予約ステータス: 初回面談</span>
              </div>
              <button
                class="w-full h-11 px-4 rounded-xl text-base md:text-sm font-bold text-white transition-colors"
                :class="matcherFunnel?.reservation_created_at ? 'bg-amber-600 hover:bg-amber-700' : 'bg-amber-500 hover:bg-amber-600'"
                @click="registerMatcherReservation"
              >
                {{ matcherFunnel?.reservation_created_at ? '予約情報を更新' : '予約登録' }}
              </button>
            </div>

            <div class="hidden lg:flex items-center text-3xl font-black text-slate-300 px-1">→</div>

            <div :class="['flex-1 rounded-2xl border p-5 shadow-sm transition-all', matcherFunnel?.interview_actual_at ? 'border-emerald-500 bg-emerald-50/50' : 'border-emerald-200 bg-emerald-50/30']">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xl font-extrabold text-gray-900">3) 面談実施登録</p>
                <span v-if="matcherFunnel?.interview_actual_at" class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-white px-2 py-1 rounded-full border border-emerald-200">
                  ✅ 登録済み
                </span>
              </div>
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-2">初回面談実施日</label>
              <div class="grid grid-cols-12 gap-2 mb-4">
                <input
                  v-model="matcherInterviewActualAtDate"
                  type="date"
                  class="col-span-8 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                />
                <select
                  v-model="matcherInterviewActualAtHour"
                  class="col-span-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm"
                >
                  <option v-for="h in hourOptions" :key="`matcher-actual-hour-${h}`" :value="h">{{ h }}</option>
                </select>
              </div>
              <label class="block text-base md:text-sm font-medium text-gray-700 mb-2">面談結果</label>
              <select v-model="matcherForm.interview_status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm mb-4">
                <option value="completed">実施</option>
                <option value="no_show">飛ばれ</option>
                <option value="rescheduled">リスケ</option>
                <option value="cancel">キャンセル</option>
              </select>
              <button
                class="w-full h-11 px-4 rounded-xl text-base md:text-sm font-bold text-white transition-colors"
                :class="matcherFunnel?.interview_actual_at ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'"
                @click="registerMatcherInterview"
              >
                {{ matcherFunnel?.interview_actual_at ? '実施情報を更新' : '面談実施登録' }}
              </button>
            </div>
          </div>

          <!-- LTV・参加回数サマリー -->
          <div class="mt-6 pt-5 border-t border-gray-100">
            <p class="text-sm font-bold text-gray-700 mb-3">📊 LTV・参加実績</p>
            <div class="grid grid-cols-3 gap-3">
              <!-- 案件参加回数 -->
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <p class="text-xs text-gray-500 mb-1">イベント参加回数</p>
                <p class="text-lg font-extrabold text-gray-900">{{ totalEventCount }}<span class="text-xs font-normal ml-1">回</span></p>
              </div>
              <!-- 着座回数 -->
              <div class="bg-emerald-50 rounded-xl p-3 text-center">
                <p class="text-xs text-gray-500 mb-1">着座回数</p>
                <p class="text-lg font-extrabold text-emerald-700">{{ attendedEventCount }}<span class="text-xs font-normal ml-1">回</span></p>
              </div>
              <!-- LTV -->
              <div class="bg-blue-50 rounded-xl p-3 text-center">
                <p class="text-xs text-gray-500 mb-1">1名あたりのLTV</p>
                <p class="text-lg font-extrabold text-blue-700">¥{{ ltvFormatted }}</p>
              </div>
            </div>

            <!-- 参加案件一覧（折りたたみ） -->
            <details class="mt-3">
              <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                参加イベント一覧を見る（{{ totalEventCount }}件）
              </summary>
              <div class="mt-2 space-y-1">
                <div
                  v-for="ev in (studentEvents ?? [])"
                  :key="ev.student_event_id || ev.event_id || ev.title"
                  class="flex items-center justify-between px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs"
                >
                  <div class="flex items-center gap-2">
                    <span
                      :class="ev.participation_status === 'attended'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'"
                      class="px-2 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ ev.participation_status === 'attended' ? '着座' : ev.participation_status ?? '-' }}
                    </span>
                    <span class="text-gray-700 font-medium">{{ ev.title }}</span>
                  </div>
                  <div class="flex items-center gap-3 text-gray-400">
                    <span>{{ ev.event_date ? ev.event_date.substring(0, 10) : '-' }}</span>
                    <span v-if="ev.participation_status === 'attended'" class="text-blue-600 font-semibold">
                      ¥{{ Number(ev.unit_price || 0).toLocaleString('ja-JP') }}
                    </span>
                  </div>
                </div>
                <div v-if="!(studentEvents ?? []).length" class="text-xs text-gray-400 text-center py-2">
                  参加イベントなし
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <aside
        v-if="showEventOverviewPanel"
        class="fixed right-0 top-0 z-40 h-full w-full max-w-xl bg-white shadow-2xl border-l border-gray-200 flex flex-col"
      >
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">開催中・未終了イベント概要</h3>
            <p class="text-base md:text-sm text-gray-500">イベント名を開いて詳細を確認</p>
          </div>
          <button class="px-3 py-1.5 text-base md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50" @click="showEventOverviewPanel = false">閉じる</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div
            v-for="ev in upcomingEvents"
            :key="`upcoming-${ev.id}`"
            class="border border-gray-200 rounded-xl bg-gray-50/50"
          >
            <button
              class="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
              @click="toggleOverviewEvent(ev.id)"
            >
              <div class="min-w-0">
                <p class="text-base font-bold text-gray-900 truncate">{{ ev.title }}</p>
                <p class="text-base md:text-sm text-gray-500 mt-0.5">クリックで概要を表示</p>
              </div>
              <component :is="expandedOverviewEventId === ev.id ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-500 shrink-0" />
            </button>

            <div v-if="expandedOverviewEventId === ev.id" class="px-4 pb-4 border-t border-gray-200">
              <div class="pt-3">
                <span class="text-base md:text-sm px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">提案候補</span>
              </div>
              <p class="text-base md:text-sm text-gray-500 mt-3 mb-1">開催日</p>
              <div class="text-base md:text-sm text-gray-800 mb-2">
                <div v-for="d in eventDateList(ev)" :key="`upcoming-date-${ev.id}-${d}`">{{ formatDateTime(d, ev) }}</div>
                <div v-if="eventDateList(ev).length === 0">未設定</div>
              </div>
              <p class="text-base md:text-sm text-gray-500 mb-1">開催場所</p>
              <p class="text-base md:text-sm text-gray-800 mb-2">{{ ev.location || '未設定' }}</p>
              <p class="text-base md:text-sm text-gray-500 mb-1">概要</p>
              <p class="text-base md:text-sm text-gray-800 whitespace-pre-wrap">{{ ev.description || '概要未設定' }}</p>
              <a
                v-if="ev.lp_url"
                :href="ev.lp_url"
                target="_blank"
                rel="noreferrer"
                class="inline-block mt-2 text-base md:text-sm text-blue-600 hover:underline"
              >
                LPを開く
              </a>
            </div>
          </div>
          <div v-if="upcomingEvents.length === 0" class="text-base md:text-sm text-gray-400 text-center py-8">
            提案候補イベントはありません
          </div>
        </div>
      </aside>
    </teleport>

    <teleport to="body">
      <div v-if="editingBasic" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[90]">
        <div class="bg-white rounded-xl shadow-xl w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">基本情報を編集</h3>
          <p v-if="basicSaveError" class="mb-3 text-base md:text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ basicSaveError }}
          </p>
          <p v-if="basicSaveMessage" class="mb-3 text-base md:text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {{ basicSaveMessage }}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">氏名</label>
              <input v-model="basicDraft.name" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">大学</label>
              <input v-model="basicDraft.university" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">所在地（都道府県）</label>
              <input v-model="basicDraft.prefecture" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">文理</label>
              <select v-model="basicDraft.academic_track" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs">
                <option value="">文理（未設定）</option>
                <option value="文系">文系</option>
                <option value="理系">理系</option>
              </select>
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">学部・学科</label>
              <input v-model="basicDraft.faculty" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">卒業年</label>
              <input v-model="basicDraft.graduation_year" type="number" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">メールアドレス</label>
              <input v-model="basicDraft.email" type="email" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">電話番号</label>
              <input v-model="basicDraft.phone" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">流入経路</label>
              <input v-model="basicDraft.source_company" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">面談理由</label>
              <select v-model="basicDraft.interview_reason" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs">
                <option value="">面談理由（未設定）</option>
                <option value="就活相談">就活相談</option>
                <option value="企業分析">企業分析</option>
                <option value="企業相談">企業相談</option>
                <option value="面接対策">面接対策</option>
              </select>
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">面談決定日</label>
              <input v-model="basicDraft.meeting_decided_date" type="date" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">初回面談日</label>
              <input v-model="basicDraft.first_interview_date" type="date" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">2回目面談日</label>
              <input v-model="basicDraft.second_interview_date" type="date" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">志望業界</label>
              <input v-model="basicDraft.desired_industry" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">志望職種</label>
              <input v-model="basicDraft.desired_role" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">次回面談日</label>
              <input v-model="basicDraft.next_meeting_date" type="date" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500">ネクストアクション</label>
              <input v-model="basicDraft.next_action" type="text" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div class="flex flex-col gap-0.5">
              <label class="text-xs font-medium text-gray-500 font-bold text-blue-600">紹介元学生</label>
              <select v-model="basicDraft.referred_by_id" class="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs font-bold bg-blue-50">
                <option value="">なし（直接流入など）</option>
                <option v-for="s in allStudents.filter(s => s.id !== Number(studentId))" :key="`ref-select-${s.id}`" :value="s.id">
                  {{ s.name }} ({{ s.university || '-' }})
                </option>
              </select>
            </div>
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
    <StatusChangeModal
      v-model="statusModalOpen"
      :studentName="student?.name || ''"
      :eventTitle="statusModalTarget?.title || ''"
      :eventId="statusModalTarget?.id || 0"
      :studentEventId="statusModalTarget?.student_event_id || 0"
      :currentStatus="statusModalTarget?.participation_status || 'A_ENTRY'"
      :source="statusModalTarget?.source"
      @updated="fetchDetail"
    />
  </Layout>
</template>
