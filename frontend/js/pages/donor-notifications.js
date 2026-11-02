// js/pages/donor-notifications.js
// Logic for Donor Notifications management

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listNotifications, markRead, markAllRead, getUnreadCount } from '../api/notifications.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('donor');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('notifications');

  const loadingEl = document.getElementById('notifs-loading');
  const contentEl = document.getElementById('notifs-content');
  const emptyEl = document.getElementById('notifs-empty');
  const listEl = document.getElementById('notifs-list');
  const unreadBadge = document.getElementById('unread-count-badge');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  const refreshBtn = document.getElementById('refresh-notifs-btn');

  let notifications = [];
  let currentFilter = 'all';

  refreshBtn.addEventListener('click', loadNotifications);

  // Filter Buttons
  ['all', 'unread', 'read'].forEach((filterKey) => {
    const btn = document.getElementById(`filter-${filterKey}`);
    if (btn) {
      btn.addEventListener('click', () => {
        currentFilter = filterKey;
        ['all', 'unread', 'read'].forEach((f) => {
          const b = document.getElementById(`filter-${f}`);
          if (b) {
            b.className = `bb-btn bb-btn-sm ${f === filterKey ? 'bb-btn-primary' : 'bb-btn-secondary'}`;
          }
        });
        renderNotifications();
      });
    }
  });

  // Mark all as read
  markAllBtn.addEventListener('click', async () => {
    markAllBtn.disabled = true;
    try {
      await markAllRead();
      notifications.forEach((n) => { n.is_read = true; });
      updateUnreadBadge(0);
      renderNotifications();
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Could not mark all notifications as read.');
    } finally {
      markAllBtn.disabled = false;
    }
  });

  async function loadNotifications() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const [notifsRes, countRes] = await Promise.all([
        listNotifications(),
        getUnreadCount(),
      ]);

      notifications = notifsRes.data.results || notifsRes.data || [];
      const unreadCount = countRes.data.unread_count || 0;
      updateUnreadBadge(unreadCount);

      renderNotifications();
    } catch (err) {
      console.error('Failed to load notifications:', err);
      toast.error('Failed to load notifications.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function updateUnreadBadge(count) {
    if (count > 0) {
      unreadBadge.textContent = `${count} unread`;
      unreadBadge.style.display = 'inline-flex';
    } else {
      unreadBadge.style.display = 'none';
    }
  }

  function renderNotifications() {
    let filtered = notifications;
    if (currentFilter === 'unread') {
      filtered = notifications.filter((n) => !n.is_read);
    } else if (currentFilter === 'read') {
      filtered = notifications.filter((n) => n.is_read);
    }

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      listEl.innerHTML = '';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = filtered.map((n) => {
      const isUnread = !n.is_read;
      const typeIcon = n.notification_type === 'request_matched'
        ? '🩸'
        : n.notification_type === 'donor_responded'
        ? '📩'
        : '🔔';

      const timeStr = n.created_at ? new Date(n.created_at).toLocaleString() : '';

      return `
        <div
          class="bb-card ${isUnread ? 'bb-card-red' : ''}"
          style="padding: 1.25rem 1.5rem; ${isUnread ? 'border-left: 4px solid var(--bb-red-500);' : ''}"
        >
          <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div class="bb-flex bb-items-center bb-gap-sm">
              <span style="font-size: 1.25rem;">${typeIcon}</span>
              <strong style="font-size: 1rem;">${escapeHtml(n.title)}</strong>
              ${isUnread ? '<span class="bb-badge bb-badge-red" style="font-size: 0.65rem;">New</span>' : ''}
            </div>
            <span class="bb-text-xs bb-text-muted">${timeStr}</span>
          </div>

          <p class="bb-text-sm" style="color: #e8e8f4; margin-bottom: 0.75rem; line-height: 1.6;">
            ${escapeHtml(n.message)}
          </p>

          <div class="bb-flex bb-justify-between bb-items-center" style="flex-wrap: wrap; gap: 0.5rem;">
            <div>
              ${
                n.related_request
                  ? `
                    <a href="requests.html" class="bb-btn bb-btn-outline bb-btn-sm">
                      View Request →
                    </a>
                  `
                  : ''
              }
            </div>

            ${
              isUnread
                ? `
                  <button
                    class="bb-btn bb-btn-secondary bb-btn-sm mark-read-btn"
                    data-id="${n.id}"
                  >
                    ✓ Mark as Read
                  </button>
                `
                : '<span class="bb-text-xs bb-text-muted">✓ Read</span>'
            }
          </div>
        </div>
      `;
    }).join('');

    // Attach individual mark as read handlers
    listEl.querySelectorAll('.mark-read-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await markRead(id);
          const found = notifications.find((x) => String(x.id) === String(id));
          if (found) found.is_read = true;

          const remainingUnread = notifications.filter((x) => !x.is_read).length;
          updateUnreadBadge(remainingUnread);
          renderNotifications();
          toast.success('Notification marked as read.');
        } catch {
          toast.error('Could not mark notification as read.');
          btn.disabled = false;
        }
      });
    });
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

