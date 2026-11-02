// js/pages/patient-notifications.js
// Logic for Patient Notifications and alerts

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listNotifications, markRead, markAllRead } from '../api/notifications.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('patient');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('notifications');

  const loadingEl = document.getElementById('notifs-loading');
  const emptyEl = document.getElementById('notifs-empty');
  const containerEl = document.getElementById('notifs-container');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  const refreshBtn = document.getElementById('refresh-notifs-btn');
  const unreadBadge = document.getElementById('unread-count-badge');

  let allNotifs = [];
  let currentFilter = 'all';

  refreshBtn.addEventListener('click', loadNotifications);
  markAllBtn.addEventListener('click', handleMarkAllRead);

  ['all', 'unread', 'read'].forEach((filterKey) => {
    const btn = document.getElementById(`filter-${filterKey}`);
    if (btn) {
      btn.addEventListener('click', () => {
        currentFilter = filterKey;
        ['all', 'unread', 'read'].forEach((f) => {
          const b = document.getElementById(`filter-${f}`);
          b.className = `bb-btn bb-btn-sm ${f === filterKey ? 'bb-btn-primary' : 'bb-btn-secondary'}`;
        });
        renderNotifications();
      });
    }
  });

  async function loadNotifications() {
    loadingEl.style.display = 'flex';
    containerEl.innerHTML = '';
    emptyEl.style.display = 'none';

    try {
      const res = await listNotifications();
      allNotifs = res.data.results || res.data || [];

      const unreadCount = allNotifs.filter((n) => !n.is_read).length;
      if (unreadCount > 0) {
        unreadBadge.textContent = `${unreadCount} unread`;
        unreadBadge.style.display = 'inline-block';
      } else {
        unreadBadge.style.display = 'none';
      }

      renderNotifications();
    } catch (err) {
      console.error('Failed to load notifications:', err);
      toast.error('Failed to load notifications.');
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  function renderNotifications() {
    let filtered = allNotifs;
    if (currentFilter === 'unread') {
      filtered = allNotifs.filter((n) => !n.is_read);
    } else if (currentFilter === 'read') {
      filtered = allNotifs.filter((n) => n.is_read);
    }

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      containerEl.innerHTML = '';
    } else {
      emptyEl.style.display = 'none';
      containerEl.innerHTML = filtered.map((n) => `
        <div class="bb-card ${n.is_read ? '' : 'bb-card-red'}" style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <div>
            <div class="bb-flex bb-items-center bb-gap-sm" style="margin-bottom: 0.25rem;">
              <span style="font-size: 1.25rem;">${getNotificationIcon(n.notification_type)}</span>
              <strong style="font-size: 1rem; color: #fff;">${escapeHtml(n.title)}</strong>
              ${!n.is_read ? '<span class="bb-badge bb-badge-red" style="font-size: 0.65rem;">NEW</span>' : ''}
            </div>
            <p class="bb-text-muted bb-text-sm" style="margin-bottom: 0.25rem;">
              ${escapeHtml(n.message)}
            </p>
            <span class="bb-text-xs bb-text-muted">
              ${n.created_at ? new Date(n.created_at).toLocaleString() : ''}
            </span>
          </div>

          ${
            !n.is_read
              ? `
                <button class="bb-btn bb-btn-secondary bb-btn-sm mark-read-btn" data-id="${n.id}">
                  Mark read
                </button>
              `
              : ''
          }
        </div>
      `).join('');

      containerEl.querySelectorAll('.mark-read-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          try {
            await markRead(id);
            toast.success('Notification marked as read.');
            loadNotifications();
          } catch {
            toast.error('Could not mark as read.');
            btn.disabled = false;
          }
        });
      });
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      toast.success('All notifications marked as read.');
      loadNotifications();
    } catch {
      toast.error('Could not mark notifications as read.');
    }
  }

  function getNotificationIcon(type) {
    if (type === 'request_matched') return '🧬';
    if (type === 'donor_responded') return '❤️';
    if (type === 'request_cancelled') return '🛑';
    if (type === 'request_fulfilled') return '✅';
    return '🔔';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  loadNotifications();
});
