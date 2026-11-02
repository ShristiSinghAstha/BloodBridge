// js/pages/patient-dashboard.js
// Logic for Patient Dashboard Overview & Statistics

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listBloodRequests } from '../api/requests.js';
import { getUnreadCount } from '../api/notifications.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('patient');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('dashboard');

  const welcomeHeading = document.getElementById('welcome-heading');
  const displayName = user.first_name || user.full_name || 'Patient';
  welcomeHeading.textContent = `Welcome, ${displayName}!`;

  const loadingEl = document.getElementById('dashboard-loading');
  const contentEl = document.getElementById('dashboard-content');
  const emptyEl = document.getElementById('requests-empty');
  const tableContainer = document.getElementById('requests-table-container');
  const tbody = document.getElementById('requests-tbody');

  const bannerEl = document.getElementById('notif-summary-banner');
  const bannerCountEl = document.getElementById('banner-unread-count');

  try {
    const [reqRes, notifRes] = await Promise.all([
      listBloodRequests({ ordering: '-created_at', page_size: 100 }),
      getUnreadCount().catch(() => ({ data: { unread_count: 0 } })),
    ]);

    const requests = reqRes.data.results || reqRes.data || [];
    const unreadCount = notifRes.data.unread_count || 0;

    const total = reqRes.data.count ?? requests.length;
    const active = requests.filter((r) =>
      ['open', 'matching', 'awaiting_response', 'donor_accepted'].includes(r.status)
    ).length;
    const fulfilled = requests.filter((r) => r.status === 'fulfilled').length;
    const cancelled = requests.filter((r) => r.status === 'cancelled').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-fulfilled').textContent = fulfilled;
    document.getElementById('stat-cancelled').textContent = cancelled;

    // Show notification summary banner if there are unread notifications
    if (unreadCount > 0) {
      bannerCountEl.textContent = unreadCount;
      bannerEl.style.display = 'flex';
    } else {
      bannerEl.style.display = 'none';
    }

    if (requests.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';
      tbody.innerHTML = requests.slice(0, 5).map((r) => `
        <tr>
          <td>
            <div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">
              ${escapeHtml(r.blood_group)}
            </div>
          </td>
          <td>
            <strong>${escapeHtml(r.hospital_detail?.name || '—')}</strong>
            <div class="bb-text-xs bb-text-muted">${escapeHtml(r.hospital_detail?.city || '')}</div>
          </td>
          <td>
            <strong>${r.units_fulfilled || 0}</strong> / ${r.units_required || 1}
            <div class="bb-text-xs bb-text-muted">Units</div>
          </td>
          <td>${renderStatusBadge(r.urgency)}</td>
          <td>${renderStatusBadge(r.status)}</td>
          <td class="bb-text-muted bb-text-sm">
            ${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
          </td>
          <td>
            <a href="requests.html?id=${r.id}" class="bb-btn bb-btn-outline bb-btn-sm">
              Details
            </a>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load patient dashboard:', err);
    toast.error('Failed to load dashboard data.');
  } finally {
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
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
});
