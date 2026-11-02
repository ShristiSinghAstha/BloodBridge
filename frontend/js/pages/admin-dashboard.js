// js/pages/admin-dashboard.js
// Logic for Admin Dashboard Overview & Statistics

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listDonors } from '../api/donors.js';
import { listBloodRequests } from '../api/requests.js';
import { listHospitals } from '../api/hospitals.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('admin');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('dashboard');

  const loadingEl = document.getElementById('admin-loading');
  const contentEl = document.getElementById('admin-content');
  const refreshBtn = document.getElementById('refresh-stats-btn');

  // Stats elements
  const statTotalDonors = document.getElementById('stat-total-donors');
  const statPendingDonors = document.getElementById('stat-pending-donors');
  const statPendingDonors2 = document.getElementById('stat-pending-donors-2');
  const statVerifiedDonors = document.getElementById('stat-verified-donors');
  const statOtherDonors = document.getElementById('stat-other-donors');

  const statTotalRequests = document.getElementById('stat-total-requests');
  const statActiveRequests = document.getElementById('stat-active-requests');
  const statFulfilledRequests = document.getElementById('stat-fulfilled-requests');
  const statCancelledRequests = document.getElementById('stat-cancelled-requests');

  const statTotalHospitals = document.getElementById('stat-total-hospitals');
  const statActiveHospitals = document.getElementById('stat-active-hospitals');
  const statTotalUsers = document.getElementById('stat-total-users');
  const statTotalPatients = document.getElementById('stat-total-patients');

  const recentEmpty = document.getElementById('recent-empty');
  const recentTableContainer = document.getElementById('recent-table-container');
  const recentTbody = document.getElementById('recent-tbody');

  refreshBtn.addEventListener('click', loadDashboardMetrics);

  async function loadDashboardMetrics() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const [donorRes, reqRes, hospRes] = await Promise.all([
        listDonors({ page_size: 100 }),
        listBloodRequests({ page_size: 100, ordering: '-created_at' }),
        listHospitals({ page_size: 100 }),
      ]);

      const donors = donorRes.data.results || donorRes.data || [];
      const requests = reqRes.data.results || reqRes.data || [];
      const hospitals = hospRes.data.results || hospRes.data || [];

      // Donors metrics
      const totalDonors = donorRes.data.count ?? donors.length;
      const verifiedDonors = donors.filter((d) => d.verification_status === 'verified').length;
      const pendingDonors = donors.filter((d) => d.verification_status === 'pending').length;
      const otherDonors = donors.filter((d) => d.verification_status !== 'verified' && d.verification_status !== 'pending').length;

      statTotalDonors.textContent = totalDonors;
      statPendingDonors.textContent = pendingDonors;
      statPendingDonors2.textContent = pendingDonors;
      statVerifiedDonors.textContent = verifiedDonors;
      statOtherDonors.textContent = otherDonors;

      // Requests metrics
      const totalRequests = reqRes.data.count ?? requests.length;
      const activeRequests = requests.filter((r) => ['open', 'matching', 'awaiting_response', 'donor_accepted'].includes(r.status)).length;
      const fulfilledRequests = requests.filter((r) => r.status === 'fulfilled').length;
      const cancelledRequests = requests.filter((r) => r.status === 'cancelled').length;

      statTotalRequests.textContent = totalRequests;
      statActiveRequests.textContent = activeRequests;
      statFulfilledRequests.textContent = fulfilledRequests;
      statCancelledRequests.textContent = cancelledRequests;

      // Hospitals & Reach metrics
      const totalHospitals = hospRes.data.count ?? hospitals.length;
      const activeHospitals = hospitals.filter((h) => h.is_active).length;

      statTotalHospitals.textContent = totalHospitals;
      statActiveHospitals.textContent = activeHospitals;

      // Unique patients who have submitted requests
      const patientSet = new Set();
      requests.forEach((r) => {
        if (r.patient) patientSet.add(r.patient);
        else if (r.patient_name) patientSet.add(r.patient_name);
      });
      const uniquePatients = patientSet.size;
      statTotalPatients.textContent = uniquePatients;

      // Estimated total registered users (donors + requesting patients + admin)
      statTotalUsers.textContent = totalDonors + uniquePatients + 1;

      // Recent Activity
      if (requests.length === 0) {
        recentEmpty.style.display = 'block';
        recentTableContainer.style.display = 'none';
      } else {
        recentEmpty.style.display = 'none';
        recentTableContainer.style.display = 'block';
        recentTbody.innerHTML = requests.slice(0, 5).map((r) => `
          <tr>
            <td><div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">${escapeHtml(r.blood_group)}</div></td>
            <td><strong>${escapeHtml(r.patient_name || 'Patient')}</strong></td>
            <td>${escapeHtml(r.hospital_detail?.name || 'Hospital')}</td>
            <td>${renderStatusBadge(r.urgency)}</td>
            <td>${renderStatusBadge(r.status)}</td>
            <td class="bb-text-muted bb-text-sm">${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
      toast.error('Failed to load system metrics.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
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

  loadDashboardMetrics();
});

