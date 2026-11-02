// js/pages/donor-requests.js
// Logic for Donor Incoming Requests & response actions

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { listDonorResponses, acceptResponse, rejectResponse, getBloodRequest } from '../api/requests.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('donor');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('requests');

  const loadingEl = document.getElementById('requests-loading');
  const contentEl = document.getElementById('requests-content');
  const refreshBtn = document.getElementById('refresh-btn');

  const pendingSection = document.getElementById('pending-section');
  const pendingCountTitle = document.getElementById('pending-count-title');
  const pendingEmpty = document.getElementById('pending-empty');
  const pendingGrid = document.getElementById('pending-grid');

  const pastSection = document.getElementById('past-section');
  const pastEmpty = document.getElementById('past-empty');
  const pastTableContainer = document.getElementById('past-table-container');
  const pastTbody = document.getElementById('past-tbody');

  let allResponses = [];
  let currentFilter = 'all';
  let actingId = null;

  refreshBtn.addEventListener('click', loadResponses);

  // Setup filter buttons
  ['all', 'pending', 'accepted', 'rejected'].forEach((fKey) => {
    const btn = document.getElementById(`filter-${fKey}`);
    if (btn) {
      btn.addEventListener('click', () => {
        currentFilter = fKey;
        ['all', 'pending', 'accepted', 'rejected'].forEach((k) => {
          const b = document.getElementById(`filter-${k}`);
          if (b) {
            b.className = `bb-btn bb-btn-sm ${k === fKey ? 'bb-btn-primary' : 'bb-btn-secondary'}`;
          }
        });
        renderView();
      });
    }
  });

  async function loadResponses() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const res = await listDonorResponses();
      const rawResponses = res.data.results || res.data || [];

      // Fetch request details in parallel for each response
      allResponses = await Promise.all(
        rawResponses.map(async (r) => {
          let reqDetail = r.request_detail || null;
          if (!reqDetail && r.request) {
            try {
              const reqRes = await getBloodRequest(r.request);
              reqDetail = reqRes.data;
            } catch {
              reqDetail = null;
            }
          }
          return {
            ...r,
            request_detail: reqDetail,
          };
        })
      );

      renderView();

      // Check if URL has ?id=... to highlight specific response card
      const params = new URLSearchParams(window.location.search);
      const highlightId = params.get('id');
      if (highlightId) {
        setTimeout(() => {
          const targetCard = document.getElementById(`response-card-${highlightId}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.style.outline = '2px solid var(--bb-red-500)';
          }
        }, 150);
      }
    } catch (err) {
      console.error('Failed to load incoming requests:', err);
      toast.error('Could not load incoming blood requests.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function renderView() {
    const pendingList = allResponses.filter((r) => r.status === 'pending');
    const acceptedList = allResponses.filter((r) => r.status === 'accepted');
    const rejectedList = allResponses.filter((r) => r.status === 'rejected');
    const pastList = allResponses.filter((r) => r.status !== 'pending');

    pendingCountTitle.textContent = `Pending Requests (${pendingList.length})`;

    // Filter logic
    if (currentFilter === 'pending') {
      pendingSection.style.display = 'block';
      pastSection.style.display = 'none';
    } else if (currentFilter === 'accepted' || currentFilter === 'rejected') {
      pendingSection.style.display = 'none';
      pastSection.style.display = 'block';
    } else {
      pendingSection.style.display = 'block';
      pastSection.style.display = 'block';
    }

    // Render Pending Cards
    if (pendingList.length === 0) {
      pendingEmpty.style.display = 'block';
      pendingGrid.innerHTML = '';
    } else {
      pendingEmpty.style.display = 'none';
      pendingGrid.innerHTML = pendingList.map((r) => {
        const req = r.request_detail;
        const bloodGroup = req?.blood_group || r.donor_blood_group || '—';
        const hospitalName = req?.hospital_detail?.name || 'Hospital';
        const hospitalCity = req?.hospital_detail?.city || 'City';
        const hospitalAddress = req?.hospital_detail?.address || '';
        const units = req?.units_required || 1;
        const urgency = req?.urgency || 'critical';
        const requiredBy = req?.required_by ? new Date(req.required_by).toLocaleString() : null;
        const isActing = actingId === r.id;

        return `
          <div id="response-card-${r.id}" class="bb-card bb-card-red" style="position: relative;">
            <div class="bb-flex bb-justify-between bb-items-center" style="margin-bottom: 1rem;">
              <div class="bb-flex bb-items-center bb-gap-sm">
                <div class="bb-blood-pill">${escapeHtml(bloodGroup)}</div>
                <div>
                  <span class="bb-text-xs bb-text-muted" style="display: block;">Needed Group</span>
                  <strong style="font-size: 0.9375rem;">${escapeHtml(bloodGroup)}</strong>
                </div>
              </div>
              <div class="bb-flex bb-gap-xs">
                ${renderStatusBadge(urgency)}
                ${renderStatusBadge(r.status)}
              </div>
            </div>

            <h3 class="bb-heading-3" style="margin-bottom: 0.25rem;">
              ${escapeHtml(hospitalName)}
            </h3>
            <p class="bb-text-muted bb-text-sm" style="margin-bottom: 0.75rem;">
              📍 ${escapeHtml(hospitalCity)}${hospitalAddress ? ` • ${escapeHtml(hospitalAddress)}` : ''}
            </p>

            <div class="bb-card" style="padding: 0.75rem 1rem; margin-bottom: 1.25rem; background: rgba(0,0,0,0.2);">
              <div class="bb-flex bb-justify-between bb-text-sm">
                <span><strong>Units needed:</strong> ${units} unit(s)</span>
                ${requiredBy ? `<span><strong>Required by:</strong> ${requiredBy}</span>` : ''}
              </div>
              ${req?.description ? `
                <div class="bb-text-xs bb-text-muted" style="margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.5rem;">
                  ${escapeHtml(req.description)}
                </div>
              ` : ''}
            </div>

            <div class="bb-flex bb-gap-sm">
              <button
                class="bb-btn bb-btn-primary accept-btn"
                data-id="${r.id}"
                style="flex: 1; justify-content: center;"
                ${isActing ? 'disabled' : ''}
              >
                ${isActing ? '<div class="bb-spinner bb-spinner-sm"></div>' : '✅ Accept'}
              </button>
              <button
                class="bb-btn bb-btn-secondary reject-btn"
                data-id="${r.id}"
                style="flex: 1; justify-content: center;"
                ${isActing ? 'disabled' : ''}
              >
                ${isActing ? '<div class="bb-spinner bb-spinner-sm"></div>' : '✗ Decline'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Attach button handlers
      pendingGrid.querySelectorAll('.accept-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleAccept(btn.dataset.id));
      });
      pendingGrid.querySelectorAll('.reject-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleReject(btn.dataset.id));
      });
    }

    // Filter Past Responses Table
    let filteredPast = pastList;
    if (currentFilter === 'accepted') filteredPast = acceptedList;
    if (currentFilter === 'rejected') filteredPast = rejectedList;

    if (filteredPast.length === 0) {
      pastEmpty.style.display = 'block';
      pastTableContainer.style.display = 'none';
    } else {
      pastEmpty.style.display = 'none';
      pastTableContainer.style.display = 'block';
      pastTbody.innerHTML = filteredPast.map((r) => {
        const req = r.request_detail;
        const hospitalName = req?.hospital_detail?.name || 'Hospital';
        const bloodGroup = req?.blood_group || r.donor_blood_group || '—';
        const units = req?.units_required || 1;
        const dateStr = r.responded_at ? new Date(r.responded_at).toLocaleDateString() : '—';

        return `
          <tr>
            <td>
              <strong>${escapeHtml(hospitalName)}</strong>
              ${req?.hospital_detail?.city ? `<br><span class="bb-text-xs bb-text-muted">${escapeHtml(req.hospital_detail.city)}</span>` : ''}
            </td>
            <td><div class="bb-blood-pill" style="width: 34px; height: 34px; font-size: 0.75rem;">${escapeHtml(bloodGroup)}</div></td>
            <td>${units}</td>
            <td>${renderStatusBadge(r.status)}</td>
            <td class="bb-text-muted bb-text-sm">${dateStr}</td>
          </tr>
        `;
      }).join('');
    }
  }

  async function handleAccept(responseId) {
    if (actingId) return;
    actingId = responseId;
    renderView();

    try {
      await acceptResponse(responseId);
      toast.success('Request accepted! Please proceed to the hospital.');
      await loadResponses();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not accept blood request.';
      toast.error(msg);
    } finally {
      actingId = null;
      renderView();
    }
  }

  async function handleReject(responseId) {
    if (actingId) return;
    actingId = responseId;
    renderView();

    try {
      await rejectResponse(responseId);
      toast.info('Blood request declined.');
      await loadResponses();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not decline blood request.';
      toast.error(msg);
    } finally {
      actingId = null;
      renderView();
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

  loadResponses();
});

