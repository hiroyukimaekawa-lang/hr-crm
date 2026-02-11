<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  X
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const sidebarCollapsed = ref(true);
const mobileSidebarOpen = ref(false);

const user = JSON.parse(localStorage.getItem('user') || '{"id": 1, "name": "Admin (Trial)", "role": "admin"}');

const menuItems = computed(() => [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'students', label: '学生一覧', icon: Users, path: '/students' },
  { id: 'events', label: 'イベント一覧', icon: Calendar, path: '/events' }
]);

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const isActive = (path: string) => route.path === path || route.path.startsWith(`${path}/`);

watch(
  () => route.path,
  () => {
    mobileSidebarOpen.value = false;
  }
);
</script>

<template>
  <div class="flex h-screen bg-slate-50 text-gray-900">
    <aside
      class="hidden md:flex bg-slate-900 text-slate-100 flex-col transition-all duration-200"
      :class="sidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div class="p-4 border-b border-slate-800">
        <div class="flex items-center gap-3" :class="sidebarCollapsed ? 'justify-center' : ''">
          <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <div v-if="!sidebarCollapsed">
            <h1 class="font-semibold text-lg">HR CRM</h1>
            <p class="text-xs text-slate-400">イベント送客管理</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4">
        <ul class="space-y-2">
          <li v-for="item in menuItems" :key="item.id">
            <router-link
              :to="item.path"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full"
              :title="item.label"
              :class="isActive(item.path) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'"
            >
              <component :is="item.icon" class="w-5 h-5" />
              <span v-if="!sidebarCollapsed">{{ item.label }}</span>
            </router-link>
          </li>
        </ul>
      </nav>

      <div class="p-4 border-t border-slate-800">
        <div class="flex items-center gap-3 px-4 py-3" :class="sidebarCollapsed ? 'justify-center' : ''">
          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
            <span class="text-slate-200 font-semibold">{{ user.name.charAt(0) }}</span>
          </div>
          <div v-if="!sidebarCollapsed" class="flex-1 min-w-0">
            <p class="font-medium text-slate-100 truncate">{{ user.name }}</p>
            <p class="text-xs text-slate-400">{{ user.role === 'admin' ? '管理者' : '担当者' }}</p>
          </div>
          <button @click="logout" class="text-slate-400 hover:text-slate-200">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
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
            <p class="text-xs text-slate-400">イベント送客管理</p>
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

    <div class="flex-1 flex flex-col">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div class="flex items-center gap-2 w-full max-w-2xl">
          <button class="md:hidden w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500" @click="mobileSidebarOpen = true">
            <Menu class="w-5 h-5" />
          </button>
          <button class="hidden md:flex w-10 h-10 rounded-full border border-gray-200 items-center justify-center text-gray-500 hover:text-gray-700" @click="sidebarCollapsed = !sidebarCollapsed">
            <component :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose" class="w-5 h-5" />
          </button>
          <div class="relative flex-1">
          <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="キーワードで検索..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          </div>
        </div>
        <button class="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700">
          <Bell class="w-5 h-5" />
        </button>
      </header>

      <main class="flex-1 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
