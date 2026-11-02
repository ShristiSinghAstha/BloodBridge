// js/pages/hospitals.js
// Public directory of partner hospitals

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import { listHospitals } from '../api/hospitals.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Restore session if token exists
  if (localStorage.getItem('access_token') && !auth.getUser()) {
    await auth.init();
  }

  initNavbar('hospitals');

  const loadingEl = document.getElementById('hospitals-loading');
  const containerEl = document.getElementById('hospitals-container');
  const emptyEl = document.getElementById('hospitals-empty');
  const searchInput = document.getElementById('hospital-search');

  let hospitals = [];

  async function loadHospitals() {
    loadingEl.style.display = 'flex';
    containerEl.style.display = 'none';
    emptyEl.style.display = 'none';

    try {
      const res = await listHospitals({ page_size: 100 });
      hospitals = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      renderHospitals(hospitals);
    } catch {
      containerEl.innerHTML = `
        <div class="bb-card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
          <div class="bb-alert bb-alert-error" style="margin-bottom: 1rem;">
            Failed to load hospitals list from backend.
          </div>
          <button id="retry-hospitals-btn" class="bb-btn bb-btn-primary">
            Retry Loading
          </button>
        </div>
      `;
      containerEl.style.display = 'block';
      const retryBtn = document.getElementById('retry-hospitals-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadHospitals);
      }
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  await loadHospitals();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        renderHospitals(hospitals);
        return;
      }
      const filtered = hospitals.filter((h) =>
        (h.name && h.name.toLowerCase().includes(query)) ||
        (h.city && h.city.toLowerCase().includes(query)) ||
        (h.state && h.state.toLowerCase().includes(query)) ||
        (h.address && h.address.toLowerCase().includes(query))
      );
      renderHospitals(filtered);
    });
  }

  function renderHospitals(list) {
    if (!list || list.length === 0) {
      containerEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    containerEl.style.display = 'grid';
    containerEl.innerHTML = list.map((h) => `
      <div class="bb-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="bb-flex bb-items-center bb-gap-md" style="margin-bottom: 1rem;">
            <div style="font-size: 2rem;">🏥</div>
            <div>
              <h3 class="bb-heading-3">${escapeHtml(h.name)}</h3>
              <p class="bb-text-muted bb-text-sm">${escapeHtml(h.city)}${h.state ? `, ${escapeHtml(h.state)}` : ''}</p>
            </div>
          </div>

          <div class="bb-text-sm bb-text-muted" style="margin-bottom: 0.75rem; line-height: 1.5;">
            📍 ${escapeHtml(h.address || 'Address on file')}
          </div>

          ${h.phone ? `
            <div class="bb-text-sm" style="color: var(--bb-red-400); margin-bottom: 0.5rem;">
              📞 <a href="tel:${escapeHtml(h.phone)}" style="color: inherit; text-decoration: none;">${escapeHtml(h.phone)}</a>
            </div>
          ` : ''}

          ${h.email ? `
            <div class="bb-text-sm" style="color: var(--bb-grey-400); margin-bottom: 0.75rem;">
              ✉️ <a href="mailto:${escapeHtml(h.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(h.email)}</a>
            </div>
          ` : ''}
        </div>

        <div class="bb-flex bb-gap-xs" style="flex-wrap: wrap; margin-top: 0.75rem;">
          ${h.is_verified ? `
            <span class="bb-badge bb-badge-blue" style="font-size: 0.7rem;">
              ✓ Verified Partner
            </span>
          ` : ''}
          ${h.has_coordinates ? `
            <span class="bb-badge bb-badge-green" style="font-size: 0.7rem;">
              ✓ GPS Geocoded
            </span>
          ` : ''}
        </div>
      </div>
    `).join('');
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
