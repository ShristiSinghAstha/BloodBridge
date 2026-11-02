// js/components/navbar.js
// Shared navigation bar component for all pages

import auth from '../auth.js';

function getBasePath() {
  const p = window.location.pathname;
  if (p.includes('/patient/') || p.includes('/donor/') || p.includes('/admin/')) {
    return '../';
  }
  return './';
}

export function initNavbar(activeItem = '') {
  const navContainer = document.getElementById('bb-navbar') || document.querySelector('nav.bb-nav');
  if (!navContainer) return;

  const base = getBasePath();
  const user = auth.getUser();
  const isAuthenticated = !!user;

  let dashboardUrl = `${base}patient/dashboard.html`;
  if (user?.role === 'donor') dashboardUrl = `${base}donor/dashboard.html`;
  else if (user?.role === 'admin') dashboardUrl = `${base}admin/dashboard.html`;

  navContainer.className = 'bb-nav';
  navContainer.innerHTML = `
    <a href="${base}index.html" class="bb-nav-logo">
      <span class="logo-dot"></span>
      <span>Blood<span class="bb-text-gradient">Bridge</span></span>
    </a>

    <ul class="bb-nav-links">
      <li>
        <a href="${base}index.html" class="bb-nav-link ${activeItem === 'home' ? 'active' : ''}">
          Home
        </a>
      </li>
      <li>
        <a href="${base}hospitals.html" class="bb-nav-link ${activeItem === 'hospitals' ? 'active' : ''}">
          Hospitals
        </a>
      </li>
      <li>
        <a href="${base}about.html" class="bb-nav-link ${activeItem === 'about' ? 'active' : ''}">
          About
        </a>
      </li>
      ${
        !isAuthenticated
          ? `
          <li>
            <a href="${base}login.html" class="bb-btn bb-btn-secondary bb-btn-sm">Sign In</a>
          </li>
          <li>
            <a href="${base}register.html" class="bb-btn bb-btn-primary bb-btn-sm">Join Now</a>
          </li>
          `
          : `
          <li>
            <a href="${dashboardUrl}" class="bb-nav-link ${activeItem === 'dashboard' ? 'active' : ''}">
              Dashboard
            </a>
          </li>
          <li>
            <button id="bb-logout-btn" class="bb-btn bb-btn-secondary bb-btn-sm">
              Sign Out
            </button>
          </li>
          `
      }
    </ul>

    <button id="bb-mobile-toggle" class="bb-nav-mobile-toggle" aria-label="Toggle navigation menu" style="display: none; background: none; border: none; font-size: 1.5rem; color: #fff; cursor: pointer;">
      ☰
    </button>
  `;

  // Insert or handle mobile menu dropdown
  let mobileMenu = document.getElementById('bb-mobile-menu');
  if (!mobileMenu) {
    mobileMenu = document.createElement('div');
    mobileMenu.id = 'bb-mobile-menu';
    mobileMenu.style.cssText = 'display: none; flex-direction: column; gap: 0.75rem; padding: 1rem 1.5rem; background: var(--bb-dark-800); border-bottom: 1px solid rgba(255,255,255,0.08);';
    navContainer.parentNode.insertBefore(mobileMenu, navContainer.nextSibling);
  }

  mobileMenu.innerHTML = `
    <a href="${base}index.html" class="bb-nav-link ${activeItem === 'home' ? 'active' : ''}" style="padding: 0.5rem 0;">Home</a>
    <a href="${base}hospitals.html" class="bb-nav-link ${activeItem === 'hospitals' ? 'active' : ''}" style="padding: 0.5rem 0;">Hospitals</a>
    <a href="${base}about.html" class="bb-nav-link ${activeItem === 'about' ? 'active' : ''}" style="padding: 0.5rem 0;">About</a>
    ${
      !isAuthenticated
        ? `
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <a href="${base}login.html" class="bb-btn bb-btn-secondary bb-btn-sm" style="flex: 1; justify-content: center;">Sign In</a>
          <a href="${base}register.html" class="bb-btn bb-btn-primary bb-btn-sm" style="flex: 1; justify-content: center;">Join Now</a>
        </div>
        `
        : `
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <a href="${dashboardUrl}" class="bb-btn bb-btn-primary bb-btn-sm" style="flex: 1; justify-content: center;">Dashboard</a>
          <button id="bb-mobile-logout-btn" class="bb-btn bb-btn-secondary bb-btn-sm" style="flex: 1; justify-content: center;">Sign Out</button>
        </div>
        `
    }
  `;

  const toggleBtn = document.getElementById('bb-mobile-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      mobileMenu.style.display = mobileMenu.style.display === 'none' ? 'flex' : 'none';
    });
  }

  // Attach logout handler if present
  const logoutBtn = document.getElementById('bb-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Signing out…';
      await auth.logout();
    });
  }

  const mobileLogoutBtn = document.getElementById('bb-mobile-logout-btn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', async () => {
      mobileLogoutBtn.disabled = true;
      mobileLogoutBtn.textContent = 'Signing out…';
      await auth.logout();
    });
  }
}

export default initNavbar;
