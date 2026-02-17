export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = 'app_notifications';

const parseNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const saveNotifications = (items: AppNotification[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  window.dispatchEvent(new Event('app-notification-updated'));
};

export const getNotifications = () => parseNotifications();

export const pushNotification = (message: string, type: AppNotification['type'] = 'info') => {
  const items = parseNotifications();
  items.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
    createdAt: new Date().toISOString(),
    read: false
  });
  saveNotifications(items);
};

export const markAllNotificationsRead = () => {
  const items = parseNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(items);
};

export const clearNotifications = () => {
  saveNotifications([]);
};
