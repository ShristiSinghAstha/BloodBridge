// js/pages/donor-dashboard.js
// Logic for Donor Dashboard

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { getMyDonorProfile, setAvailability, getDonationHistory } from '../api/donors.js';
import { listDonorResponses, getBloodRequest } from '../api/requests.js';
import { getUnreadCount } from '../api/notifications.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('donor');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('dashboard');

  const loadingEl = document.getElementById('dashboard-loading');
  const contentEl = document.getElementById('dashboard-content');
  const titleEl = document.getElementById('donor-welcome-title');
  const subEl = document.getElementById('donor-welcome-sub');

  const alertIncomplete = document.getElementById('alert-incomplete');
  const alertUnverified = document.getElementById('alert-unverified');
  const alertInterval = document.getElementById('alert-interval');
  const daysSinceLastSpan = document.getElementById('days-since-last');

  const statBloodGroup = document.getElementById('stat-blood-group');
  const statPending = document.getElementById('stat-pending-requests');
  const statAccepted = document.getElementById('stat-accepted-requests');
  const statUnread = document.getElementById('stat-unread-notifs');
  const statTotalDonations = document.getElementById('stat-total-donations');
  const statLastDonation = document.getElementById('stat-last-donation-date');
  const badgeVerification = document.getElementById('badge-verification');
  const labelCoords = document.getElementById('label-coordinates');

  const emptyEl = document.getElementById('requests-empty');
  const emptyHint = document.getElementById('empty-state-hint');
  const tableContainer = document.getElementById('requests-table-container');
  const tbody = document.getElementById('requests-tbody');

  let currentProfile = null;
  let isUpdatingAvail = false;

  titleEl.textContent = `Donor Dashboard – ${user.first_name || 'Donor'}`;
  subEl.textContent = `Welcome back, ${user.first_name || 'Donor'}. Your donations save lives.`;

  // Availability buttons
  const availBtns = {
    available: document.getElementById('avail-available-btn'),
    busy: document.getElementById('avail-busy-btn'),
    unavailable: document.getElementById('avail-unavailable-btn'),
  };

  Object.entries(availBtns).forEach(([availKey, btn]) => {
    btn.addEventListener('click', async () => {
      if (isUpdatingAvail || currentProfile?.availability === availKey) return;
      isUpdatingAvail = true;
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Updating…';

      try {
        await setAvailability(availKey);
        currentProfile.availability = availKey;
        updateAvailabilityUI(availKey);
        toast.success(`Availability updated to ${availKey}.`);
      } catch (err) {
        toast.error(err.response?.data?.availability || 'Could not update availability.');
      } finally {
        isUpdatingAvail = false;
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  function updateAvailabilityUI(avail) {
    Object.entries(availBtns).forEach(([key, btn]) => {
      if (key === avail) {
        btn.className = `bb-btn bb-btn-sm ${key === 'available' ? 'bb-btn-primary' : 'bb-btn-outline'}`;
        btn.style.boxShadow = key === 'available' ? '0 0 10px rgba(16,185,129,0.4)' : 'none';
      } else {
        btn.className = 'bb-btn bb-btn-sm bb-btn-secondary';
        btn.style.boxShadow = 'none';
      }
    });

    if (emptyHint) {
      if (avail !== 'available') {
        emptyHint.textContent = '⚠️ You are currently marked as not available. Set status to Available to start receiving matching requests.';
      } else {
        emptyHint.textContent = 'You will receive in-app notifications when compatible patients need blood nearby.';
      }
    }
  }

  try {
    const [profileRes, responsesRes, historyRes, notifRes] = await Promise.all([
      getMyDonorProfile().catch((err) => {
        console.error('Error fetching donor profile:', err);
        return { data: {} };
      }),
      listDonorResponses().catch((err) => {
        console.error('Error fetching donor responses:', err);
        return { data: [] };
      }),
      getDonationHistory().catch((err) => {
        console.error('Error fetching donation history:', err);
        return { data: [] };
      }),
      getUnreadCount().catch(() => ({ data: { unread_count: 0 } })),
    ]);

    currentProfile = profileRes.data || {};
    const responses = responsesRes.data.results || responsesRes.data || [];
    const history = historyRes.data.results || historyRes.data || [];
    const unreadCount = notifRes.data.unread_count || 0;

    // Availability buttons
    updateAvailabilityUI(currentProfile.availability || 'available');

    // Profile Completeness Alert
    if (!currentProfile.is_profile_complete) {
      alertIncomplete.style.display = 'block';
    }

    // Verification Alert
    if (currentProfile.verification_status && currentProfile.verification_status !== 'verified') {
      alertUnverified.style.display = 'block';
    }

    // 56-day Recovery Interval Alert
    if (
      currentProfile.days_since_last_donation !== null &&
      currentProfile.days_since_last_donation !== undefined &&
      currentProfile.days_since_last_donation < 56
    ) {
      daysSinceLastSpan.textContent = currentProfile.days_since_last_donation;
      alertInterval.style.display = 'block';
    }

    // Stats
    statBloodGroup.textContent = currentProfile.blood_group || '—';
    const pendingList = responses.filter((r) => r.status === 'pending');
    const acceptedList = responses.filter((r) => r.status === 'accepted');

    statPending.textContent = pendingList.length;
    statAccepted.textContent = acceptedList.length;
    statUnread.textContent = unreadCount;

    badgeVerification.innerHTML = renderStatusBadge(currentProfile.verification_status || 'pending');
    labelCoords.textContent = currentProfile.has_coordinates ? '📍 GPS Verified' : '📍 No GPS Coords';

    statTotalDonations.textContent = history.length;
    statLastDonation.textContent = currentProfile.last_donation_date
      ? new Date(currentProfile.last_donation_date).toLocaleDateString()
      : 'Never';

    // Pending requests table
    if (pendingList.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';

      // Load request details if needed for each pending response
      const rowsHtml = await Promise.all(
        pendingList.slice(0, 5).map(async (r) => {
          let reqDetail = r.request_detail;
          if (!reqDetail && r.request) {
            try {
              const reqRes = await getBloodRequest(r.request);
              reqDetail = reqRes.data;
            } catch {
              reqDetail = null;
            }
          }

          const bloodGroup = reqDetail?.blood_group || r.donor_blood_group || currentProfile.blood_group || '—';
          const hospitalName = reqDetail?.hospital_detail?.name || 'Hospital';
          const urgency = reqDetail?.urgency || 'high';
          const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : '—';

          return `
            <tr>
              <td>
                <div class="bb-blood-pill">${escapeHtml(bloodGroup)}</div>
              </td>
              <td>${escapeHtml(hospitalName)}</td>
              <td>${renderStatusBadge(urgency)}</td>
              <td>${renderStatusBadge(r.status)}</td>
              <td class="bb-text-muted bb-text-sm">${dateStr}</td>
              <td>
                <a href="requests.html?id=${r.id}" class="bb-btn bb-btn-outline bb-btn-sm">
                  Respond
                </a>
              </td>
            </tr>
          `;
        })
      );

      tbody.innerHTML = rowsHtml.join('');
    }
  } catch (err) {
    console.error('Failed to load donor dashboard:', err);
    toast.error('Failed to load donor data.');
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

