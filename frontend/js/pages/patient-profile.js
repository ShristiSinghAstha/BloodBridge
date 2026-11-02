// js/pages/patient-profile.js
// Logic for patient profile updates and password change

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { getMe, updateMe, changePassword } from '../api/auth.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('patient');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('profile');

  const profileForm = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-profile-btn');
  const profileErrorEl = document.getElementById('profile-error');

  const passwordForm = document.getElementById('password-form');
  const changePwdBtn = document.getElementById('change-pwd-btn');
  const passwordErrorEl = document.getElementById('password-error');

  // Populate form with current fresh user data from API
  async function loadFreshProfile() {
    try {
      const res = await getMe();
      const freshUser = res.data;
      auth.setUser(freshUser);

      profileForm.first_name.value = freshUser.first_name || '';
      profileForm.last_name.value = freshUser.last_name || '';
      profileForm.email.value = freshUser.email || '';
      profileForm.phone.value = freshUser.phone || '';
    } catch {
      profileForm.first_name.value = user.first_name || '';
      profileForm.last_name.value = user.last_name || '';
      profileForm.email.value = user.email || '';
      profileForm.phone.value = user.phone || '';
    }
  }

  await loadFreshProfile();

  // Save profile changes
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileErrorEl.style.display = 'none';
    profileErrorEl.textContent = '';

    const first_name = profileForm.first_name.value.trim();
    const last_name = profileForm.last_name.value.trim();
    const phone = profileForm.phone.value.trim();

    if (!first_name || !last_name) {
      profileErrorEl.textContent = 'First name and last name are required.';
      profileErrorEl.style.display = 'block';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Saving…';

    try {
      const payload = { first_name, last_name, phone };
      const res = await updateMe(payload);
      auth.setUser(res.data);
      initSidebar('profile');
      toast.success('Profile updated successfully!');
      await loadFreshProfile();
    } catch (err) {
      console.error('Update profile error:', err);
      let errorMsg = 'Could not update profile.';
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'string') errorMsg = d;
        else if (d.detail) errorMsg = d.detail;
        else {
          errorMsg = Object.entries(d)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
            .join(' | ');
        }
      }
      profileErrorEl.textContent = errorMsg;
      profileErrorEl.style.display = 'block';
      toast.error(errorMsg);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });

  // Change password
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordErrorEl.style.display = 'none';
    passwordErrorEl.textContent = '';

    const old_password = passwordForm.old_password.value;
    const new_password = passwordForm.new_password.value;

    if (!old_password || !new_password) {
      passwordErrorEl.textContent = 'Please enter both current and new passwords.';
      passwordErrorEl.style.display = 'block';
      return;
    }

    changePwdBtn.disabled = true;
    changePwdBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Updating…';

    try {
      const payload = { old_password, new_password };
      await changePassword(payload);
      toast.success('Password changed successfully.');
      passwordForm.reset();
    } catch (err) {
      console.error('Password change error:', err);
      let errorMsg = 'Failed to change password.';
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'string') errorMsg = d;
        else if (d.detail) errorMsg = d.detail;
        else {
          errorMsg = Object.entries(d)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
            .join(' | ');
        }
      }
      passwordErrorEl.textContent = errorMsg;
      passwordErrorEl.style.display = 'block';
      toast.error(errorMsg);
    } finally {
      changePwdBtn.disabled = false;
      changePwdBtn.textContent = 'Update Password';
    }
  });
});
