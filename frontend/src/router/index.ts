import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import StudentList from '../views/StudentList.vue';
import StudentDetail from '../views/StudentDetail.vue';
import EventList from '../views/EventList.vue';
import EventDetail from '../views/EventDetail.vue';
import Login from '../views/Login.vue';
import RegisterInvite from '../views/RegisterInvite.vue';
import LeadTime from '../views/LeadTime.vue';
import Settings from '../views/Settings.vue';
import PastEvents from '../views/PastEvents.vue';

import KpiDashboard from '../views/KpiDashboard.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/students' },
  { path: '/login', component: Login },
  { path: '/register', component: RegisterInvite },
  { path: '/dashboard', component: Dashboard },
  { path: '/students', component: StudentList },
  { path: '/students/:id', component: StudentDetail },
  { path: '/events', component: EventList },
  { path: '/events/:id', component: EventDetail },
  { path: '/projects', redirect: '/events' },
  { path: '/projects/:id', redirect: (to) => `/events/${to.params['id']}` },
  { path: '/lead-time', name: '初回ファネル登録', component: LeadTime },
  { path: '/kpi', component: KpiDashboard },
  { path: '/event-kpi', redirect: '/kpi' },
  { path: '/settings', component: Settings },
  { path: '/past-events', component: PastEvents },
  { path: '/monthly-sales', redirect: '/kpi' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.path === '/login' || to.path === '/register') {
    next();
    return;
  }
  if (!token) {
    next('/login');
    return;
  }

  // ===== 代理店ロールのアクセス制限 =====
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (user && user.role === 'agent') {
      // 許可されたパス: /students とその子パスのみ
      const allowed =
        to.path === '/students' ||
        to.path.startsWith('/students/');
      if (!allowed) {
        next('/students');
        return;
      }
    }
  } catch (e) {
    // userのJSONパースに失敗した場合は通常フローを継続
    console.error('Failed to parse user from localStorage:', e);
  }

  next();
});

export default router;