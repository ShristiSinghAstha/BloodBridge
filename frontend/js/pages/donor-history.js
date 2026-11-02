// js/pages/donor-history.js
// Logic for Donor Donation History

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { getDonationHistory, getMyDonorProfile } from '../api/donors.js';
import { listHospitals } from '../api/hospitals.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('donor');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('history');

  const loadingEl = document.getElementById('history-loading');
  const cardEl = document.getElementById('history-card');
  const emptyEl = document.getElementById('history-empty');
  const tableContainer = document.getElementById('history-table-container');
  const tbody = document.getElementById('history-tbody');
  const refreshBtn = document.getElementById('refresh-history-btn');

  const statTotal = document.getElementById('stat-total-donations');
  const statVerified = document.getElementById('stat-verified-donations');
  const statLastDate = document.getElementById('stat-last-date');
  const statEligibility = document.getElementById('stat-eligibility');

  let hospitalMap = {};

  refreshBtn.addEventListener('click', loadHistory);

  async function loadHistory() {
    loadingEl.style.display = 'flex';
    cardEl.style.display = 'none';

    try {
      const [historyRes, profileRes, hospRes] = await Promise.all([
        getDonationHistory(),
        getMyDonorProfile().catch(() => ({ data: {} })),
        listHospitals({ page_size: 100 }).catch(() => ({ data: [] })),
      ]);

      const history = historyRes.data.results || historyRes.data || [];
      const profile = profileRes.data || {};
      const hospitals = hospRes.data.results || hospRes.data || [];

      // Create lookup dictionary for hospitals
      hospitals.forEach((h) => {
        hospitalMap[h.id] = h.name;
      });

      // Update Summary Stats
      statTotal.textContent = history.length;
      const verifiedCount = history.filter((h) => h.is_verified || h.status === 'completed').length;
      statVerified.textContent = verifiedCount;

      statLastDate.textContent = profile.last_donation_date
        ? new Date(profile.last_donation_date).toLocaleDateString()
        : 'Never';

      if (profile.is_eligible_by_interval) {
        statEligibility.textContent = 'Eligible';
        statEligibility.style.color = 'var(--bb-success)';
      } else {
        statEligibility.textContent = 'Resting';
        statEligibility.style.color = 'var(--bb-warning)';
      }

      // Render records table or empty state
      if (history.length === 0) {
        emptyEl.style.display = 'block';
        tableContainer.style.display = 'none';
      } else {
        emptyEl.style.display = 'none';
        tableContainer.style.display = 'block';

        tbody.innerHTML = history.map((record) => {
          const dateStr = record.donation_date
            ? new Date(record.donation_date).toLocaleDateString()
            : '—';
          const hospitalName = typeof record.hospital === 'object' && record.hospital?.name
            ? record.hospital.name
            : hospitalMap[record.hospital] || (record.hospital ? `Hospital #${record.hospital}` : '—');

          return `
            <tr>
              <td><strong>${escapeHtml(dateStr)}</strong></td>
              <td>${escapeHtml(hospitalName)}</td>
              <td>
                ${record.request ? `<span class="bb-badge bb-badge-blue">Req #${record.request}</span>` : '<span class="bb-text-muted">—</span>'}
              </td>
              <td>${renderStatusBadge(record.status)}</td>
              <td>
                ${
                  record.is_verified
                    ? '<span class="bb-badge bb-badge-green">✓ Verified</span>'
                    : '<span class="bb-badge bb-badge-yellow">Pending Review</span>'
                }
              </td>
              <td class="bb-text-sm bb-text-muted">
                ${escapeHtml(record.notes || '—')}
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Failed to load donation history:', err);
      toast.error('Failed to load donation records.');
    } finally {
      loadingEl.style.display = 'none';
      cardEl.style.display = 'block';
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

  loadHistory();
});

