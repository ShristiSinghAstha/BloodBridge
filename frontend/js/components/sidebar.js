// js/components/sidebar.js
// Shared sidebar component for Patient, Donor, and Admin dashboards

import auth from '../auth.js';

const PATIENT_LINKS = [
  { id: 'dashboard',     to: 'dashboard.html',     label: '🏠 Dashboard' },
  { id: 'requests',      to: 'requests.html',      label: '🩸 My Requests' },
  { id: 'new-request',   to: 'new-request.html',   label: '➕ New Request' },
  { id: 'notifications', to: 'notifications.html', label: '🔔 Notifications' },
  { id: 'profile',       to: 'profile.html',       label: '👤 Profile' },
];

const DONOR_LINKS = [
  { id: 'dashboard',     to: 'dashboard.html',     label: '🏠 Dashboard' },
  { id: 'profile',       to: 'profile.html',       label: '👤 My Profile' },
  { id: 'requests',      to: 'requests.html',      label: '🩸 Incoming Requests' },
  { id: 'history',       to: 'history.html',       label: '📋 Donation History' },
  { id: 'notifications', to: 'notifications.html', label: '🔔 Notifications' },
];

const ADMIN_LINKS = [
  { id: 'dashboard',     to: 'dashboard.html',     label: '🏠 Dashboard' },
  { id: 'donors',        to: 'donors.html',        label: '✅ Donor Verification' },
  { id: 'users',         to: 'users.html',         label: '👥 Users' },
  { id: 'hospitals',     to: 'hospitals.html',     label: '🏥 Hospitals' },
  { id: 'requests',      to: 'requests.html',      label: '🩸 Blood Requests' },
];

function getLinksForRole(role) {
  if (role === 'patient') return PATIENT_LINKS;
  if (role === 'donor')   return DONOR_LINKS;
  if (role === 'admin')   return ADMIN_LINKS;
  return [];
}

export function initSidebar(activeId = 'dashboard') {
  const sidebarContainer = document.getElementById('bb-sidebar') || document.querySelector('aside.bb-sidebar');
  if (!sidebarContainer) return;

  const user = auth.getUser();
  const displayName = user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User';
  const roleName = user?.role || 'User';
  const links = getLinksForRole(user?.role);

  sidebarContainer.className = 'bb-sidebar';
  sidebarContainer.innerHTML = `
    <div class="bb-card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="font-weight: 700; fontSize: 0.9375rem; word-break: break-word;">
        ${escapeHtml(displayName)}
      </div>
      <div class="bb-text-sm bb-text-muted" style="text-transform: capitalize; margin-top: 2px;">
        ${escapeHtml(roleName)}
      </div>
    </div>

    <nav>
      <ul class="bb-sidebar-nav">
        ${links.map((link) => `
          <li>
            <a href="${link.to}" class="bb-sidebar-link ${activeId === link.id ? 'active' : ''}">
              ${link.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
  `;

  // Render responsive horizontal mobile tab bar if not present
  let mobileNav = document.getElementById('bb-mobile-nav');
  const mainContent = document.querySelector('.bb-main-content');
  if (!mobileNav && mainContent) {
    mobileNav = document.createElement('nav');
    mobileNav.id = 'bb-mobile-nav';
    mobileNav.className = 'bb-mobile-nav';
    mainContent.parentNode.insertBefore(mobileNav, mainContent);
  }
  if (mobileNav) {
    mobileNav.innerHTML = links.map((link) => `
      <a href="${link.to}" class="bb-btn bb-btn-sm ${activeId === link.id ? 'bb-btn-primary' : 'bb-btn-secondary'}" style="white-space: nowrap; font-size: 0.8rem; padding: 0.4rem 0.8rem; text-decoration: none;">
        ${link.label}
      </a>
    `).join('');
  }
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

export default initSidebar;
