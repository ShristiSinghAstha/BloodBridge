// js/pages/patient-requests.js
// Logic for Patient Blood Requests & matching details

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import {
  listBloodRequests,
  getBloodRequest,
  cancelBloodRequest,
  fulfillBloodRequest,
  getMatchingDonors,
  getRequestResponses,
} from '../api/requests.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('patient');
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

  const modalEl = document.getElementById('details-modal');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Confirm Donation Modal elements
  const confirmModalEl = document.getElementById('confirm-donation-modal');
  const confirmModalCloseBtn = document.getElementById('confirm-modal-close-btn');
  const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
  const confirmForm = document.getElementById('confirm-donation-form');
  const confirmReqIdInput = document.getElementById('confirm-req-id');
  const confirmRespIdInput = document.getElementById('confirm-response-id');
  const confirmDonorNameInput = document.getElementById('confirm-donor-name');
  const confirmBloodGroupInput = document.getElementById('confirm-blood-group');
  const confirmUnitsInput = document.getElementById('confirm-units');
  const confirmUnitsHint = document.getElementById('confirm-units-hint');
  const confirmNotesInput = document.getElementById('confirm-notes');
  const confirmSubmitBtn = document.getElementById('confirm-modal-submit-btn');

  let allRequests = [];
  let currentFilter = 'all';

  refreshBtn.addEventListener('click', loadRequests);
  searchInput.addEventListener('input', applyFilter);

  modalCloseBtn.addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  function closeModal() {
    modalEl.style.display = 'none';
    const url = new URL(window.location);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
  }

  function closeConfirmModal() {
    if (confirmModalEl) confirmModalEl.style.display = 'none';
  }

  if (confirmModalCloseBtn) confirmModalCloseBtn.addEventListener('click', closeConfirmModal);
  if (confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', closeConfirmModal);
  if (confirmModalEl) {
    confirmModalEl.addEventListener('click', (e) => {
      if (e.target === confirmModalEl) closeConfirmModal();
    });
  }

  if (confirmForm) {
    confirmForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reqId = confirmReqIdInput.value;
      const respId = confirmRespIdInput.value;
      const units = parseInt(confirmUnitsInput.value, 10) || 1;
      const notes = confirmNotesInput.value.trim();

      confirmSubmitBtn.disabled = true;
      confirmSubmitBtn.textContent = 'Confirming…';

      try {
        const res = await fulfillBloodRequest(reqId, {
          donor_response_id: respId ? parseInt(respId, 10) : undefined,
          units,
          notes,
        });

        const isFullyFulfilled = res.data.status === 'fulfilled';
        toast.success(
          isFullyFulfilled
            ? 'Blood request fully fulfilled! All units received.'
            : `Donation confirmed! Received ${units} unit(s).`
        );
        closeConfirmModal();
        await openDetailsModal(reqId);
        loadRequests();
      } catch (err) {
        console.error('Fulfillment confirmation error:', err);
        toast.error(err.response?.data?.detail || 'Failed to confirm donation.');
      } finally {
        confirmSubmitBtn.disabled = false;
        confirmSubmitBtn.textContent = '✅ Yes, Donation Completed';
      }
    });
  }

  // Filter tab buttons
  ['all', 'active', 'fulfilled', 'cancelled'].forEach((filterKey) => {
    const btn = document.getElementById(`filter-${filterKey}`);
    if (btn) {
      btn.addEventListener('click', () => {
        currentFilter = filterKey;
        ['all', 'active', 'fulfilled', 'cancelled'].forEach((f) => {
          const b = document.getElementById(`filter-${f}`);
          b.className = `bb-btn bb-btn-sm ${f === filterKey ? 'bb-btn-primary' : 'bb-btn-secondary'}`;
        });
        applyFilter();
      });
    }
  });

  async function loadRequests() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const res = await listBloodRequests({ ordering: '-created_at', page_size: 100 });
      allRequests = res.data.results || res.data || [];
      applyFilter();

      // Check if URL has ?id=... to automatically open modal
      const params = new URLSearchParams(window.location.search);
      const reqId = params.get('id');
      if (reqId) {
        openDetailsModal(reqId);
      }
    } catch (err) {
      console.error('Failed to load blood requests:', err);
      toast.error('Failed to load blood requests.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function applyFilter() {
    const q = searchInput.value.toLowerCase().trim();

    let filtered = allRequests.filter((r) => {
      // Status filter
      let matchesStatus = true;
      if (currentFilter === 'active') {
        matchesStatus = ['open', 'matching', 'awaiting_response', 'donor_accepted'].includes(r.status);
      } else if (currentFilter === 'fulfilled') {
        matchesStatus = r.status === 'fulfilled';
      } else if (currentFilter === 'cancelled') {
        matchesStatus = r.status === 'cancelled';
      }

      // Search query filter
      const hospName = (r.hospital_detail?.name || '').toLowerCase();
      const hospCity = (r.hospital_detail?.city || '').toLowerCase();
      const blood = (r.blood_group || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();

      const matchesSearch = !q || hospName.includes(q) || hospCity.includes(q) || blood.includes(q) || desc.includes(q);

      return matchesStatus && matchesSearch;
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
        const createdDate = r.created_at ? new Date(r.created_at).toLocaleDateString() : '—';

        return `
          <tr>
            <td>
              <div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">
                ${escapeHtml(r.blood_group)}
              </div>
            </td>
            <td>
              <strong>${escapeHtml(hospName)}</strong>
              <div class="bb-text-xs bb-text-muted">📍 ${escapeHtml(hospCity)}</div>
            </td>
            <td>
              <strong>${r.units_fulfilled || 0}</strong> / ${r.units_required || 1}
              <div class="bb-text-xs bb-text-muted">Units</div>
            </td>
            <td>${renderStatusBadge(r.urgency)}</td>
            <td>${renderStatusBadge(r.status)}</td>
            <td class="bb-text-sm">${requiredDate}</td>
            <td class="bb-text-muted bb-text-sm">${createdDate}</td>
            <td>
              <button class="bb-btn bb-btn-outline bb-btn-sm open-details-btn" data-id="${r.id}">
                Details &amp; Matches
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.open-details-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          openDetailsModal(btn.dataset.id);
        });
      });
    }
  }

  async function openDetailsModal(id) {
    modalEl.style.display = 'flex';
    modalBody.innerHTML = `
      <div class="bb-flex bb-justify-center" style="padding: 3rem;">
        <div class="bb-spinner"></div>
      </div>
    `;

    try {
      const [reqRes, matchesRes, respRes] = await Promise.all([
        getBloodRequest(id),
        getMatchingDonors(id).catch(() => ({ data: [] })),
        getRequestResponses(id).catch(() => ({ data: [] })),
      ]);

      const req = reqRes.data;
      const matches = matchesRes.data || [];
      const responses = respRes.data || [];

      const isFulfilled = req.status === 'fulfilled';
      const isCancellable = Boolean((req.is_cancellable || ['open', 'matching', 'awaiting_response'].includes(req.status)) && !isFulfilled);
      const requiredDate = req.required_by ? new Date(req.required_by).toLocaleString() : 'Immediate';
      const createdDate = req.created_at ? new Date(req.created_at).toLocaleString() : '—';
      const unitsStillNeeded = req.units_still_needed ?? Math.max(0, req.units_required - (req.units_fulfilled || 0));
      const acceptedResponses = responses.filter((r) => r.status === 'accepted');

      modalBody.innerHTML = `
        <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 1.5rem; padding-right: 1.5rem;">
          <div class="bb-flex bb-items-center bb-gap-md">
            <div class="bb-blood-pill">${escapeHtml(req.blood_group)}</div>
            <div>
              <h2 class="bb-heading-2">${escapeHtml(req.hospital_detail?.name || 'Hospital')}</h2>
              <p class="bb-text-muted bb-text-sm">📍 ${escapeHtml(req.hospital_detail?.city || '')}, ${escapeHtml(req.hospital_detail?.state || '')}</p>
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
            <div><strong class="bb-text-muted">Required By:</strong> ${requiredDate}</div>
            <div><strong class="bb-text-muted">Requested On:</strong> ${createdDate}</div>
            ${req.description ? `<div style="grid-column: span 2;"><strong class="bb-text-muted">Clinical Notes:</strong> ${escapeHtml(req.description)}</div>` : ''}
          </div>
        </div>

        <!-- Matched Donors Section -->
        <h3 class="bb-heading-3" style="margin-bottom: 0.75rem; font-size: 1.05rem;">
          🎯 Compatible Nearby Donors (${matches.length})
        </h3>
        ${
          matches.length === 0
            ? '<p class="bb-text-muted bb-text-sm" style="margin-bottom: 1.5rem;">No verified compatible donors currently within the dispatch radius.</p>'
            : `
              <div class="bb-table-wrapper" style="margin-bottom: 1.5rem;">
                <table class="bb-table bb-text-sm">
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th>Blood</th>
                      <th>Availability</th>
                      <th>City</th>
                      <th>Distance &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${matches.map((m) => `
                      <tr>
                        <td><strong>${escapeHtml(m.name || 'Anonymous Donor')}</strong></td>
                        <td><span class="bb-badge bb-badge-red">${escapeHtml(m.blood_group)}</span></td>
                        <td>${renderStatusBadge(m.availability)}</td>
                        <td>📍 ${escapeHtml(m.city || '—')}</td>
                        <td>${
                          m.distance_km != null
                            ? (m.routing_source === 'osrm' && m.duration_min != null)
                              ? `🚗 ${m.distance_km} km (${m.duration_min} min by road)`
                              : `📏 ~${m.distance_km} km (straight-line · time unavailable)`
                            : '<span class="bb-text-muted">Distance unavailable</span>'
                        }</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `
        }

        <!-- Donor Responses Section -->
        <h3 class="bb-heading-3" style="margin-bottom: 0.75rem; font-size: 1.05rem;">
          📬 Donor Dispatch Responses (${responses.length})
        </h3>

        ${
          acceptedResponses.length > 0 && !isFulfilled
            ? `
              <div class="bb-card" style="margin-bottom: 1.25rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); padding: 0.875rem 1rem;">
                <div class="bb-flex bb-justify-between bb-items-center" style="gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <strong style="color: #6ee7b7;">🩸 Donor Accepted!</strong>
                    <p class="bb-text-xs bb-text-muted" style="margin-top: 0.25rem;">
                      When the donor completes donation at the hospital, click <strong>"Confirm Donation Received"</strong> below to record units fulfilled.
                    </p>
                  </div>
                </div>
              </div>
            `
            : ''
        }

        ${
          responses.length === 0
            ? '<p class="bb-text-muted bb-text-sm" style="margin-bottom: 1.5rem;">Awaiting responses from notified donors.</p>'
            : `
              <div class="bb-table-wrapper" style="margin-bottom: 1.5rem;">
                <table class="bb-table bb-text-sm">
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th>Blood</th>
                      <th>Response Status</th>
                      <th>Notes</th>
                      <th>Responded</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${responses.map((resp) => {
                      const isAccepted = resp.status === 'accepted';
                      const isCompleted = resp.status === 'completed';
                      let actionHtml = '<span class="bb-text-muted bb-text-xs">—</span>';
                      if (isAccepted && !isFulfilled) {
                        actionHtml = `
                          <button class="bb-btn bb-btn-success bb-btn-sm confirm-donation-btn"
                                  data-request-id="${req.id}"
                                  data-response-id="${resp.id}"
                                  data-donor-name="${escapeHtml(resp.donor_name || 'Donor')}"
                                  data-blood-group="${escapeHtml(resp.donor_blood_group || req.blood_group)}"
                                  data-units-needed="${unitsStillNeeded}">
                            ✅ Confirm Donation Received
                          </button>
                        `;
                      } else if (isCompleted) {
                        actionHtml = '<span class="bb-badge bb-badge-green">Donation Completed</span>';
                      }

                      return `
                        <tr>
                          <td><strong>${escapeHtml(resp.donor_name || 'Donor')}</strong></td>
                          <td><span class="bb-badge bb-badge-red">${escapeHtml(resp.donor_blood_group)}</span></td>
                          <td>${renderStatusBadge(resp.status)}</td>
                          <td class="bb-text-xs">${escapeHtml(resp.notes || '—')}</td>
                          <td class="bb-text-muted bb-text-xs">${resp.responded_at ? new Date(resp.responded_at).toLocaleTimeString() : 'Pending'}</td>
                          <td>${actionHtml}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `
        }

        ${
          isFulfilled
            ? `
              <div class="bb-alert bb-alert-success" style="margin-top: 1.5rem;">
                ✅ <strong>Request Fully Fulfilled:</strong> All ${req.units_required} unit(s) of ${escapeHtml(req.blood_group)} blood have been confirmed received.
              </div>
            `
            : ''
        }

        ${
          isCancellable
            ? `
              <div class="bb-flex bb-justify-between bb-items-center" style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
                <span class="bb-text-muted bb-text-xs">No longer require this blood donation?</span>
                <button id="cancel-req-btn" class="bb-btn bb-btn-danger bb-btn-sm">
                  Cancel Blood Request
                </button>
              </div>
            `
            : ''
        }
      `;

      // Attach click listeners to Confirm Donation buttons
      modalBody.querySelectorAll('.confirm-donation-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          confirmReqIdInput.value = btn.dataset.requestId;
          confirmRespIdInput.value = btn.dataset.responseId;
          confirmDonorNameInput.value = btn.dataset.donorName;
          confirmBloodGroupInput.value = btn.dataset.bloodGroup;
          const maxUnits = parseInt(btn.dataset.unitsNeeded, 10) || 1;
          confirmUnitsInput.max = maxUnits;
          confirmUnitsInput.value = 1;
          confirmUnitsHint.textContent = `Remaining needed: ${maxUnits} unit(s)`;
          confirmNotesInput.value = '';
          confirmModalEl.style.display = 'flex';
        });
      });

      const cancelBtn = document.getElementById('cancel-req-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to cancel this blood request?')) return;
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Cancelling…';
          try {
            await cancelBloodRequest(id);
            toast.success('Request cancelled successfully.');
            closeModal();
            loadRequests();
          } catch (err) {
            console.error('Cancellation error:', err);
            toast.error(err.response?.data?.detail || 'Could not cancel request.');
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel Blood Request';
          }
        });
      }
    } catch (err) {
      console.error('Details modal error:', err);
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
