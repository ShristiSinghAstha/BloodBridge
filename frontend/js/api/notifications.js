// js/api/notifications.js – Notification API
import client from './client.js';

export const listNotifications = ()     => client.get('/notifications/');
export const markRead          = (id)   => client.post(`/notifications/${id}/read/`);
export const markAllRead       = ()     => client.post('/notifications/read-all/');
export const getUnreadCount    = ()     => client.get('/notifications/unread-count/');
