/**
 * Toast notification system.
 */
const Toast = {
  /**
   * Show a toast notification.
   * @param {'success'|'error'|'warning'} type
   * @param {string} title
   * @param {string} message
   * @param {number} duration - ms before auto-dismiss (0 = manual)
   */
  show(type, title, message, duration = 4000) {
    const container = Utils.$('toast-container');

    const icons = { success: '✓', error: '✕', warning: '⚠' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <div class="toast-content">
        <div class="toast-title">${Utils.escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${Utils.escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" title="關閉">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => Toast._remove(toast));

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => Toast._remove(toast), duration);
    }

    return toast;
  },

  success(title, message, duration) {
    return this.show('success', title, message, duration);
  },

  error(title, message, duration) {
    return this.show('error', title, message, duration || 6000);
  },

  warning(title, message, duration) {
    return this.show('warning', title, message, duration || 5000);
  },

  info(title, message, duration) {
    return this.show('info', title, message, duration || 4000);
  },

  _remove(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  },

  /**
   * Remove all toasts with a specific title.
   * @param {string} title 
   */
  removeByTitle(title) {
    const container = Utils.$('toast-container');
    if (!container) return;
    
    const toasts = container.querySelectorAll('.toast');
    toasts.forEach(toast => {
      const titleEl = toast.querySelector('.toast-title');
      if (titleEl && titleEl.textContent === title) {
        this._remove(toast);
      }
    });
  }
};
