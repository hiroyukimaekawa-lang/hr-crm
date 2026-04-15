<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Search,
  Bell,
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
  X,
  ChartColumn,
  TrendingUp,
  Settings,
  History
} from 'lucide-vue-next';
import {
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  type AppNotification
} from '../lib/notifications';
import {
  clearPinnedStudent,
  getPinnedStudent,
  pinnedStudentEventName,
  type PinnedStudent
} from '../lib/pinnedStudent';

const route = useRoute();
const router = useRouter();
const sidebarCollapsed = ref(true);
const mobileSidebarOpen = ref(false);
const notifications = ref<AppNotification[]>([]);
const notificationOpen = ref(false);
const popupNotification = ref<AppNotification | null>(null);
const pinnedStudent = ref<PinnedStudent | null>(null);
const pinnedStudentDetail = ref<any | null>(null);
const pinnedPanelOpen = ref(false);
const initializedNotification = ref(false);
let popupTimer: ReturnType<typeof setTimeout> | null = null;

const user = ref<any>(JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}'));

const syncUser = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await api.get('/api/auth/me', {
      headers: { Authorization: token }
    });
    if (res.data.user) {
      user.value = res.data.user;
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }
  } catch (err) {
    console.error('Failed to sync user profile:', err);
  }
};


const menuItems = computed(() => [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'kpi', label: 'KPI', icon: TrendingUp, path: '/kpi' },
  { id: 'students', label: '学生管理', icon: Users, path: '/students' },
  { id: 'events', label: '案件管理', icon: Calendar, path: '/projects' },
  { id: 'lead-time', label: 'ファネル', icon: ChartColumn, path: '/lead-time' },
  { id: 'settings', label: '設定', icon: Settings, path: '/settings' }
]);

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const isActive = (path: string) => route.path === path || route.path.startsWith(`${path}/`);
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

const refreshNotifications = () => {
  const prevTopId = notifications.value[0]?.id;
  notifications.value = getNotifications();
  const nextTop = notifications.value[0];
  if (initializedNotification.value && nextTop && nextTop.id !== prevTopId) {
    popupNotification.value = nextTop;
    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(() => {
      popupNotification.value = null;
    }, 2800);
  }
  initializedNotification.value = true;
};

const refreshPinnedStudent = () => {
  pinnedStudent.value = getPinnedStudent();
};

const fetchPinnedStudentDetail = async () => {
  if (!pinnedStudent.value) {
    pinnedStudentDetail.value = null;
    return;
  }
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await api.get(`/api/students/${pinnedStudent.value.id}`, {
      headers: { Authorization: token }
    });
    pinnedStudentDetail.value = res.data?.student || null;
  } catch (e) {
    console.error(e);
  }
};

const toggleNotifications = () => {
  notificationOpen.value = !notificationOpen.value;
  if (notificationOpen.value && unreadCount.value > 0) {
    markAllNotificationsRead();
    refreshNotifications();
  }
};

watch(
  () => route.path,
  () => {
    mobileSidebarOpen.value = false;
    notificationOpen.value = false;
  }
);

