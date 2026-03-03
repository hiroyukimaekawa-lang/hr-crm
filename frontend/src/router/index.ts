import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import StudentList from '../views/StudentList.vue';
import StudentDetail from '../views/StudentDetail.vue';
import EventList from '../views/EventList.vue';
import EventDetail from '../views/EventDetail.vue';
import Login from '../views/Login.vue';
import RegisterInvite from '../views/RegisterInvite.vue';
import LeadTime from '../views/LeadTime.vue';
import EventKpi from '../views/EventKpi.vue';
import Settings from '../views/Settings.vue';

const routes = [
  { path: '/', redirect: '/students' },
  { path: '/login', component: Login },
  { path: '/register', component: RegisterInvite },
  { path: '/dashboard', component: Dashboard },
  { path: '/students', component: StudentList },
  { path: '/students/:id', component: StudentDetail },
  { path: '/events', component: EventList },
  { path: '/events/:id', component: EventDetail },
  { path: '/lead-time', component: LeadTime },
  { path: '/event-kpi', component: EventKpi },
  { path: '/settings', component: Settings }
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
  next();
});

export default router;
