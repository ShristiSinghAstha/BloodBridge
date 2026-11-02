// js/utils/toast.js
// Toast notification utility matching platform API and styling

function getOrCreateContainer() {
  let container = document.getElementById('bb-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bb-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, options = {}) {
  const container = getOrCreateContainer();
  const toastEl = document.createElement('div');
  toastEl.className = 'bb-toast';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'bb-toast-icon';
  iconSpan.textContent = options.icon || '🔔';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  toastEl.appendChild(iconSpan);
  toastEl.appendChild(textSpan);

  // Click to dismiss
  toastEl.addEventListener('click', () => {
    toastEl.remove();
  });

  container.appendChild(toastEl);

  const duration = options.duration || 4000;
  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.remove();
    }
  }, duration);
}

export const toast = (message, options) => showToast(message, options);
toast.success = (msg, opt = {}) => showToast(msg, { ...opt, icon: '✅' });
toast.error   = (msg, opt = {}) => showToast(msg, { ...opt, icon: '❌' });
toast.info    = (msg, opt = {}) => showToast(msg, { ...opt, icon: 'ℹ️' });

export default toast;
