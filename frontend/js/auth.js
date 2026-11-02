// js/auth.js
// Authentication manager & route protection

import { getMe, logoutUser } from './api/auth.js';

function getBasePath() {
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p.includes('/patient/') || p.includes('/donor/') || p.includes('/admin/')) {
    return '../';
  }
  return './';
}

class AuthManager {
  constructor() {
    this.user = null;
    try {
      const stored = localStorage.getItem('user');
      if (stored) this.user = JSON.parse(stored);
    } catch {
      this.user = null;
    }
  }

  getUser() {
    return this.user;
  }

  setUser(user) {
    this.user = user;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }

  async init() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.setUser(null);
      return null;
    }
    try {
      const res = await getMe();
      this.setUser(res.data);
      return res.data;
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      this.setUser(null);
      return null;
    }
  }

  login(userData, tokens) {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    this.setUser(userData);
  }

  async logout() {
    const refresh = localStorage.getItem('refresh_token');
    try {
      if (refresh) await logoutUser(refresh);
    } catch {
      // Ignore logout API failures
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.setUser(null);
    const base = getBasePath();
    window.location.href = `${base}index.html`;
  }

  isAuthenticated() {
    return !!localStorage.getItem('access_token') && !!this.user;
  }

  isPatient() {
    return this.user?.role === 'patient';
  }

  isDonor() {
    return this.user?.role === 'donor';
  }

  isAdmin() {
    return this.user?.role === 'admin';
  }

  getDashboardPath() {
    const base = getBasePath();
    if (!this.user) return `${base}login.html`;
    if (this.user.role === 'patient') return `${base}patient/dashboard.html`;
    if (this.user.role === 'donor')   return `${base}donor/dashboard.html`;
    if (this.user.role === 'admin')   return `${base}admin/dashboard.html`;
    return `${base}index.html`;
  }

  /**
   * Guards protected pages.
   * Checks token and verifies user role.
   * If invalid, redirects appropriately.
   */
  async requireAuth(requiredRole = null) {
    const base = getBasePath();
    const token = localStorage.getItem('access_token');
    if (!token) {
      const current = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${base}login.html?from=${current}`;
      return null;
    }

    let user = this.getUser();
    if (!user) {
      user = await this.init();
    }

    if (!user) {
      const current = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${base}login.html?from=${current}`;
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      // Wrong role: redirect to user's assigned dashboard
      window.location.href = this.getDashboardPath();
      return null;
    }

    return user;
  }
}

export const auth = new AuthManager();
export default auth;
