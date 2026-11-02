// js/pages/admin-requests.js
// Logic for Admin Blood Request Dispatch & Live Monitoring

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import {
  listBloodRequests,
  getBloodRequest,
  getMatchingDonors,
  getRequestResponses,
} from '../api/requests.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('admin');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('requests');

  const loadingEl = document.getElementById('requests-loading');
  const contentEl = document.getElementById('requests-content');
  const emptyEl = document.getElementById('requests-empty');
  const tableContainer = document.getElementById('requests-table-container');
  const tbody = document.getElementById('requests-tbody');
  const refreshBtn = document.getElementById('refresh-requests-btn');

  const searchInput = document.getElementById('request-search');
  const bloodFilter = document.getElementById('filter-blood-group');
  const urgencyFilter = document.getElementById('filter-urgency');
  const statusFilter = document.getElementById('filter-status');

  const modalEl = document.getElementById('request-modal');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let allRequests = [];

  refreshBtn.addEventListener('click', loadRequests);
  searchInput.addEventListener('input', applyFilters);
  bloodFilter.addEventListener('change', applyFilters);
  urgencyFilter.addEventListener('change', applyFilters);
  statusFilter.addEventListener('change', applyFilters);

  modalCloseBtn.addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  function closeModal() {
    modalEl.style.display = 'none';
  }

  async function loadRequests() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const res = await listBloodRequests({ page_size: 100 });
      allRequests = res.data.results || res.data || [];
      applyFilters();
    } catch (err) {
      console.error('Failed to load blood requests:', err);
      toast.error('Failed to retrieve blood requests.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const blood = bloodFilter.value;
    const urgency = urgencyFilter.value;
    const stat = statusFilter.value;

    const filtered = allRequests.filter((r) => {
      const pName = (r.patient_name || '').toLowerCase();
      const hosp = (r.hospital_detail?.name || '').toLowerCase();
      const city = (r.hospital_detail?.city || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();

      const matchesSearch = !q || pName.includes(q) || hosp.includes(q) || city.includes(q) || desc.includes(q);
      const matchesBlood = blood === 'all' || r.blood_group === blood;
      const matchesUrgency = urgency === 'all' || r.urgency === urgency;
      const matchesStatus = stat === 'all' || r.status === stat;

      return matchesSearch && matchesBlood && matchesUrgency && matchesStatus;
    });

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';

      tbody.innerHTML = filtered.map((r) => {
        const hospName = r.hospital_detail?.name || 'Assigned Hospital';
        const hospCity = r.hospital_detail?.city ? `${r.hospital_detail.city}, ${r.hospital_detail.state || ''}` : 'Location';
        const requiredDate = r.required_by ? new Date(r.required_by).toLocaleDateString() : 'Immediate';

        return `
          <tr>
            <td>
              <div class="bb-flex bb-items-center bb-gap-sm">
                <div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">
                  ${escapeHtml(r.blood_group || '—')}
                </div>
                <div>
                  <strong>Request #${r.id}</strong>
                </div>
              </div>
            </td>
            <td>
              <strong>${escapeHtml(r.patient_name || 'Patient')}</strong>
              <div class="bb-text-xs bb-text-muted">ID: ${r.patient}</div>
            </td>
            <td>
              <strong>${escapeHtml(hospName)}</strong>
              <div class="bb-text-xs bb-text-muted">📍 ${escapeHtml(hospCity)}</div>
            </td>
            <td>
              <strong>${r.units_fulfilled || 0}</strong> / ${r.units_required}
              <div class="bb-text-xs bb-text-muted">Units</div>
            </td>
            <td>${renderStatusBadge(r.urgency)}</td>
            <td>${renderStatusBadge(r.status)}</td>
            <td class="bb-text-sm bb-text-muted">${requiredDate}</td>
            <td>
              <button class="bb-btn bb-btn-outline bb-btn-sm view-req-btn" data-id="${r.id}">
                Inspect &amp; Matches
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.view-req-btn').forEach((btn) => {
        btn.addEventListener('click', () => openRequestModal(btn.dataset.id));
      });
    }
  }

  async function openRequestModal(id) {
    modalEl.style.display = 'flex';
    modalBody.innerHTML = `
      <div class="bb-flex bb-justify-center" style="padding: 3rem;">
        <div class="bb-spinner"></div>
      </div>
    `;

    try {
      const [reqRes, matchesRes, responsesRes] = await Promise.all([
        getBloodRequest(id),
        getMatchingDonors(id).catch(() => ({ data: [] })),
        getRequestResponses(id).catch(() => ({ data: [] })),
      ]);

      const req = reqRes.data;
      const matches = matchesRes.data || [];
      const responses = responsesRes.data || [];

      const requiredDate = req.required_by ? new Date(req.required_by).toLocaleString() : 'Immediate';
      const createdDate = req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A';

      let matchesHtml = '';
      if (matches.length === 0) {
        matchesHtml = '<div class="bb-text-muted bb-text-sm">No matching compatible donors currently found within the target dispatch radius.</div>';
      } else {
        matchesHtml = `
          <div class="bb-table-wrapper" style="border-radius: 8px; margin-top: 0.5rem;">
            <table class="bb-table bb-text-sm">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Blood</th>
                  <th>Distance &amp; Time</th>
                  <th>City</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                ${matches.map((m) => `
                  <tr>
                    <td><strong>${escapeHtml(m.name || 'Donor')}</strong></td>
                    <td><span class="bb-badge bb-badge-red">${escapeHtml(m.blood_group || '—')}</span></td>
                    <td>${
                      m.distance_km != null
                        ? (m.routing_source === 'osrm' && m.duration_min != null)
                          ? `🚗 ${m.distance_km} km (${m.duration_min} min by road)`
                          : `📏 ~${m.distance_km} km (straight-line · time unavailable)`
                        : '<span class="bb-text-muted">Distance unavailable</span>'
                    }</td>
                    <td>📍 ${escapeHtml(m.city || '—')}</td>
                    <td>${renderStatusBadge(m.availability)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      let responsesHtml = '';
      if (responses.length === 0) {
        responsesHtml = '<div class="bb-text-muted bb-text-sm">No donor responses recorded yet for this dispatch.</div>';
      } else {
        responsesHtml = `
          <div class="bb-table-wrapper" style="border-radius: 8px; margin-top: 0.5rem;">
            <table class="bb-table bb-text-sm">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Blood Group</th>
                  <th>Response Status</th>
                  <th>Notes</th>
                  <th>Responded At</th>
                </tr>
              </thead>
              <tbody>
                ${responses.map((rsp) => `
                  <tr>
                    <td><strong>${escapeHtml(rsp.donor_name || 'Donor')}</strong></td>
                    <td><span class="bb-badge bb-badge-red">${escapeHtml(rsp.donor_blood_group || '—')}</span></td>
                    <td>${renderStatusBadge(rsp.status)}</td>
                    <td class="bb-text-xs">${escapeHtml(rsp.notes || '—')}</td>
                    <td class="bb-text-xs bb-text-muted">${rsp.responded_at ? new Date(rsp.responded_at).toLocaleDateString() : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      modalBody.innerHTML = `
        <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 1.5rem; padding-right: 1.5rem;">
          <div class="bb-flex bb-items-center bb-gap-md">
            <div class="bb-blood-pill">${escapeHtml(req.blood_group || '—')}</div>
            <div>
              <h2 class="bb-heading-2">Request #${req.id} – ${escapeHtml(req.patient_name || 'Patient')}</h2>
              <p class="bb-text-muted bb-text-sm">Hospital: ${escapeHtml(req.hospital_detail?.name || 'N/A')}</p>
            </div>
          </div>
          <div class="bb-flex bb-gap-xs">
            ${renderStatusBadge(req.urgency)}
            ${renderStatusBadge(req.status)}
          </div>
        </div>

        <div class="bb-card" style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.03);">
          <div class="bb-grid bb-grid-2" style="font-size: 0.875rem; gap: 0.75rem;">
            <div><strong class="bb-text-muted">Units Required:</strong> ${req.units_required} unit(s)</div>
            <div><strong class="bb-text-muted">Units Fulfilled:</strong> ${req.units_fulfilled || 0} unit(s)</div>
            <div><strong class="bb-text-muted">Units Still Needed:</strong> ${req.units_still_needed ?? (req.units_required - (req.units_fulfilled || 0))} unit(s)</div>
            <div><strong class="bb-text-muted">Required By:</strong> ${requiredDate}</div>
            <div><strong class="bb-text-muted">Created At:</strong> ${createdDate}</div>
            <div><strong class="bb-text-muted">Hospital Location:</strong> ${escapeHtml(req.hospital_detail?.city || '—')}, ${escapeHtml(req.hospital_detail?.state || '—')}</div>
            <div style="grid-column: span 2;"><strong class="bb-text-muted">Clinical Notes:</strong> ${escapeHtml(req.description || 'No specific notes provided.')}</div>
          </div>
        </div>

        <h3 class="bb-heading-3" style="font-size: 1.1rem; margin-bottom: 0.5rem;">
          🎯 Matched Donor Candidates (${matches.length})
        </h3>
        <div style="margin-bottom: 1.5rem;">
          ${matchesHtml}
        </div>

        <h3 class="bb-heading-3" style="font-size: 1.1rem; margin-bottom: 0.5rem;">
          📬 Donor Dispatch Responses (${responses.length})
        </h3>
        <div style="margin-bottom: 1.5rem;">
          ${responsesHtml}
        </div>

        <div class="bb-alert bb-alert-info" style="margin-bottom: 1.5rem; font-size: 0.8125rem;">
          ℹ️ <strong>Administrative Governance:</strong> To manually modify fulfillment status or override lifecycle locks, use the
          <a href="http://127.0.0.1:8000/admin/requests_app/bloodrequest/${req.id}/change/" target="_blank" rel="noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">
            Django Request Admin Console
          </a>.
        </div>

        <div class="bb-flex bb-justify-end bb-gap-sm">
          <button id="modal-req-close-btn" class="bb-btn bb-btn-secondary">Close</button>
        </div>
      `;

      document.getElementById('modal-req-close-btn').addEventListener('click', closeModal);
    } catch (err) {
      console.error('Failed to load request detail modal:', err);
      modalBody.innerHTML = '<div class="bb-alert bb-alert-error">Failed to load request details.</div>';
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

  loadRequests();
});

