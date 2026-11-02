// js/pages/admin-donors.js
// Logic for Admin Donor Verification & Management

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listDonors, getDonor, updateDonor } from '../api/donors.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('admin');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('donors');

  const loadingEl = document.getElementById('donors-loading');
  const contentEl = document.getElementById('donors-content');
  const emptyEl = document.getElementById('donors-empty');
  const tableContainer = document.getElementById('donors-table-container');
  const tbody = document.getElementById('donors-tbody');
  const refreshBtn = document.getElementById('refresh-donors-btn');

  const searchInput = document.getElementById('donor-search');
  const bloodFilter = document.getElementById('filter-blood-group');
  const verifFilter = document.getElementById('filter-verification');

  const modalEl = document.getElementById('donor-modal');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let allDonors = [];

  refreshBtn.addEventListener('click', loadDonors);
  searchInput.addEventListener('input', applyFilters);
  bloodFilter.addEventListener('change', applyFilters);
  verifFilter.addEventListener('change', applyFilters);

  modalCloseBtn.addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  function closeModal() {
    modalEl.style.display = 'none';
  }

  async function loadDonors() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const res = await listDonors({ page_size: 100 });
      allDonors = res.data.results || res.data || [];
      applyFilters();
    } catch (err) {
      console.error('Failed to load donors:', err);
      toast.error('Failed to retrieve donors list.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const blood = bloodFilter.value;
    const verif = verifFilter.value;

    const filtered = allDonors.filter((d) => {
      const name = (d.user_name || '').toLowerCase();
      const email = (d.user_email || '').toLowerCase();
      const city = (d.city || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || city.includes(q);
      const matchesBlood = blood === 'all' || d.blood_group === blood;
      const matchesVerif = verif === 'all' || d.verification_status === verif;

      return matchesSearch && matchesBlood && matchesVerif;
    });

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';

      tbody.innerHTML = filtered.map((d) => {
        const name = d.user_name || 'Donor';
        const email = d.user_email || '—';
        const locationStr = [d.city, d.state].filter(Boolean).join(', ') || 'Location unset';
        const dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString() : '—';

        return `
          <tr>
            <td>
              <strong>${escapeHtml(name)}</strong>
              <div class="bb-text-xs bb-text-muted">${escapeHtml(email)}</div>
            </td>
            <td>
              <div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">
                ${escapeHtml(d.blood_group || '—')}
              </div>
            </td>
            <td class="bb-text-sm">
              📍 ${escapeHtml(locationStr)}
              ${d.has_coordinates ? '<span class="bb-text-xs" style="color: var(--bb-success); display: block;">✓ Geocoded</span>' : ''}
            </td>
            <td>${renderStatusBadge(d.availability)}</td>
            <td>${renderStatusBadge(d.verification_status)}</td>
            <td class="bb-text-muted bb-text-sm">${dateStr}</td>
            <td>
              <button class="bb-btn bb-btn-outline bb-btn-sm view-donor-btn" data-id="${d.id}">
                Review &amp; Verify
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.view-donor-btn').forEach((btn) => {
        btn.addEventListener('click', () => openDonorModal(btn.dataset.id));
      });
    }
  }

  async function openDonorModal(id) {
    modalEl.style.display = 'flex';
    modalBody.innerHTML = `
      <div class="bb-flex bb-justify-center" style="padding: 3rem;">
        <div class="bb-spinner"></div>
      </div>
    `;

    try {
      const res = await getDonor(id);
      const donor = res.data;

      modalBody.innerHTML = `
        <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 1.5rem; padding-right: 1.5rem;">
          <div class="bb-flex bb-items-center bb-gap-md">
            <div class="bb-blood-pill">${escapeHtml(donor.blood_group || '—')}</div>
            <div>
              <h2 class="bb-heading-2">${escapeHtml(donor.user_name || 'Donor Profile')}</h2>
              <p class="bb-text-muted bb-text-sm">${escapeHtml(donor.user_email || '')}</p>
            </div>
          </div>
          <div>${renderStatusBadge(donor.verification_status)}</div>
        </div>

        <div class="bb-card" style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.03);">
          <div class="bb-grid bb-grid-2" style="font-size: 0.875rem; gap: 0.75rem;">
            <div><strong class="bb-text-muted">Blood Group:</strong> ${escapeHtml(donor.blood_group || 'Not specified')}</div>
            <div><strong class="bb-text-muted">Availability:</strong> ${renderStatusBadge(donor.availability)}</div>
            <div><strong class="bb-text-muted">City / State:</strong> ${escapeHtml(donor.city || '—')}, ${escapeHtml(donor.state || '—')}</div>
            <div><strong class="bb-text-muted">Address:</strong> ${escapeHtml(donor.address || '—')}</div>
            <div><strong class="bb-text-muted">GPS Coordinates:</strong> ${donor.has_coordinates ? '✓ Latitude / Longitude set' : 'None'}</div>
            <div><strong class="bb-text-muted">Profile Complete:</strong> ${donor.is_profile_complete ? '✓ Complete' : 'Incomplete'}</div>
            <div><strong class="bb-text-muted">Last Donation:</strong> ${donor.last_donation_date ? new Date(donor.last_donation_date).toLocaleDateString() : 'Never'}</div>
            <div><strong class="bb-text-muted">56-Day Medical Rest:</strong> ${donor.is_eligible_by_interval ? '<span style="color: var(--bb-success);">Eligible</span>' : '<span style="color: var(--bb-warning);">Resting</span>'}</div>
          </div>
        </div>

        <div class="bb-alert bb-alert-info" style="margin-bottom: 1.5rem; font-size: 0.8125rem;">
          ℹ️ <strong>Verification Protocol:</strong> Verification enables emergency automated donor matching. You can also edit full records in the
          <a href="http://127.0.0.1:8000/admin/donors/donorprofile/${donor.id}/change/" target="_blank" rel="noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">
            Django Admin Console
          </a>.
        </div>

        <div class="bb-flex bb-gap-sm">
          <button id="modal-approve-btn" class="bb-btn bb-btn-primary" style="flex: 1; justify-content: center;">
            ✓ Approve Verification
          </button>
          <button id="modal-reject-btn" class="bb-btn bb-btn-secondary" style="flex: 1; justify-content: center;">
            ✗ Reject Verification
          </button>
        </div>
      `;

      document.getElementById('modal-approve-btn').addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to APPROVE verification for ${donor.user_name || 'this donor'}?`)) return;
        try {
          await updateDonor(donor.id, { verification_status: 'verified' });
          toast.success('Donor verification status updated.');
          closeModal();
          loadDonors();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Could not update verification status.');
        }
      });

      document.getElementById('modal-reject-btn').addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to REJECT verification for ${donor.user_name || 'this donor'}?`)) return;
        try {
          await updateDonor(donor.id, { verification_status: 'rejected' });
          toast.info('Donor verification rejected.');
          closeModal();
          loadDonors();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Could not reject verification.');
        }
      });
    } catch {
      modalBody.innerHTML = '<div class="bb-alert bb-alert-error">Failed to load donor details.</div>';
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

  loadDonors();
});

