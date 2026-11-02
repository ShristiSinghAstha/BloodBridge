// js/pages/admin-hospitals.js
// Logic for Admin Hospital Network Management

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from '../api/hospitals.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('admin');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('hospitals');

  const loadingEl = document.getElementById('hospitals-loading');
  const contentEl = document.getElementById('hospitals-content');
  const emptyEl = document.getElementById('hospitals-empty');
  const tableContainer = document.getElementById('hospitals-table-container');
  const tbody = document.getElementById('hospitals-tbody');
  const refreshBtn = document.getElementById('refresh-hospitals-btn');
  const addBtn = document.getElementById('add-hospital-btn');

  const searchInput = document.getElementById('hospital-search');
  const statusFilter = document.getElementById('filter-hospital-status');

  const modalEl = document.getElementById('hospital-modal');
  const modalTitle = document.getElementById('hospital-modal-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('cancel-hospital-btn');
  const formEl = document.getElementById('hospital-form');
  const formErrorEl = document.getElementById('hospital-form-error');

  const idInput = document.getElementById('hospital-id');
  const nameInput = document.getElementById('hospital-name');
  const phoneInput = document.getElementById('hospital-phone');
  const emailInput = document.getElementById('hospital-email');
  const addressInput = document.getElementById('hospital-address');
  const cityInput = document.getElementById('hospital-city');
  const stateInput = document.getElementById('hospital-state');
  const countryInput = document.getElementById('hospital-country');
  const latInput = document.getElementById('hospital-latitude');
  const lngInput = document.getElementById('hospital-longitude');
  const activeInput = document.getElementById('hospital-active');
  const verifiedInput = document.getElementById('hospital-verified');

  let allHospitals = [];

  refreshBtn.addEventListener('click', loadHospitals);
  addBtn.addEventListener('click', openAddModal);
  searchInput.addEventListener('input', applyFilters);
  statusFilter.addEventListener('change', applyFilters);

  modalCloseBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  formEl.addEventListener('submit', handleFormSubmit);

  function closeModal() {
    modalEl.style.display = 'none';
    formErrorEl.style.display = 'none';
    formErrorEl.textContent = '';
  }

  function openAddModal() {
    idInput.value = '';
    formEl.reset();
    countryInput.value = 'India';
    activeInput.checked = true;
    verifiedInput.checked = false;
    modalTitle.textContent = 'Register New Hospital';
    formErrorEl.style.display = 'none';
    formErrorEl.textContent = '';
    modalEl.style.display = 'flex';
  }

  function openEditModal(hospital) {
    idInput.value = hospital.id;
    nameInput.value = hospital.name || '';
    phoneInput.value = hospital.phone || '';
    emailInput.value = hospital.email || '';
    addressInput.value = hospital.address || '';
    cityInput.value = hospital.city || '';
    stateInput.value = hospital.state || '';
    countryInput.value = hospital.country || 'India';
    latInput.value = hospital.latitude ?? '';
    lngInput.value = hospital.longitude ?? '';
    activeInput.checked = Boolean(hospital.is_active);
    verifiedInput.checked = Boolean(hospital.is_verified);

    modalTitle.textContent = `Edit Hospital: ${hospital.name}`;
    formErrorEl.style.display = 'none';
    formErrorEl.textContent = '';
    modalEl.style.display = 'flex';
  }

  async function loadHospitals() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const res = await listHospitals();
      allHospitals = res.data.results || res.data || [];
      applyFilters();
    } catch (err) {
      console.error('Failed to load hospitals:', err);
      toast.error('Failed to retrieve hospital network.');
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const filter = statusFilter.value;

    const filtered = allHospitals.filter((h) => {
      const name = (h.name || '').toLowerCase();
      const city = (h.city || '').toLowerCase();
      const state = (h.state || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || city.includes(q) || state.includes(q);

      let matchesStatus = true;
      if (filter === 'active') matchesStatus = Boolean(h.is_active);
      else if (filter === 'inactive') matchesStatus = !h.is_active;
      else if (filter === 'verified') matchesStatus = Boolean(h.is_verified);

      return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      tableContainer.style.display = 'block';

      tbody.innerHTML = filtered.map((h) => {
        const coordsStr = (h.latitude && h.longitude)
          ? `📍 ${parseFloat(h.latitude).toFixed(4)}, ${parseFloat(h.longitude).toFixed(4)}`
          : '<span class="bb-text-muted">No GPS coordinates</span>';

        const statusBadge = h.is_active
          ? '<span class="bb-badge bb-badge-success">Active</span>'
          : '<span class="bb-badge bb-badge-neutral">Inactive</span>';

        const verifiedBadge = h.is_verified
          ? '<span class="bb-badge bb-badge-info bb-text-xs" style="margin-left: 0.5rem;">✓ Verified</span>'
          : '';

        return `
          <tr>
            <td>
              <strong>${escapeHtml(h.name)}</strong>
              ${verifiedBadge}
              <div class="bb-text-xs bb-text-muted" style="max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(h.address || '—')}
              </div>
            </td>
            <td>
              <strong>${escapeHtml(h.city || '—')}</strong>, ${escapeHtml(h.state || '—')}
              <div class="bb-text-xs bb-text-muted">${escapeHtml(h.country || 'India')}</div>
            </td>
            <td class="bb-text-sm">
              <div>📞 ${escapeHtml(h.phone || '—')}</div>
              <div class="bb-text-xs bb-text-muted">✉️ ${escapeHtml(h.email || '—')}</div>
            </td>
            <td class="bb-text-xs">${coordsStr}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="bb-flex bb-gap-xs">
                <button class="bb-btn bb-btn-outline bb-btn-sm edit-hospital-btn" data-id="${h.id}">
                  Edit
                </button>
                <button class="bb-btn bb-btn-danger bb-btn-sm delete-hospital-btn" data-id="${h.id}" data-name="${escapeHtml(h.name)}">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.edit-hospital-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hospId = parseInt(btn.dataset.id, 10);
          const hosp = allHospitals.find((x) => x.id === hospId);
          if (hosp) openEditModal(hosp);
        });
      });

      tbody.querySelectorAll('.delete-hospital-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const hospId = parseInt(btn.dataset.id, 10);
          const hospName = btn.dataset.name;
          if (!confirm(`Are you sure you want to delete ${hospName}? This action cannot be undone.`)) return;

          try {
            await deleteHospital(hospId);
            toast.success(`Hospital "${hospName}" removed successfully.`);
            loadHospitals();
          } catch (err) {
            console.error('Delete error:', err);
            const msg = err.response?.data?.detail || 'Failed to delete hospital.';
            toast.error(msg);
          }
        });
      });
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    formErrorEl.style.display = 'none';

    const id = idInput.value;
    const isEdit = Boolean(id);

    const payload = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      address: addressInput.value.trim(),
      city: cityInput.value.trim(),
      state: stateInput.value.trim(),
      country: countryInput.value.trim() || 'India',
      latitude: latInput.value ? parseFloat(latInput.value) : null,
      longitude: lngInput.value ? parseFloat(lngInput.value) : null,
      is_active: activeInput.checked,
      is_verified: verifiedInput.checked,
    };

    if (!payload.name || !payload.address || !payload.city || !payload.state) {
      formErrorEl.textContent = 'Please fill in all required fields (Name, Address, City, State).';
      formErrorEl.style.display = 'block';
      return;
    }

    try {
      if (isEdit) {
        await updateHospital(id, payload);
        toast.success(`Hospital "${payload.name}" updated successfully.`);
      } else {
        await createHospital(payload);
        toast.success(`Hospital "${payload.name}" registered successfully.`);
      }
      closeModal();
      loadHospitals();
    } catch (err) {
      console.error('Save hospital error:', err);
      let errorMsg = 'Failed to save hospital details.';
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
      formErrorEl.textContent = errorMsg;
      formErrorEl.style.display = 'block';
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

  loadHospitals();
});

