// js/pages/landing.js
// Logic for BloodBridge landing page

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Try to restore user session if token exists
  if (localStorage.getItem('access_token') && !auth.getUser()) {
    await auth.init();
  }

  initNavbar('home');

  const user = auth.getUser();
  if (user) {
    const heroActions = document.getElementById('hero-actions');
    if (heroActions) {
      heroActions.innerHTML = `
        <a href="${auth.getDashboardPath()}" class="bb-btn bb-btn-primary bb-btn-lg">
          Go to Dashboard →
        </a>
      `;
    }

    const ctaSection = document.getElementById('cta-section');
    if (ctaSection) {
      ctaSection.style.display = 'none';
    }
  }
});
