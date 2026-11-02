// js/pages/patient-new-request.js
// Logic for creating a new blood request

import auth from '../auth.js';
import initNavbar from '../components/navbar.js';
import initSidebar from '../components/sidebar.js';
import { createBloodRequest } from '../api/requests.js';
import { listHospitals } from '../api/hospitals.js';
import toast from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.requireAuth('patient');
  if (!user) return;

  initNavbar('dashboard');
  initSidebar('new-request');

  const form = document.getElementById('new-request-form');
  const hospitalSelect = document.getElementById('hospital');
  const submitBtn = document.getElementById('submit-btn');
  const generalErrorEl = document.getElementById('general-error');

  // Load hospitals
  try {
    const res = await listHospitals({ page_size: 100 });
    const hospitals = res.data.results || res.data || [];
    hospitals.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `${h.name} – ${h.city}`;
      hospitalSelect.appendChild(opt);
    });
  } catch {
    toast.error('Could not load hospitals list.');
  }

  function clearErrors() {
    generalErrorEl.style.display = 'none';
    generalErrorEl.textContent = '';
    ['blood_group', 'units_required', 'hospital'].forEach((field) => {
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

    const blood_group = form.blood_group.value;
    const units_required = Number(form.units_required.value);
    const hospital = form.hospital.value;
    const urgency = form.urgency.value;
    const required_by = form.required_by.value || undefined;
    const description = form.description.value.trim();

    let hasErrors = false;
    if (!blood_group) {
      setFieldError('blood_group', 'Select a blood group.');
      hasErrors = true;
    }
    if (!hospital) {
      setFieldError('hospital', 'Select a hospital.');
      hasErrors = true;
    }
    if (!units_required || units_required < 1) {
      setFieldError('units_required', 'At least 1 unit required.');
      hasErrors = true;
    }

    if (hasErrors) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="bb-spinner bb-spinner-sm"></div> Submitting…';

    try {
      const payload = {
        blood_group,
        units_required,
        hospital,
        urgency,
        description,
      };
      if (required_by) payload.required_by = required_by;

      const { data } = await createBloodRequest(payload);
      toast.success('Blood request submitted! Matching donors…');
      window.location.href = `requests.html?id=${data.id}`;
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🩸 Submit Blood Request';

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
        toast.error('Failed to submit blood request.');
      }
    }
  });
});
