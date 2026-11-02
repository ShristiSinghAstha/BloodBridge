// js/pages/login.js
// Logic for login page

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import { loginUser, getMe } from '../api/auth.js';
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

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('submit-btn');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');

  // Password visibility toggle
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      toggleBtn.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // Parse redirect param if present
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      errorEl.textContent = 'Please enter your email and password.';
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Signing in…';

    try {
      // 1. Get JWT tokens
      const { data: tokens } = await loginUser({ email, password });

      // 2. Temporarily set tokens in localStorage so client attaches Bearer token
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);

      // 3. Fetch user profile
      const { data: userData } = await getMe();
      auth.login(userData, tokens);

      toast.success(`Welcome back, ${userData.first_name || 'User'}!`);

      // 4. Role-based dashboards
      const dashboards = {
        patient: 'patient/dashboard.html',
        donor:   'donor/dashboard.html',
        admin:   'admin/dashboard.html',
      };
      const defaultDashboard = dashboards[userData.role] || 'index.html';

      // 5. Safe redirection
      if (from) {
        const decodedFrom = decodeURIComponent(from);
        const isFromSafe =
          (userData.role === 'admin') ||
          (userData.role === 'patient' && !decodedFrom.includes('/admin/') && !decodedFrom.includes('/donor/')) ||
          (userData.role === 'donor' && !decodedFrom.includes('/admin/') && !decodedFrom.includes('/patient/'));
        window.location.href = isFromSafe ? decodedFrom : defaultDashboard;
      } else {
        window.location.href = defaultDashboard;
      }
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      const detail = err.response?.data?.detail;
      errorEl.textContent = detail || (err.isNetworkError ? 'Network error. Please check your connection.' : 'Invalid email or password.');
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
});