onMounted(() => {
  syncUser();
  refreshNotifications();
  refreshPinnedStudent();
  window.addEventListener('storage', refreshNotifications);
  window.addEventListener('app-notification-updated', refreshNotifications);
  window.addEventListener('storage', refreshPinnedStudent);
  window.addEventListener(pinnedStudentEventName, refreshPinnedStudent as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('storage', refreshNotifications);
  window.removeEventListener('app-notification-updated', refreshNotifications);
  window.removeEventListener('storage', refreshPinnedStudent);
  window.removeEventListener(pinnedStudentEventName, refreshPinnedStudent as EventListener);
  if (popupTimer) clearTimeout(popupTimer);
});

watch(
  () => pinnedPanelOpen.value,
  (open) => {
    if (open) fetchPinnedStudentDetail();
  }
);
</script>

<template>
  <div class="flex h-screen bg-slate-50 text-gray-900">
    <aside
      class="hidden lg:flex bg-slate-900 text-slate-100 flex-col transition-all duration-200"
      :class="sidebarCollapsed ? 'w-16' : 'w-64'"
    >
      <div class="p-4 border-b border-slate-800" :class="{ 'p-2': sidebarCollapsed }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <div v-if="!sidebarCollapsed">
            <h1 class="font-semibold text-lg">HR CRM</h1>
            <p class="text-xs text-slate-400">案件送客管理</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4 overflow-y-auto" :class="{ 'p-2': sidebarCollapsed }">
        <ul class="space-y-2">
          <li v-for="item in menuItems" :key="item.id">
            <router-link
              :to="item.path"
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors w-full"
              :class="[
                isActive(item.path) ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/60',
                sidebarCollapsed ? 'justify-center px-0' : ''
              ]"
            >
              <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
              <span v-if="!sidebarCollapsed">{{ item.label }}</span>
            </router-link>
          </li>
        </ul>
      </nav>

      <div class="p-4 border-t border-slate-800 mt-auto" :class="{ 'p-2': sidebarCollapsed }">
        <div class="flex items-center gap-3 px-4 py-3" :class="{ 'flex-col px-0': sidebarCollapsed }">
          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span class="text-slate-200 font-semibold">{{ user.name.charAt(0) }}</span>
          </div>
          <div v-if="!sidebarCollapsed" class="flex-1 min-w-0">
            <p class="font-medium text-slate-100 truncate text-sm">{{ user.name }}</p>
            <p class="text-[10px] text-slate-400 uppercase tracking-wider">{{ user.role === 'admin' ? '管理者' : '担当者' }}</p>
          </div>
          <button @click="logout" class="text-slate-400 hover:text-slate-200 h-11 w-11 flex items-center justify-center" title="ログアウト">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- タブレット用サイドバー (md: アイコンのみ) -->
    <aside
      class="hidden md:flex lg:hidden bg-slate-900 text-slate-100 flex-col transition-all duration-200 w-16"
    >
      <div class="p-4 border-b border-slate-800 flex justify-center">
        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
      </div>

      <nav class="flex-1 p-2 space-y-4 pt-6 overflow-y-auto overflow-x-hidden">
        <router-link
          v-for="item in menuItems"
          :key="`tab-${item.id}`"
          :to="item.path"
          class="group relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors mx-auto h-11 w-11"
          :class="isActive(item.path) ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/60'"
        >
          <component :is="item.icon" class="w-6 h-6" />
          <!-- ツールチップ風ラベル -->
          <div class="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1.4 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] font-bold">
            {{ item.label }}
          </div>
        </router-link>
      </nav>

      <div class="p-2 border-t border-slate-800 flex flex-col items-center gap-4 py-4">
        <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
          <span class="text-slate-200 font-semibold">{{ user.name.charAt(0) }}</span>
        </div>
        <button @click="logout" class="text-slate-400 hover:text-slate-200 h-11 w-11 flex items-center justify-center" title="ログアウト">
          <LogOut class="w-5 h-5" />
        </button>
      </div>
    </aside>

    <div
      v-if="mobileSidebarOpen"
      class="fixed inset-0 bg-black/40 z-40 md:hidden"
      @click="mobileSidebarOpen = false"
    />
    <aside
      class="fixed top-0 left-0 h-screen w-72 bg-slate-900 text-slate-100 z-50 transform transition-transform duration-200 md:hidden flex flex-col"
      :class="mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-4 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <div>
            <h1 class="font-semibold text-lg">HR CRM</h1>
            <p class="text-xs text-slate-400">案件送客管理</p>
          </div>
        </div>
        <button class="text-slate-300" @click="mobileSidebarOpen = false">
          <X class="w-5 h-5" />
        </button>
      </div>
      <nav class="flex-1 p-4">
        <ul class="space-y-2">
          <li v-for="item in menuItems" :key="`mobile-${item.id}`">
            <router-link
              :to="item.path"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full"
              :class="isActive(item.path) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'"
            >
              <component :is="item.icon" class="w-5 h-5" />
              <span>{{ item.label }}</span>
            </router-link>
          </li>
        </ul>
      </nav>
      <div class="p-4 border-t border-slate-800">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
            <span class="text-slate-200 font-semibold">{{ user.name.charAt(0) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-100 truncate">{{ user.name }}</p>
            <p class="text-xs text-slate-400">{{ user.role === 'admin' ? '管理者' : '担当者' }}</p>
          </div>
          <button @click="logout" class="text-slate-400 hover:text-slate-200">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header class="h-16 lg:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
        <div class="flex items-center gap-3 w-full max-w-2xl">
          <button class="md:hidden h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200 shadow-sm" @click="mobileSidebarOpen = true">
            <Menu class="w-6 h-6" />
          </button>
          
          <button class="hidden lg:flex h-11 w-11 rounded-xl border border-gray-200 bg-white items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-sm" @click="sidebarCollapsed = !sidebarCollapsed">
            <component :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose" class="w-5 h-5 flex-shrink-0" />
          </button>
          
          <div class="relative flex-1">
            <Search class="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="検索..."
              class="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
        
        <div class="flex items-center gap-2 md:gap-4 ml-4">
          <div class="relative">
            <button class="h-11 w-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors relative" @click="toggleNotifications">
              <Bell class="w-5 h-5" />
              <span v-if="unreadCount > 0" class="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold ring-2 ring-white">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </span>
            </button>
            <div v-if="notificationOpen" class="absolute right-0 mt-3 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[150]">
              <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p class="text-sm font-bold text-gray-900">通知</p>
                <button class="text-xs font-semibold text-gray-500 hover:text-red-600" @click="clearNotifications(); refreshNotifications()">
                  クリア
                </button>
              </div>
              <div class="max-h-80 overflow-y-auto p-2 space-y-1">
                <div v-if="notifications.length === 0" class="py-10 text-sm text-gray-400 text-center">
                  通知はありません
                </div>
                <div v-for="n in notifications" :key="n.id" class="p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <p class="text-sm text-gray-900 leading-relaxed">{{ n.message }}</p>
                  <p class="text-[10px] text-gray-400 mt-2 font-medium">{{ new Date(n.createdAt).toLocaleString('ja-JP') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-auto scroll-smooth pb-20 md:pb-0">
        <slot />
      </main>

      <!-- スマホ用ボトムナビゲーション (sm) -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1.5 flex items-center justify-around z-50 safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <router-link
          v-for="item in menuItems.slice(0, 5)"
          :key="`bottom-${item.id}`"
          :to="item.path"
          class="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors h-14 w-14 justify-center"
          :class="isActive(item.path) ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'"
        >
          <component :is="item.icon" class="w-6 h-6 flex-shrink-0" />
          <span class="text-[10px] font-bold leading-none">{{ item.label.slice(0, 4) }}</span>
        </router-link>
      </nav>

      <div
        v-if="popupNotification"
        class="fixed right-4 top-20 z-[110] max-w-sm rounded-lg shadow-lg border px-4 py-3 text-sm bg-white border-gray-200"
      >
        <p class="text-gray-800">{{ popupNotification.message }}</p>
      </div>

      <div v-if="pinnedStudent" class="fixed right-4 bottom-4 z-[110] flex items-center gap-2">
        <button
          class="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow text-sm text-gray-700 hover:bg-gray-50"
          @click="pinnedPanelOpen = !pinnedPanelOpen"
        >
          {{ pinnedPanelOpen ? '学生パネルを閉じる' : `学生: ${pinnedStudent.name || '固定中'} を表示` }}
        </button>
        <button
          class="px-2 py-2 bg-white border border-gray-200 rounded-lg shadow text-sm text-red-600 hover:bg-red-50"
          @click="clearPinnedStudent(); pinnedPanelOpen = false; pinnedStudentDetail = null"
        >
          解除
        </button>
      </div>

      <div v-if="pinnedStudent && pinnedPanelOpen" class="fixed right-4 bottom-20 z-[110] w-[92vw] max-w-[420px] bg-white border border-gray-200 rounded-xl shadow-xl">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-900">固定した学生</p>
          <button class="text-xs text-blue-600 hover:text-blue-700" @click="router.push(`/students/${pinnedStudent.id}`)">詳細へ</button>
        </div>
        <div class="p-4 text-sm space-y-2">
          <p class="text-gray-900 font-semibold">{{ pinnedStudentDetail?.name || pinnedStudent.name }}</p>
          <p class="text-gray-600">大学: {{ pinnedStudentDetail?.university || '-' }}</p>
          <p class="text-gray-600">流入経路: {{ pinnedStudentDetail?.source_company || '-' }}</p>
          <p class="text-gray-600">面談決定日: {{ pinnedStudentDetail?.meeting_decided_date || '-' }}</p>
          <p class="text-gray-600">初回面談日: {{ pinnedStudentDetail?.first_interview_date || '-' }}</p>
          <p class="text-gray-600">次回面談日: {{ pinnedStudentDetail?.next_meeting_date || '-' }}</p>
          <p class="text-gray-600">ネクストアクション: {{ pinnedStudentDetail?.next_action || '-' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
