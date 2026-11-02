// js/pages/admin-users.js
// Logic for Admin User Management & Directory

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listDonors } from '../api/donors.js';
import { listBloodRequests } from '../api/requests.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await auth.requireAuth('admin');
  if (!currentUser) return;

  initNavbar('dashboard');
  initSidebar('users');

  const loadingEl = document.getElementById('users-loading');
  const contentEl = document.getElementById('users-content');
  const emptyEl = document.getElementById('users-empty');
  const tableContainer = document.getElementById('users-table-container');
  const tbody = document.getElementById('users-tbody');
  const refreshBtn = document.getElementById('refresh-users-btn');

  const searchInput = document.getElementById('user-search');
  const roleFilter = document.getElementById('filter-user-role');

  const modalEl = document.getElementById('user-modal');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let allUsers = [];

  refreshBtn.addEventListener('click', loadUsers);
  searchInput.addEventListener('input', applyFilters);
  roleFilter.addEventListener('change', applyFilters);

  modalCloseBtn.addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  function closeModal() {
    modalEl.style.display = 'none';
  }

  async function loadUsers() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const [donorsRes, requestsRes] = await Promise.all([
        listDonors({ page_size: 100 }).catch(() => ({ data: [] })),
        listBloodRequests({ page_size: 100 }).catch(() => ({ data: [] })),
      ]);

      const donorsData = donorsRes.data.results || donorsRes.data || [];
      const requestsData = requestsRes.data.results || requestsRes.data || [];

      const usersMap = new Map();

      // 1. Current logged-in admin user
      if (currentUser && currentUser.email) {
        usersMap.set(`user-${currentUser.id || currentUser.email}`, {
          id: currentUser.id || 'admin-1',
          name: currentUser.first_name || currentUser.last_name
            ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
            : 'Super Administrator',
          email: currentUser.email,
          role: 'admin',
          status: 'active',
          city: 'Platform HQ',
          details: 'Full System Administrative Privileges',
          dateJoined: currentUser.date_joined || null,
          meta: currentUser,
        });
      }

      // 2. Add donors
      donorsData.forEach((d) => {
        const key = d.user_email || `donor-${d.id}`;
        usersMap.set(key, {
          id: d.id,
          name: d.user_name || 'Registered Donor',
          email: d.user_email || '—',
          role: 'donor',
          status: d.verification_status || 'pending',
          availability: d.availability || 'available',
          city: [d.city, d.state].filter(Boolean).join(', ') || 'Location Unset',
          bloodGroup: d.blood_group || '—',
          details: `Blood Group: ${d.blood_group || 'N/A'} • Status: ${d.verification_status}`,
          dateJoined: d.created_at || null,
          meta: d,
        });
      });

      // 3. Add patients from blood requests
      requestsData.forEach((r) => {
        const patientKey = `patient-${r.patient || r.patient_name}`;
        if (!usersMap.has(patientKey)) {
          usersMap.set(patientKey, {
            id: r.patient,
            name: r.patient_name || `Patient #${r.patient}`,
            email: r.patient_email || 'Patient Requester',
            role: 'patient',
            status: 'active',
            city: r.hospital_detail?.city ? `${r.hospital_detail.city}, ${r.hospital_detail.state || ''}` : 'Hospital Linked',
            details: `Active Requests at ${r.hospital_detail?.name || 'Hospital'}`,
            dateJoined: r.created_at || null,
            meta: r,
          });
        }
      });

      allUsers = Array.from(usersMap.values());
      applyFilters();
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to retrieve user accounts.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const role = roleFilter.value;

    const filtered = allUsers.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const city = (u.city || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || city.includes(q);
      const matchesRole = role === 'all' || u.role.toLowerCase() === role;

      return matchesSearch && matchesRole;
    });

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';

      tbody.innerHTML = filtered.map((u, index) => {
        let roleBadge = '';
        if (u.role === 'admin') {
          roleBadge = '<span class="bb-badge bb-badge-danger">Admin</span>';
        } else if (u.role === 'donor') {
          roleBadge = '<span class="bb-badge bb-badge-info">Donor</span>';
        } else {
          roleBadge = '<span class="bb-badge bb-badge-warning">Patient</span>';
        }

        let statusBadge = '';
        if (u.role === 'donor') {
          statusBadge = renderStatusBadge(u.status);
        } else {
          statusBadge = '<span class="bb-badge bb-badge-success">Active</span>';
        }

        return `
          <tr>
            <td>
              <strong>${escapeHtml(u.name)}</strong>
              <div class="bb-text-xs bb-text-muted">${escapeHtml(u.email)}</div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td class="bb-text-sm">
              <div>📍 ${escapeHtml(u.city)}</div>
              <div class="bb-text-xs bb-text-muted">${escapeHtml(u.details)}</div>
            </td>
            <td>
              <button class="bb-btn bb-btn-outline bb-btn-sm view-user-btn" data-index="${index}">
                View Details
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.view-user-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          openUserModal(filtered[idx]);
        });
      });
    }
  }

  function openUserModal(u) {
    if (!u) return;
    modalEl.style.display = 'flex';

    let roleBadge = '';
    if (u.role === 'admin') {
      roleBadge = '<span class="bb-badge bb-badge-danger">Administrator</span>';
    } else if (u.role === 'donor') {
      roleBadge = '<span class="bb-badge bb-badge-info">Blood Donor</span>';
    } else {
      roleBadge = '<span class="bb-badge bb-badge-warning">Patient Requester</span>';
    }

    const dateStr = u.dateJoined ? new Date(u.dateJoined).toLocaleString() : 'N/A';

    modalBody.innerHTML = `
      <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 1.5rem; padding-right: 1.5rem;">
        <div>
          <h2 class="bb-heading-2">${escapeHtml(u.name)}</h2>
          <p class="bb-text-muted bb-text-sm">${escapeHtml(u.email)}</p>
        </div>
        <div>${roleBadge}</div>
      </div>

      <div class="bb-card" style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.03);">
        <div class="bb-grid bb-grid-2" style="font-size: 0.875rem; gap: 0.75rem;">
          <div><strong class="bb-text-muted">Account Role:</strong> ${u.role.toUpperCase()}</div>
          <div><strong class="bb-text-muted">Location:</strong> ${escapeHtml(u.city)}</div>
          <div><strong class="bb-text-muted">Registered On:</strong> ${dateStr}</div>
          <div><strong class="bb-text-muted">Account Status:</strong> <span class="bb-badge bb-badge-success">Active</span></div>
          ${u.bloodGroup ? `<div><strong class="bb-text-muted">Blood Group:</strong> ${escapeHtml(u.bloodGroup)}</div>` : ''}
          ${u.availability ? `<div><strong class="bb-text-muted">Donor Availability:</strong> ${renderStatusBadge(u.availability)}</div>` : ''}
        </div>
      </div>

      <div class="bb-alert bb-alert-info" style="margin-bottom: 1.5rem; font-size: 0.8125rem;">
        ℹ️ <strong>Superuser Controls:</strong> To reset passwords, change account roles, or suspend/deactivate accounts, navigate to the
        <a href="http://127.0.0.1:8000/admin/accounts/user/" target="_blank" rel="noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">
          Django User Administration Console
        </a>.
      </div>

      <div class="bb-flex bb-justify-end bb-gap-sm">
        <button id="modal-user-close-btn" class="bb-btn bb-btn-secondary">Close</button>
      </div>
    `;

    document.getElementById('modal-user-close-btn').addEventListener('click', closeModal);
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

  loadUsers();
});

