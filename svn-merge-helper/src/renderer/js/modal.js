/**
 * Modal dialog system.
 */
const Modal = {
  _overlay: null,
  _onClose: null,

  /**
   * Show a modal dialog.
   * @param {object} options
   * @param {string} options.title
   * @param {string} options.bodyHtml - HTML content for the body
   * @param {Array<{text: string, className?: string, onClick: Function}>} options.buttons
   * @param {Function} options.onClose
   * @param {Function} options.onReady - called after modal is rendered
   */
  show(options) {
    this._overlay = Utils.$('modal-overlay');
    const titleEl = Utils.$('modal-title');
    const bodyEl = Utils.$('modal-body');
    const footerEl = Utils.$('modal-footer');
    const closeBtn = Utils.$('modal-close');

    titleEl.textContent = options.title || '';
    bodyEl.innerHTML = options.bodyHtml || '';
    footerEl.innerHTML = '';

    if (options.buttons && options.buttons.length > 0) {
      options.buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.className || 'btn-ghost'}`;
        button.textContent = btn.text;
        button.addEventListener('click', () => {
          if (btn.onClick) btn.onClick();
        });
        footerEl.appendChild(button);
      });
      footerEl.style.display = '';
    } else {
      footerEl.style.display = 'none';
    }

    this._onClose = options.onClose || null;
    closeBtn.onclick = () => this.hide();

    this._overlay.style.display = 'flex';
    this._overlay.onclick = (e) => {
      if (e.target === this._overlay) this.hide();
    };

    if (options.onReady) {
      requestAnimationFrame(() => options.onReady(bodyEl));
    }
  },

  /**
   * Hide the modal.
   */
  hide() {
    if (this._overlay) {
      this._overlay.style.display = 'none';
    }
    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  },

  /**
   * Show a confirmation dialog.
   * @param {string} title
   * @param {string} message
   * @param {string} confirmText
   * @param {string} confirmClass
   * @returns {Promise<boolean>}
   */
  confirm(title, message, confirmText = '確認', confirmClass = 'btn-primary') {
    return new Promise((resolve) => {
      this.show({
        title,
        bodyHtml: `<p style="color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; word-break: break-all;">${Utils.escapeHtml(message)}</p>`,
        buttons: [
          { text: '取消', className: 'btn-ghost', onClick: () => { this.hide(); resolve(false); } },
          { text: confirmText, className: confirmClass, onClick: () => { this.hide(); resolve(true); } }
        ]
      });
    });
  }
};
