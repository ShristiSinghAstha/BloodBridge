// js/pages/register.js
// Logic for registration page

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import { registerUser } from '../api/auth.js';
import { updateMyDonorProfile, createDonorProfile } from '../api/donors.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Restore session if token exists
  if (localStorage.getItem('access_token') && !auth.getUser()) {
    await auth.init();
  }

  // If already authenticated, redirect to role dashboard
  if (auth.isAuthenticated()) {
    window.location.href = auth.getDashboardPath();
    return;
  }

  initNavbar();

  const form = document.getElementById('register-form');
  const roleInput = document.getElementById('role');
  const patientBtn = document.getElementById('role-patient-btn');
  const donorBtn = document.getElementById('role-donor-btn');
  const donorFieldsEl = document.getElementById('donor-fields');
  const generalErrorEl = document.getElementById('general-error');
  const submitBtn = document.getElementById('submit-btn');

  const passwordInput = document.getElementById('password');
  const password2Input = document.getElementById('password2');
  const togglePassBtn = document.getElementById('toggle-reg-password');
  const togglePass2Btn = document.getElementById('toggle-reg-password2');

  // Password visibility toggles
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPass ? 'text' : 'password');
      togglePassBtn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (togglePass2Btn && password2Input) {
    togglePass2Btn.addEventListener('click', () => {
      const isPass = password2Input.getAttribute('type') === 'password';
      password2Input.setAttribute('type', isPass ? 'text' : 'password');
      togglePass2Btn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // URL search params: ?role=donor or ?role=patient
  const params = new URLSearchParams(window.location.search);
  const initialRole = params.get('role') === 'donor' ? 'donor' : 'patient';
  setRole(initialRole);

  patientBtn.addEventListener('click', () => setRole('patient'));
  donorBtn.addEventListener('click', () => setRole('donor'));

  function setRole(r) {
    // Only patient or donor allowed
    const validRole = r === 'donor' ? 'donor' : 'patient';
    roleInput.value = validRole;
    if (validRole === 'patient') {
      patientBtn.className = 'bb-btn bb-btn-primary bb-w-full';
      donorBtn.className = 'bb-btn bb-btn-secondary bb-w-full';
      if (donorFieldsEl) donorFieldsEl.style.display = 'none';
    } else {
      patientBtn.className = 'bb-btn bb-btn-secondary bb-w-full';
      donorBtn.className = 'bb-btn bb-btn-primary bb-w-full';
      if (donorFieldsEl) donorFieldsEl.style.display = 'block';
    }
  }

  function clearErrors() {
    generalErrorEl.style.display = 'none';
    generalErrorEl.textContent = '';
    ['first_name', 'last_name', 'email', 'phone', 'password', 'password2', 'blood_group', 'city', 'state'].forEach((field) => {
      const el = document.getElementById(`err-${field}`);
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

    const role = roleInput.value === 'donor' ? 'donor' : 'patient';
    const payload = {
      first_name: form.first_name.value.trim(),
      last_name:  form.last_name.value.trim(),
      email:      form.email.value.trim(),
      phone:      form.phone.value.trim(),
      role:       role,
      password:   form.password.value,
      password2:  form.password2.value,
    };

    // Client-side validations
    let hasClientErrors = false;
    if (!payload.first_name) {
      setFieldError('first_name', 'First name is required.');
      hasClientErrors = true;
    }
    if (!payload.last_name) {
      setFieldError('last_name', 'Last name is required.');
      hasClientErrors = true;
    }
    if (!payload.email) {
      setFieldError('email', 'Email is required.');
      hasClientErrors = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        setFieldError('email', 'Please enter a valid email address.');
        hasClientErrors = true;
      }
    }
    if (!payload.password) {
      setFieldError('password', 'Password is required.');
      hasClientErrors = true;
    } else if (payload.password.length < 8) {
      setFieldError('password', 'Password must be at least 8 characters.');
      hasClientErrors = true;
    }
    if (!payload.password2) {
      setFieldError('password2', 'Please confirm your password.');
      hasClientErrors = true;
    } else if (payload.password !== payload.password2) {
      setFieldError('password2', 'Passwords do not match.');
      hasClientErrors = true;
    }

    // Donor-specific validations
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    let donorData = null;
    if (role === 'donor') {
      const bloodGroup = form.blood_group ? form.blood_group.value : '';
      const city = form.city ? form.city.value.trim() : '';
      const state = form.state ? form.state.value.trim() : '';

      if (!bloodGroup) {
        setFieldError('blood_group', 'Please select your blood group.');
        hasClientErrors = true;
      } else if (!validBloodGroups.includes(bloodGroup)) {
        setFieldError('blood_group', 'Invalid blood group selected.');
        hasClientErrors = true;
      }

      if (!city) {
        setFieldError('city', 'City is required for donor matching.');
        hasClientErrors = true;
      }

      donorData = {
        blood_group: bloodGroup,
        city: city,
        state: state,
        availability: 'available',
      };
    }

    if (hasClientErrors) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Creating account…';

    try {
      // 1. Create User account via Register API
      const { data } = await registerUser(payload);
      auth.login(data.user, data.tokens);

      // 2. If Donor, create and verify DonorProfile
      if (role === 'donor' && donorData) {
        submitBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Setting up donor profile…';
        try {
          const profRes = await updateMyDonorProfile(donorData);
          if (!profRes.data || !profRes.data.blood_group) {
            throw new Error('Donor profile creation was not confirmed by the server.');
          }
        } catch (profErr) {
          console.warn('Initial updateMyDonorProfile attempt had warning, trying createDonorProfile:', profErr);
          const createRes = await createDonorProfile(donorData);
          if (!createRes.data || !createRes.data.blood_group) {
            throw new Error('Donor profile creation failed.');
          }
        }
      }

      toast.success(`Welcome to BloodBridge, ${data.user.first_name || 'User'}!`);

      const dashboards = {
        patient: 'patient/dashboard.html',
        donor:   'donor/dashboard.html',
        admin:   'admin/dashboard.html',
      };
      window.location.href = dashboards[data.user.role] || 'index.html';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';

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
        const errorText = err.isNetworkError
          ? 'Network error. Please check your connection and try again.'
          : (err.message || 'Registration failed. Please try again.');
        generalErrorEl.textContent = errorText;
        generalErrorEl.style.display = 'block';
      }
    }
  });
});
