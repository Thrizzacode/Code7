/**
 * Utility functions shared across renderer modules.
 */
const Utils = {
  /**
   * Get a DOM element by ID.
   * @param {string} id
   * @returns {HTMLElement}
   */
  $(id) {
    return document.getElementById(id);
  },

  /**
   * Truncate a string to maxLen characters with ellipsis.
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  truncate(str, maxLen = 120) {
    if (!str) return '';
    const firstLine = str.split('\n')[0];
    if (firstLine.length <= maxLen) return firstLine;
    return firstLine.substring(0, maxLen) + '…';
  },

  /**
   * Format a date string for display.
   * @param {string} isoDate
   * @returns {string}
   */
  formatDate(isoDate) {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return isoDate;
    }
  },

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Show a screen by ID and hide all others.
   * @param {string} screenId
   */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => {
      el.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.style.display = 'flex';
    }
  },

  /**
   * Copy text to clipboard.
   * @param {string} text
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Show a toast message.
   * @param {string} message
   * @param {string} type - 'info', 'success', 'error', 'progress'
   * @param {number} duration - ms (set to 0 for manual removal)
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const textNode = document.createElement('span');
    textNode.textContent = message;
    toast.appendChild(textNode);

    let progressBar = null;
    if (type === 'progress') {
      const barContainer = document.createElement('div');
      barContainer.className = 'toast-progress-container';
      progressBar = document.createElement('div');
      progressBar.className = 'toast-progress-bar';
      barContainer.appendChild(progressBar);
      toast.appendChild(barContainer);
    }

    container.appendChild(toast);

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    };

    if (duration > 0) {
      setTimeout(remove, duration);
    }

    return { 
      toast, 
      progressBar, 
      remove,
      updateText: (txt) => { textNode.textContent = txt; }
    };
  }
};
