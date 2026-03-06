<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import Layout from '../components/Layout.vue';
import { pushNotification } from '../lib/notifications';
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
  prefecture?: string;
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
  meeting_decided_date?: string | null;
  first_interview_date?: string | null;
}

const INVALID_SOURCE_COMPANY_VALUES = new Set(['初回平均(日)', '氏名', '流入経路', 'source_company']);

interface StaffUser {
  id: number;
  name: string;
}

interface SourceCategory {
  id: number;
  name: string;
}

interface EventMaster {
  id: number;
  event_name: string;
  event_date?: string | null;
  company?: string | null;
}

interface LostReason {
  id: number;
  reason_name: string;
}

type ExportColumnKey =
  | 'source_company'
  | 'name'
  | 'university'
  | 'progress_stage'
  | 'prefecture'
  | 'academic_track'
  | 'graduation_year'
  | 'staff_name'
  | 'referral_status'
  | 'next_meeting_date'
  | 'task_due_date';

const exportColumnOptions: Array<{ key: ExportColumnKey; label: string }> = [
  { key: 'source_company', label: '流入経路' },
  { key: 'name', label: '氏名' },
  { key: 'university', label: '大学' },
  { key: 'progress_stage', label: '進捗' },
  { key: 'prefecture', label: '所在地' },
  { key: 'academic_track', label: '文理' },
  { key: 'graduation_year', label: '卒業年度' },
  { key: 'staff_name', label: '担当' },
  { key: 'referral_status', label: 'ステータス' },
  { key: 'next_meeting_date', label: '次回面談日' },
  { key: 'task_due_date', label: 'タスク履行日' }
];

