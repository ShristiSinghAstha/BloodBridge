// js/pages/donor-profile.js
// Logic for Donor Profile management

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { getMe, updateMe } from '../api/auth.js';
import { getMyDonorProfile, updateMyDonorProfile } from '../api/donors.js';
import renderStatusBadge from '../components/status-badge.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('donor');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('profile');

  const loadingEl = document.getElementById('profile-loading');
  const contentEl = document.getElementById('profile-content');
  const form = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-profile-btn');
  const gpsBtn = document.getElementById('detect-gps-btn');
  const generalErrorEl = document.getElementById('general-error');

  const badgeVerif = document.getElementById('badge-verification-status');
  const verifNote = document.getElementById('verification-note');
  const badgeComplete = document.getElementById('badge-completeness');
  const badgeEligible = document.getElementById('badge-eligibility');
  const eligibleNote = document.getElementById('eligibility-note');

  let currentProfile = {};
  let currentUser = {};

  async function loadProfile() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const [uRes, pRes] = await Promise.all([
        getMe(),
        getMyDonorProfile(),
      ]);

      currentUser = uRes.data || {};
      currentProfile = pRes.data || {};

      // Fill user fields
      form.first_name.value = currentUser.first_name || '';
      form.last_name.value  = currentUser.last_name || '';
      form.email.value      = currentUser.email || '';
      form.phone.value      = currentUser.phone || '';

      // Fill donor fields
      form.blood_group.value        = currentProfile.blood_group || '';
      form.date_of_birth.value      = currentProfile.date_of_birth || '';
      form.last_donation_date.value = currentProfile.last_donation_date || '';
      form.availability.value       = currentProfile.availability || 'available';
      form.address.value            = currentProfile.address || '';
      form.city.value               = currentProfile.city || '';
      form.state.value              = currentProfile.state || '';
      form.latitude.value           = currentProfile.latitude ?? '';
      form.longitude.value          = currentProfile.longitude ?? '';

      // Render Status Badges
      renderStatusOverview();
    } catch (err) {
      console.error('Failed to load donor profile:', err);
      toast.error('Failed to load profile details.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function renderStatusOverview() {
    // 1. Verification
    const verif = currentProfile.verification_status || 'pending';
    badgeVerif.innerHTML = renderStatusBadge(verif);
    if (verif === 'verified') {
      verifNote.textContent = '✓ Profile verified by administrators. Active in matching.';
    } else if (verif === 'pending') {
      verifNote.textContent = '⏳ Pending admin review. Fill all fields to expedite approval.';
    } else {
      verifNote.textContent = `Status: ${verif}. Please contact support.`;
    }

    // 2. Completeness
    if (currentProfile.is_profile_complete) {
      badgeComplete.innerHTML = '<span class="bb-badge bb-badge-green">Complete</span>';
    } else {
      badgeComplete.innerHTML = '<span class="bb-badge bb-badge-yellow">Incomplete</span>';
    }

    // 3. 56-Day Medical Eligibility
    if (currentProfile.is_eligible_by_interval) {
      badgeEligible.innerHTML = '<span class="bb-badge bb-badge-green">Eligible</span>';
      if (currentProfile.days_since_last_donation !== null && currentProfile.days_since_last_donation !== undefined) {
        eligibleNote.textContent = `${currentProfile.days_since_last_donation} days since last donation (>= 56 days).`;
      } else {
        eligibleNote.textContent = 'No prior donation interval restrictions.';
      }
    } else {
      badgeEligible.innerHTML = '<span class="bb-badge bb-badge-yellow">Recovery Period</span>';
      eligibleNote.textContent = `${currentProfile.days_since_last_donation} days since last donation. 56 days recommended.`;
    }
  }

  // Geolocation detection
  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    gpsBtn.disabled = true;
    gpsBtn.textContent = 'Detecting…';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        form.latitude.value = lat;
        form.longitude.value = lng;
        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 Detect GPS Coordinates';
        toast.success(`Coordinates found: ${lat}, ${lng}`);
      },
      (err) => {
        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 Detect GPS Coordinates';
        toast.error(`GPS Error: ${err.message || 'Permission denied'}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });

  function clearErrors() {
    generalErrorEl.style.display = 'none';
    generalErrorEl.textContent = '';
    ['first_name', 'last_name', 'phone', 'blood_group', 'city'].forEach((f) => {
      const el = document.getElementById(`err-${f}`);
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    });
  }

  function setFieldError(field, msg) {
    const el = document.getElementById(`err-${field}`);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const firstName = form.first_name.value.trim();
    const lastName  = form.last_name.value.trim();
    const phone     = form.phone.value.trim();
    const bloodGroup = form.blood_group.value;
    const dob       = form.date_of_birth.value || null;
    const lastDate  = form.last_donation_date.value || null;
    const avail     = form.availability.value;
    const address   = form.address.value.trim();
    const city      = form.city.value.trim();
    const state     = form.state.value.trim();
    const lat       = form.latitude.value ? parseFloat(form.latitude.value) : null;
    const lng       = form.longitude.value ? parseFloat(form.longitude.value) : null;

    let hasErrors = false;
    if (!firstName) {
      setFieldError('first_name', 'First name is required.');
      hasErrors = true;
    }
    if (!lastName) {
      setFieldError('last_name', 'Last name is required.');
      hasErrors = true;
    }
    if (!bloodGroup) {
      setFieldError('blood_group', 'Blood group is required.');
      hasErrors = true;
    }
    if (!city) {
      setFieldError('city', 'City is required for location matching.');
      hasErrors = true;
    }

    if (hasErrors) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Saving changes…';

    try {
      // 1. Update basic user data
      const userPayload = {
        first_name: firstName,
        last_name:  lastName,
      };
      if (phone) userPayload.phone = phone;
      await updateMe(userPayload);

      // 2. Update donor profile data
      const donorPayload = {
        blood_group: bloodGroup,
        availability: avail,
        address,
        city,
        state,
      };
      if (dob) donorPayload.date_of_birth = dob;
      if (lastDate) donorPayload.last_donation_date = lastDate;
      if (lat !== null && !isNaN(lat)) donorPayload.latitude = lat;
      if (lng !== null && !isNaN(lng)) donorPayload.longitude = lng;

      const updatedProfileRes = await updateMyDonorProfile(donorPayload);
      currentProfile = updatedProfileRes.data || {};

      // 3. Refresh user session in auth manager
      await auth.init();
      initSidebar('profile');

      renderStatusOverview();
      toast.success('Donor profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);
      const apiErrors = err.response?.data;
      if (apiErrors && typeof apiErrors === 'object') {
        Object.entries(apiErrors).forEach(([field, msgs]) => {
          const msg = Array.isArray(msgs) ? msgs[0] : msgs;
          if (field === 'non_field_errors' || field === 'detail') {
            generalErrorEl.textContent = msg;
            generalErrorEl.style.display = 'block';
          } else {
            setFieldError(field, msg);
          }
        });
      } else {
        toast.error('Failed to save profile changes.');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Profile Changes';
    }
  });

  loadProfile();
});