const students = ref<Student[]>([]);
const staffUsers = ref<StaffUser[]>([]);
const sourceCategories = ref<SourceCategory[]>([]);
const funnelEvents = ref<EventMaster[]>([]);
const lostReasons = ref<LostReason[]>([]);
const funnelKpi = ref({
  daily_applications: [] as Array<{ day: string; count: number }>,
  application_to_reservation_rate: 0,
  reservation_to_interview_rate: 0,
  interview_to_proposal_rate: 0,
  proposal_to_join_rate: 0,
  lost_reason_ranking: [] as Array<{ reason_name: string; count: number }>
});
const router = useRouter();
const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');
const showAll = ref(user.role === 'admin');
const selectedExportColumns = ref<ExportColumnKey[]>(exportColumnOptions.map(c => c.key));
const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const selectedNames = ref<string[]>([]);
const selectedUniversities = ref<string[]>([]);
const selectedSourceCompanies = ref<string[]>([]);
const selectedPrefectures = ref<string[]>([]);
const nameSearch = ref('');
const universitySearch = ref('');
const staffFilter = ref('ALL');
const academicTrackFilter = ref('ALL');
const referralStatusFilter = ref('ALL');
const progressStageFilter = ref('ALL');
const graduationYearFilter = ref('ALL');
const nextMeetingDateFrom = ref('');
const nextMeetingDateTo = ref('');
const taskDueDateFrom = ref('');
const taskDueDateTo = ref('');
const currentPage = ref(1);
const pageSize = 50;
const isDesktop = ref(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
const isTablet = ref(typeof window !== 'undefined' ? (window.innerWidth >= 768 && window.innerWidth < 1024) : false);
const filterPanelOpen = ref(!isTablet.value);

const appliedFilters = ref({
  selectedNames: [] as string[],
  selectedUniversities: [] as string[],
  selectedSourceCompanies: [] as string[],
  selectedPrefectures: [] as string[],
  staffFilter: 'ALL',
  academicTrackFilter: 'ALL',
  referralStatusFilter: 'ALL',
  progressStageFilter: 'ALL',
  graduationYearFilter: 'ALL',
  nextMeetingDateFrom: '',
  nextMeetingDateTo: '',
  taskDueDateFrom: '',
  taskDueDateTo: ''
});

const showCreate = ref(false);
const showFunnel = ref(false);
const createError = ref('');
const funnelError = ref('');
const isCreatingStudent = ref(false);
const selectedFunnelStudent = ref<Student | null>(null);
const newStudent = ref({
  source_company: '',
  name: '',
  university: '',
  faculty: '',
  interview_reason: '',
  staff_id: '',
  meeting_decided_date: '',
  first_interview_date: '',
  prefecture: '',
  academic_track: '',
  graduation_year: ''
});
const funnelForm = ref({
  source: '',
  applied_at: '',
  reservation_date: '',
  interview_scheduled_at: '',
  interview_interviewed_at: '',
  interview_status: 'completed',
  event_id: '',
  proposal_status: 'proposed',
  lost_reason_id: '',
  memo: ''
});

const toDateTimeHour = (value?: string | null) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T10:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 16);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:00`;
};

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

const fetchSourceCategories = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/students/source-categories', { headers: { Authorization: token } });
    sourceCategories.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error(err);
  }
};

const fetchFunnelMaster = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/students/funnel/master', { headers: { Authorization: token } });
    funnelEvents.value = Array.isArray(res.data?.events) ? res.data.events : [];
    lostReasons.value = Array.isArray(res.data?.lost_reasons) ? res.data.lost_reasons : [];
  } catch (err) {
    console.error(err);
  }
};

const fetchFunnelKpi = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/api/students/metrics/funnel', { headers: { Authorization: token } });
    funnelKpi.value = {
      daily_applications: Array.isArray(res.data?.daily_applications) ? res.data.daily_applications : [],
      application_to_reservation_rate: Number(res.data?.application_to_reservation_rate || 0),
      reservation_to_interview_rate: Number(res.data?.reservation_to_interview_rate || 0),
      interview_to_proposal_rate: Number(res.data?.interview_to_proposal_rate || 0),
      proposal_to_join_rate: Number(res.data?.proposal_to_join_rate || 0),
      lost_reason_ranking: Array.isArray(res.data?.lost_reason_ranking) ? res.data.lost_reason_ranking : []
    };
  } catch (err) {
    console.error(err);
  }
};

const openFunnelModal = (student: Student) => {
  selectedFunnelStudent.value = student;
  funnelError.value = '';
  funnelForm.value = {
    source: normalizeSourceCompany(student.source_company) || '',
    applied_at: toDateTimeHour(student.meeting_decided_date),
    reservation_date: toDateTimeHour(student.meeting_decided_date),
    interview_scheduled_at: toDateTimeHour(student.first_interview_date),
    interview_interviewed_at: '',
    interview_status: 'completed',
    event_id: '',
    proposal_status: 'proposed',
    lost_reason_id: '',
    memo: ''
  };
  showFunnel.value = true;
};

const submitApplication = async () => {
  if (!selectedFunnelStudent.value) return;
  try {
    const token = localStorage.getItem('token');
    await api.post(`/api/students/${selectedFunnelStudent.value.id}/funnel/application`, {
      source: funnelForm.value.source || null,
      applied_at: funnelForm.value.applied_at || null
    }, { headers: { Authorization: token } });
    await fetchFunnelKpi();
    showToast('申込登録を保存しました。', 'success');
  } catch (err: any) {
    funnelError.value = err?.response?.data?.error || '申込登録に失敗しました。';
    showToast(funnelError.value, 'error');
  }
};

const submitReservation = async () => {
  if (!selectedFunnelStudent.value) return;
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${selectedFunnelStudent.value.id}/funnel/reservation`, {
      reservation_status: '初回面談',
      reservation_date: funnelForm.value.reservation_date || null
    }, { headers: { Authorization: token } });
    if (!funnelForm.value.interview_scheduled_at && funnelForm.value.reservation_date) {
      funnelForm.value.interview_scheduled_at = funnelForm.value.reservation_date;
    }
    await fetchFunnelKpi();
    showToast('予約登録を保存しました。', 'success');
  } catch (err: any) {
    funnelError.value = err?.response?.data?.error || '予約登録に失敗しました。';
    showToast(funnelError.value, 'error');
  }
};

const submitInterview = async () => {
  if (!selectedFunnelStudent.value) return;
  try {
    const token = localStorage.getItem('token');
    await api.post(`/api/students/${selectedFunnelStudent.value.id}/funnel/interview`, {
      scheduled_at: funnelForm.value.interview_scheduled_at || null,
      interviewed_at: funnelForm.value.interview_interviewed_at || null,
      status: funnelForm.value.interview_status || 'completed'
    }, { headers: { Authorization: token } });
    await fetchFunnelKpi();
    showToast('面談実施登録を保存しました。', 'success');
  } catch (err: any) {
    funnelError.value = err?.response?.data?.error || '面談実施登録に失敗しました。';
    showToast(funnelError.value, 'error');
  }
};

const submitProposal = async () => {
  if (!selectedFunnelStudent.value) return;
  if (!funnelForm.value.event_id) {
    showToast('イベントを選択してください。', 'error');
    return;
  }
  try {
    const token = localStorage.getItem('token');
    await api.post(`/api/students/${selectedFunnelStudent.value.id}/funnel/event-proposal`, {
      event_id: Number(funnelForm.value.event_id),
      status: funnelForm.value.proposal_status || 'proposed',
      lost_reason_id: funnelForm.value.lost_reason_id ? Number(funnelForm.value.lost_reason_id) : null,
      memo: funnelForm.value.memo || null
    }, { headers: { Authorization: token } });
    await fetchFunnelKpi();
    showToast('イベント提案登録を保存しました。', 'success');
  } catch (err: any) {
    funnelError.value = err?.response?.data?.error || 'イベント提案登録に失敗しました。';
    showToast(funnelError.value, 'error');
  }
};

const updateStaff = async (studentId: number, staffId: number | null) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId}/staff`, {
      staff_id: staffId
    }, { headers: { Authorization: token } });
    const selected = staffUsers.value.find((u) => u.id === staffId);
    students.value = students.value.map((s) => (
      s.id === studentId
        ? { ...s, staff_id: staffId, staff_name: selected?.name }
        : s
    ));
  } catch (err) {
    console.error(err);
  }
};

const referralStatusOptions = ['キーマン', '出そう', 'ほぼ無理ワンチャン', '無理', '不明'];
const progressStageOptions = ['面談調整中', '初回面談', '2回目面談', '顧客化', 'トビ'];

const updateStudentMeta = async (studentId: number, payload: { referral_status?: string; progress_stage?: string; source_company?: string; next_meeting_date?: string | null; next_action?: string | null }) => {
  try {
    const token = localStorage.getItem('token');
    await api.put(`/api/students/${studentId}/meta`, payload, { headers: { Authorization: token } });
    students.value = students.value.map((s) => (
      s.id === studentId ? { ...s, ...payload } : s
    ));
  } catch (err) {
    console.error(err);
  }
};

const normalizeSourceCompany = (value?: string | null) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return INVALID_SOURCE_COMPANY_VALUES.has(v) ? '' : v;
};

const deleteStudent = async (studentId: number) => {
  if (!confirm('この学生を削除しますか？')) return;
  try {
    const token = localStorage.getItem('token');
    await api.delete(`/api/students/${studentId}`, { headers: { Authorization: token } });
    students.value = students.value.filter((s) => s.id !== studentId);
  } catch (err) {
    console.error(err);
  }
};

const createStudent = async () => {
  if (isCreatingStudent.value) return;
  try {
    isCreatingStudent.value = true;
    createError.value = '';
    if (!newStudent.value.name.trim()) {
      createError.value = '氏名は必須です。';
      showToast(createError.value, 'error');
      return;
    }
    showToast('学生登録を受け付けました。', 'success');
    const token = localStorage.getItem('token');
    const assignedStaffId = user.role === 'admin'
      ? (newStudent.value.staff_id ? Number(newStudent.value.staff_id) : null)
      : Number(user.id);

    await api.post('/api/students', {
      source_company: newStudent.value.source_company,
      name: newStudent.value.name,
      university: newStudent.value.university,
      faculty: newStudent.value.faculty || null,
      interview_reason: newStudent.value.interview_reason || null,
      meeting_decided_date: newStudent.value.meeting_decided_date || null,
      first_interview_date: newStudent.value.first_interview_date || null,
      prefecture: newStudent.value.prefecture || null,
      academic_track: newStudent.value.academic_track || null,
      graduation_year: newStudent.value.graduation_year ? Number(newStudent.value.graduation_year) : null,
      staff_id: assignedStaffId
    }, { headers: { Authorization: token } });

    showCreate.value = false;
    newStudent.value = {
      source_company: '',
      name: '',
      university: '',
      faculty: '',
      interview_reason: '',
      staff_id: '',
      meeting_decided_date: '',
      first_interview_date: '',
      prefecture: '',
      academic_track: '',
      graduation_year: ''
    };
    clearFilters();
    await fetchStudents();
    showToast('学生登録が完了しました。', 'success');
  } catch (err: any) {
    console.error(err);
    if (err?.response?.status === 409) {
      createError.value = '同じ「氏名 + 大学 + 学部」の学生がすでに存在します。';
    } else {
      createError.value = err?.response?.data?.error || '学生登録に失敗しました。入力内容を確認してください。';
    }
    showToast(createError.value, 'error');
  } finally {
    isCreatingStudent.value = false;
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
  const normalizeDate = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const raw = String(value);
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  };

  return students.value.filter(s => {
    const af = appliedFilters.value;
    const matchesName =
      af.selectedNames.length === 0 ||
      af.selectedNames.includes(s.name || '');
    const matchesUniversity =
      af.selectedUniversities.length === 0 ||
      af.selectedUniversities.includes(s.university || '');
    const matchesStaff =
      af.staffFilter === 'ALL' ||
      String(s.staff_id || '') === af.staffFilter;
    const matchesSourceCompany =
      af.selectedSourceCompanies.length === 0 ||
      af.selectedSourceCompanies.includes(normalizeSourceCompany(s.source_company));
    const matchesPrefecture =
      af.selectedPrefectures.length === 0 ||
      af.selectedPrefectures.includes(s.prefecture || '');
    const matchesAcademicTrack =
      af.academicTrackFilter === 'ALL' ||
      (s.academic_track || '') === af.academicTrackFilter;
    const matchesReferral =
      af.referralStatusFilter === 'ALL' ||
      (s.referral_status || '不明') === af.referralStatusFilter;
    const matchesProgress =
      af.progressStageFilter === 'ALL' ||
      (s.progress_stage || '面談調整中') === af.progressStageFilter;
    const matchesGraduationYear =
      af.graduationYearFilter === 'ALL' ||
      String(s.graduation_year || '') === af.graduationYearFilter;
    const nextMeetingDate = normalizeDate(s.next_meeting_date);
    const matchesNextMeetingDate =
      (!af.nextMeetingDateFrom || (nextMeetingDate && nextMeetingDate >= af.nextMeetingDateFrom)) &&
      (!af.nextMeetingDateTo || (nextMeetingDate && nextMeetingDate <= af.nextMeetingDateTo));
    const taskDueDate = normalizeDate(s.latest_task_due_date);
    const matchesTaskDueDate =
      (!af.taskDueDateFrom || (taskDueDate && taskDueDate >= af.taskDueDateFrom)) &&
      (!af.taskDueDateTo || (taskDueDate && taskDueDate <= af.taskDueDateTo));
    return matchesName
      && matchesUniversity
      && matchesStaff
      && matchesSourceCompany
      && matchesPrefecture
      && matchesAcademicTrack
      && matchesGraduationYear
      && matchesReferral
      && matchesProgress
      && matchesNextMeetingDate
      && matchesTaskDueDate;
  });
});

const totalFilteredCount = computed(() => filteredStudents.value.length);
const totalPages = computed(() => Math.max(1, Math.ceil(totalFilteredCount.value / pageSize)));
const pagedStudents = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredStudents.value.slice(start, start + pageSize);
});

const sourceCompanyOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => {
    const val = normalizeSourceCompany(s.source_company);
    if (val) set.add(val);
  });
  return Array.from(set);
});

const prefectureOptions = computed(() => {
  const set = new Set<string>();
  students.value.forEach(s => s.prefecture && set.add(s.prefecture));
  return Array.from(set);
});

const applyFilters = () => {
  appliedFilters.value = {
    selectedNames: [...selectedNames.value],
    selectedUniversities: [...selectedUniversities.value],
    selectedSourceCompanies: [...selectedSourceCompanies.value],
    selectedPrefectures: [...selectedPrefectures.value],
    staffFilter: staffFilter.value,
    academicTrackFilter: academicTrackFilter.value,
    referralStatusFilter: referralStatusFilter.value,
    progressStageFilter: progressStageFilter.value,
    graduationYearFilter: graduationYearFilter.value,
    nextMeetingDateFrom: nextMeetingDateFrom.value,
    nextMeetingDateTo: nextMeetingDateTo.value,
    taskDueDateFrom: taskDueDateFrom.value,
    taskDueDateTo: taskDueDateTo.value
  };
  currentPage.value = 1;
};

const clearFilters = () => {
  selectedNames.value = [];
  selectedUniversities.value = [];
  selectedSourceCompanies.value = [];
  selectedPrefectures.value = [];
  nameSearch.value = '';
  universitySearch.value = '';
  staffFilter.value = 'ALL';
  academicTrackFilter.value = 'ALL';
  referralStatusFilter.value = 'ALL';
  progressStageFilter.value = 'ALL';
  graduationYearFilter.value = 'ALL';
  nextMeetingDateFrom.value = '';
  nextMeetingDateTo.value = '';
  taskDueDateFrom.value = '';
  taskDueDateTo.value = '';
  applyFilters();
};

const goPrevPage = () => {
  if (currentPage.value > 1) currentPage.value -= 1;
};

const goNextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value += 1;
};

const handleResize = () => {
  isDesktop.value = window.innerWidth >= 1024;
  isTablet.value = window.innerWidth >= 768 && window.innerWidth < 1024;
  if (!isTablet.value) {
    filterPanelOpen.value = true;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ja-JP');
};

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = message;
  toastType.value = type;
  pushNotification(message, type === 'success' ? 'success' : 'error');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
};

const downloadCsv = () => {
  if (selectedExportColumns.value.length === 0) {
    showToast('出力項目を1つ以上選択してください。', 'error');
    return;
  }
  const header = exportColumnOptions
    .filter(c => selectedExportColumns.value.includes(c.key))
    .map(c => c.label);

  const getValue = (s: Student, key: ExportColumnKey) => {
    switch (key) {
      case 'source_company': return normalizeSourceCompany(s.source_company) || '';
      case 'name': return s.name || '';
      case 'university': return s.university || '';
      case 'progress_stage': return s.progress_stage || '面談調整中';
      case 'prefecture': return s.prefecture || '';
      case 'academic_track': return s.academic_track || '';
      case 'graduation_year': return s.graduation_year || '';
      case 'staff_name': return s.staff_name || '';
      case 'referral_status': return s.referral_status || '不明';
      case 'next_meeting_date': return s.next_meeting_date || '';
      case 'task_due_date': return s.latest_task_due_date || '';
      default: return '';
    }
  };

  const csv = [
    header.join(','),
    ...filteredStudents.value.map(s =>
      selectedExportColumns.value
        .map(col => `"${String(getValue(s, col)).replace(/\"/g, '""')}"`)
        .join(',')
    )
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'students.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV出力が完了しました。', 'success');
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

  const getValByKeys = (row: string[], keys: string[]) => {
    for (const key of keys) {
      const value = getVal(row, key);
      if (value !== '') return value;
    }
    return '';
  };

  const items = rows.slice(1).map(r => ({
    source_company: getValByKeys(r, ['流入経路']).trim(),
    name: getValByKeys(r, ['氏名']).trim(),
    university: getValByKeys(r, ['大学']).trim(),
    progress_stage: (getValByKeys(r, ['進捗']).trim() || '面談調整中'),
    prefecture: getValByKeys(r, ['所在地', '所在地（都道府県）', '都道府県']).trim(),
    academic_track: getValByKeys(r, ['文理']).trim(),
    graduation_year: getValByKeys(r, ['卒業年度', '卒業年']).trim(),
    staff_name: getValByKeys(r, ['担当']).trim(),
    referral_status: (getValByKeys(r, ['ステータス']).trim() || '不明'),
    next_meeting_date: getValByKeys(r, ['次回面談日']).trim(),
    task_due_date: getValByKeys(r, ['タスク履行日']).trim()
  })).filter(i => i.name || i.university);

  const staffMap = new Map(staffUsers.value.map(s => [s.name, s.id]));
  const payload = items.map(i => ({
    name: i.name,
    university: i.university,
    prefecture: i.prefecture || null,
    academic_track: i.academic_track || null,
    graduation_year: i.graduation_year || null,
    staff_id: staffMap.get(i.staff_name) || null,
    source_company: i.source_company,
    referral_status: i.referral_status,
    progress_stage: i.progress_stage,
    next_meeting_date: i.next_meeting_date || null,
    task_due_date: i.task_due_date || null
  }));

  const token = localStorage.getItem('token');
  const res = await api.post('/api/students/import', {
    students: payload
  }, { headers: { Authorization: token } });

  fetchStudents();
  showToast(`CSV入力完了: 追加${res.data?.inserted || 0}件 / 更新${res.data?.updated || 0}件 / スキップ${res.data?.skipped || 0}件`, 'success');
};

const onCsvFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    await importCsv(file);
  } catch (err) {
    console.error(err);
    showToast('CSV入力に失敗しました。形式を確認してください。', 'error');
  }
  target.value = '';
};

onMounted(() => {
  fetchStudents();
  fetchSourceCategories();
  fetchFunnelMaster();
  fetchFunnelKpi();
  if (user.role === 'admin') {
    fetchStaffUsers();
  }
  window.addEventListener('resize', handleResize, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

watch(filteredStudents, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
});
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">学生一覧</h1>
          <p class="text-gray-500 mt-2">登録されている学生の情報を管理・確認できます。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <details class="relative">
            <summary class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer text-sm">
              出力項目を選択
            </summary>
            <div class="absolute right-0 z-20 mt-1 w-64 max-h-72 overflow-auto bg-white border border-gray-200 rounded-lg shadow p-2">
              <label
                v-for="col in exportColumnOptions"
                :key="`export-col-${col.key}`"
                class="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded"
              >
                <input
                  v-model="selectedExportColumns"
                  :value="col.key"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </details>
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
            @click="createError = ''; showCreate = true"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <UserPlus class="w-4 h-4" />
            学生登録
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p class="text-xs text-gray-500">申込→予約率</p>
          <p class="text-lg font-semibold text-gray-900">{{ funnelKpi.application_to_reservation_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p class="text-xs text-gray-500">予約→面談率</p>
          <p class="text-lg font-semibold text-gray-900">{{ funnelKpi.reservation_to_interview_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p class="text-xs text-gray-500">面談→イベント提案率</p>
          <p class="text-lg font-semibold text-gray-900">{{ funnelKpi.interview_to_proposal_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p class="text-xs text-gray-500">提案→参加率</p>
          <p class="text-lg font-semibold text-gray-900">{{ funnelKpi.proposal_to_join_rate.toFixed(2) }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p class="text-xs text-gray-500 mb-1">失注理由ランキング</p>
          <p class="text-xs text-gray-700" v-if="funnelKpi.lost_reason_ranking.length === 0">データなし</p>
          <ul v-else class="text-xs text-gray-700 space-y-0.5">
            <li v-for="r in funnelKpi.lost_reason_ranking.slice(0, 3)" :key="`lost-${r.reason_name}`">{{ r.reason_name }}: {{ r.count }}</li>
          </ul>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">日別申込数（直近31日）</h3>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[360px] text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-gray-500">日付</th>
                <th class="px-3 py-2 text-right text-gray-500">申込数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="d in funnelKpi.daily_applications" :key="`daily-${d.day}`">
                <td class="px-3 py-2 text-gray-700">{{ formatDate(d.day) }}</td>
                <td class="px-3 py-2 text-right text-gray-900">{{ d.count }}</td>
              </tr>
              <tr v-if="funnelKpi.daily_applications.length === 0">
                <td class="px-3 py-3 text-gray-400 text-center" colSpan="2">データがありません</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-col gap-4">
        <div class="hidden md:flex lg:hidden items-center justify-between">
          <p class="text-sm font-medium text-gray-700">フィルタ</p>
          <button
            class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            @click="filterPanelOpen = !filterPanelOpen"
          >
            {{ filterPanelOpen ? '閉じる' : '開く' }}
          </button>
        </div>
        <template v-if="!isTablet || filterPanelOpen">
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
              <details class="relative">
                <summary class="list-none px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer bg-white">
                  流入経路: {{ selectedSourceCompanies.length ? `${selectedSourceCompanies.length}件` : 'すべて' }}
                </summary>
                <div class="absolute z-20 mt-1 w-64 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow">
                  <label v-for="v in sourceCompanyOptions" :key="`source-${v}`" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" :value="v" v-model="selectedSourceCompanies" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>{{ v }}</span>
                  </label>
                  <div v-if="sourceCompanyOptions.length === 0" class="px-3 py-2 text-xs text-gray-400">候補がありません</div>
                </div>
              </details>
              <details class="relative">
                <summary class="list-none px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer bg-white">
                  所在地: {{ selectedPrefectures.length ? `${selectedPrefectures.length}件` : 'すべて' }}
                </summary>
                <div class="absolute z-20 mt-1 w-56 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow">
                  <label v-for="v in prefectureOptions" :key="`pref-${v}`" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" :value="v" v-model="selectedPrefectures" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>{{ v }}</span>
                  </label>
                  <div v-if="prefectureOptions.length === 0" class="px-3 py-2 text-xs text-gray-400">候補がありません</div>
                </div>
              </details>
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
                v-model="progressStageFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">進捗: すべて</option>
                <option v-for="s in progressStageOptions" :key="s" :value="s">{{ s }}</option>
              </select>
              <select
                v-model="graduationYearFilter"
                class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="g in graduationYearOptions" :key="g" :value="g">
                  {{ g === 'ALL' ? '卒業年度: すべて' : `${g}年` }}
                </option>
              </select>
              <div class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
                <span class="text-sm text-gray-600 whitespace-nowrap">面談日</span>
                <input
                  v-model="nextMeetingDateFrom"
                  type="date"
                  class="px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-gray-400">〜</span>
                <input
                  v-model="nextMeetingDateTo"
                  type="date"
                  class="px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
                <span class="text-sm text-gray-600 whitespace-nowrap">タスク履行日</span>
                <input
                  v-model="taskDueDateFrom"
                  type="date"
                  class="px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-gray-400">〜</span>
                <input
                  v-model="taskDueDateTo"
                  type="date"
                  class="px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
        </div>
        <label v-if="user.role === 'admin'" class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" v-model="showAll" @change="fetchStudents" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          全学生を表示
        </label>
        <div class="flex flex-col sm:flex-row gap-2 justify-end">
          <button
            @click="applyFilters"
            class="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 border border-blue-600 hover:bg-blue-700"
          >
            検索
          </button>
          <button
            @click="clearFilters"
            class="px-3 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50"
          >
            フィルタクリア
          </button>
        </div>
        </template>
      </div>

      <div
        v-if="toastMessage"
        class="fixed right-4 bottom-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm"
        :class="toastType === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'"
      >
        {{ toastMessage }}
      </div>

      <div v-if="!isDesktop" class="space-y-3">
        <div v-for="s in pagedStudents" :key="`mobile-${s.id}`" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
              <p class="text-gray-700">{{ normalizeSourceCompany(s.source_company) || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">所在地</p>
              <p class="text-gray-700">{{ s.prefecture || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">文理</p>
              <p class="text-gray-700">{{ s.academic_track || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">進捗</p>
              <p class="text-gray-700">{{ s.progress_stage || '面談調整中' }}</p>
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
            <p class="block text-xs text-gray-500">ステータス(打診)</p>
            <select
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.referral_status || '不明'"
              @change="updateStudentMeta(s.id, { referral_status: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="v in referralStatusOptions" :key="`mobile-ref-${s.id}-${v}`" :value="v">{{ v }}</option>
            </select>
            <p class="block text-xs text-gray-500">進捗</p>
            <select
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.progress_stage || '初回面談'"
              @change="updateStudentMeta(s.id, { progress_stage: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="v in progressStageOptions" :key="`mobile-prog-${s.id}-${v}`" :value="v">{{ v }}</option>
            </select>
            <p class="block text-xs text-gray-500">次回面談日</p>
            <input
              type="date"
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.next_meeting_date || ''"
              @change="updateStudentMeta(s.id, { next_meeting_date: ($event.target as HTMLInputElement).value || null })"
            />
            <p class="block text-xs text-gray-500">ネクストアクション</p>
            <input
              type="text"
              class="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs"
              :value="s.next_action || ''"
              @blur="updateStudentMeta(s.id, { next_action: ($event.target as HTMLInputElement).value || null })"
              placeholder="次にやること"
            />
            <div v-if="user.role === 'admin'">
              <p class="block text-xs text-gray-500 mb-1">担当</p>
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
            <div class="flex items-center gap-2">
              <button
                class="text-blue-600 hover:text-blue-800 text-sm font-semibold inline-flex items-center gap-1"
                @click="router.push(`/students/${s.id}`)"
              >
                詳細
                <ChevronRight class="w-4 h-4" />
              </button>
              <button
                class="px-2 py-1 text-xs border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-50"
                @click="openFunnelModal(s)"
              >
                ファネル登録
              </button>
            </div>
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
        <div v-if="totalFilteredCount === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          該当する学生が見つかりませんでした。
        </div>
      </div>

      <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table class="w-full min-w-[1100px]">
          <thead class="bg-gray-50 border-b border-gray-200 text-xs">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">流入経路</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">氏名</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">大学</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">進捗</th>
              <th class="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">所在地</th>
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
            <tr v-for="s in pagedStudents" :key="s.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{{ normalizeSourceCompany(s.source_company) || '-' }}</td>
              <td class="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{{ s.name }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{{ s.university }}</td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                <select
                  class="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs"
                  :value="s.progress_stage || '面談調整中'"
                  @change="updateStudentMeta(s.id, { progress_stage: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="v in progressStageOptions" :key="`desktop-prog-${s.id}-${v}`" :value="v">{{ v }}</option>
                </select>
              </td>
              <td class="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{{ s.prefecture || '-' }}</td>
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
                  class="ml-2 px-2 py-1 border border-indigo-200 text-indigo-700 rounded text-xs hover:bg-indigo-50"
                  @click="openFunnelModal(s)"
                >
                  ファネル登録
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
            <tr v-if="totalFilteredCount === 0">
              <td colSpan="12" class="px-6 py-10 text-center text-sm text-gray-400">
                該当する学生が見つかりませんでした。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="totalFilteredCount > 0" class="mt-3 flex items-center justify-between text-sm text-gray-600">
        <p>{{ totalFilteredCount }}件中 {{ (currentPage - 1) * pageSize + 1 }}〜{{ Math.min(currentPage * pageSize, totalFilteredCount) }}件を表示</p>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            :disabled="currentPage <= 1"
            @click="goPrevPage"
          >
            前へ
          </button>
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            :disabled="currentPage >= totalPages"
            @click="goNextPage"
          >
            次へ
          </button>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]">
        <div class="bg-white rounded-xl shadow-xl w-[95vw] md:w-[88vw] lg:w-[80vw] max-w-4xl h-[85vh] md:h-[80vh] overflow-y-auto p-4 md:p-6">
          <h2 class="text-xl font-bold mb-4 text-gray-900">新規学生登録</h2>
          <p v-if="createError" class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ createError }}
          </p>
          <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">流入経路</label>
            <input
              v-model="newStudent.source_company"
              list="source-category-options"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="流入経路を選択/入力"
            >
            <datalist id="source-category-options">
              <option v-for="c in sourceCategories" :key="`source-cat-${c.id}`" :value="c.name" />
            </datalist>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">学部</label>
            <input v-model="newStudent.faculty" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">面談理由</label>
            <select v-model="newStudent.interview_reason" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">未設定</option>
              <option value="企業相談">企業相談</option>
              <option value="就活相談">就活相談</option>
              <option value="面接対策">面接対策</option>
            </select>
          </div>
          <div v-if="user.role === 'admin'">
            <label class="block text-sm font-medium text-gray-700 mb-1">担当</label>
            <select v-model="newStudent.staff_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">未割当</option>
              <option v-for="u in staffUsers" :key="`create-staff-${u.id}`" :value="String(u.id)">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">面談決定日</label>
            <input v-model="newStudent.meeting_decided_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">初回面談日</label>
            <input v-model="newStudent.first_interview_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">所在地（都道府県）</label>
            <input v-model="newStudent.prefecture" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
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
            <label class="block text-sm font-medium text-gray-700 mb-1">卒業年</label>
            <input v-model="newStudent.graduation_year" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
          <div class="mt-6 flex justify-end gap-3">
            <button @click="createError = ''; showCreate = false" :disabled="isCreatingStudent" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">キャンセル</button>
            <button @click="createStudent" :disabled="isCreatingStudent" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isCreatingStudent ? '登録中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="showFunnel && selectedFunnelStudent" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[90]">
        <div class="w-full max-w-3xl bg-white rounded-xl shadow-xl p-4 md:p-6 max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-900">面談ファネル登録: {{ selectedFunnelStudent.name }}</h2>
            <button class="text-sm text-gray-500 hover:text-gray-700" @click="showFunnel = false">閉じる</button>
          </div>
          <p v-if="funnelError" class="mb-3 text-sm text-red-600">{{ funnelError }}</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="border border-gray-200 rounded-lg p-3">
              <h3 class="font-semibold text-sm mb-2">1) 申込登録</h3>
              <label class="block text-xs text-gray-600 mb-1">流入元</label>
              <input v-model="funnelForm.source" type="text" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
              <label class="block text-xs text-gray-600 mb-1">申込日</label>
              <input v-model="funnelForm.applied_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
              <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" @click="submitApplication">申込登録</button>
            </div>

            <div class="border border-gray-200 rounded-lg p-3">
              <h3 class="font-semibold text-sm mb-2">2) 予約登録</h3>
              <label class="block text-xs text-gray-600 mb-1">予約ステータス</label>
              <input value="初回面談" type="text" disabled class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2 bg-gray-50 text-gray-600">
              <label class="block text-xs text-gray-600 mb-1">予約日</label>
              <input v-model="funnelForm.reservation_date" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
              <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" @click="submitReservation">予約登録</button>
            </div>

            <div class="border border-gray-200 rounded-lg p-3">
              <h3 class="font-semibold text-sm mb-2">3) 面談実施登録</h3>
              <label class="block text-xs text-gray-600 mb-1">面談予定日</label>
              <input v-model="funnelForm.interview_scheduled_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
              <label class="block text-xs text-gray-600 mb-1">面談実施日</label>
              <input v-model="funnelForm.interview_interviewed_at" type="datetime-local" step="3600" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
              <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" @click="submitInterview">面談実施登録</button>
            </div>

            <div class="border border-gray-200 rounded-lg p-3">
              <h3 class="font-semibold text-sm mb-2">4) イベント提案登録</h3>
              <label class="block text-xs text-gray-600 mb-1">イベント</label>
              <select v-model="funnelForm.event_id" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
                <option value="">選択してください</option>
                <option v-for="e in funnelEvents" :key="`funnel-ev-${e.id}`" :value="String(e.id)">
                  {{ e.event_name }}（{{ formatDate(e.event_date || '') }}）
                </option>
              </select>
              <label class="block text-xs text-gray-600 mb-1">提案ステータス</label>
              <select v-model="funnelForm.proposal_status" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
                <option value="proposed">提案済み</option>
                <option value="joined">参加</option>
                <option value="lost">失注</option>
              </select>
              <label class="block text-xs text-gray-600 mb-1">失注理由</label>
              <select v-model="funnelForm.lost_reason_id" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2">
                <option value="">未選択</option>
                <option v-for="r in lostReasons" :key="`lost-r-${r.id}`" :value="String(r.id)">{{ r.reason_name }}</option>
              </select>
              <label class="block text-xs text-gray-600 mb-1">メモ</label>
              <textarea v-model="funnelForm.memo" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" />
              <button class="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" @click="submitProposal">イベント提案登録</button>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </Layout>
</template>
