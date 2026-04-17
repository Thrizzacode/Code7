/**
 * Log Manager for showing SVN logs in a Modal.
 */
const LogManager = {
  _currentPath: null,
  _logEntries: [],
  _filteredEntries: [],
  _selectedRevision: null,
  _limit: 100,
  _repoRoot: null,

  /**
   * Show the log modal for a specific path.
   * @param {string} path 
   */
  async show(path) {
    this._currentPath = path;
    this._logEntries = [];
    this._filteredEntries = [];
    this._selectedRevision = null;
    this._repoRoot = null;

    // Fetch repo info to get repositoryRoot for URL concatenation
    const infoRes = await window.svnApi.info(path);
    if (infoRes.success) {
      this._repoRoot = infoRes.info.repositoryRoot;
    }

    const bodyHtml = `
      <div class="log-modal-container">
        <div class="log-filter-bar">
          <input type="text" id="log-search-input" placeholder="搜尋作者、版本或訊息關鍵字..." class="input" style="flex-grow: 1;" />
          <button id="btn-log-refresh" class="btn btn-primary" style="padding: 0 15px;">🔄 重新整理</button>
        </div>
        <div class="log-main-split">
          <div class="log-list-section">
            <table class="revision-table">
              <thead>
                <tr>
                  <th style="width: 70px;">版本</th>
                  <th style="width: 100px;">作者</th>
                  <th style="width: 160px;">日期</th>
                  <th style="width: auto;">訊息</th>
                </tr>
              </thead>
              <tbody id="log-list-body">
                <tr><td colspan="4" style="text-align: center; padding: 40px;">正在從伺服器獲取紀錄...</td></tr>
              </tbody>
            </table>
          </div>
          <div id="log-detail-panel" class="log-detail-section" style="display: none;">
            <div class="log-detail-content">
              <div class="log-detail-item">
                <div class="log-detail-label">詳細訊息:</div>
                <div id="log-detail-msg" class="log-message-box"></div>
              </div>
              <div class="log-detail-item" style="margin-top: 15px;">
                <div class="log-detail-label">異動路徑:</div>
                <div id="log-detail-paths-list" class="log-path-list">
                  <div class="loading-text">載入路徑細節中...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    Modal.show({
      title: `SVN 歷史紀錄 - ${this._currentPath}`,
      bodyHtml,
      buttons: [
        { text: '關閉', className: 'btn-ghost', onClick: () => Modal.hide() }
      ],
      onReady: () => {
        this._initEvents();
        this.refresh();
      }
    });
  },

  _initEvents() {
    const searchInput = Utils.$('log-search-input');
    const refreshBtn = Utils.$('btn-log-refresh');

    searchInput.addEventListener('input', (e) => {
      this.filter(e.target.value);
    });

    refreshBtn.addEventListener('click', () => {
      this.refresh();
    });
  },

  async refresh() {
    const listBody = Utils.$('log-list-body');
    listBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">正在重新整理...</td></tr>';
    
    const result = await window.svnApi.log(this._currentPath, { limit: this._limit });
    if (result.success) {
      this._logEntries = result.entries;
      this._filteredEntries = [...this._logEntries];
      this._renderList();
    } else {
      listBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--danger-color);">錯誤: ${result.error}</td></tr>`;
    }
  },

  filter(keyword) {
    if (!keyword) {
      this._filteredEntries = [...this._logEntries];
    } else {
      const kw = keyword.toLowerCase();
      this._filteredEntries = this._logEntries.filter(entry => 
        entry.revision.toString().includes(kw) ||
        entry.author.toLowerCase().includes(kw) ||
        entry.message.toLowerCase().includes(kw)
      );
    }
    this._renderList();
  },

  _renderList() {
    const listBody = Utils.$('log-list-body');
    if (this._filteredEntries.length === 0) {
      listBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">查無符合條件的紀錄</td></tr>';
      return;
    }

    listBody.innerHTML = '';
    this._filteredEntries.forEach(entry => {
      const tr = document.createElement('tr');
      tr.className = 'log-entry-row' + (this._selectedRevision === entry.revision ? ' active' : '');
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent);">${entry.revision}</td>
        <td>${Utils.escapeHtml(entry.author)}</td>
        <td style="font-size: 0.85em; color: var(--text-secondary);">${entry.date.replace('T', ' ').split('.')[0]}</td>
        <td class="text-truncate" title="${Utils.escapeHtml(entry.message)}">${Utils.escapeHtml(entry.message)}</td>
      `;
      tr.addEventListener('click', () => this.selectRevision(entry));
      listBody.appendChild(tr);
    });
  },

  async selectRevision(entry) {
    this._selectedRevision = entry.revision;
    
    // Update UI highlights
    const rows = document.querySelectorAll('.log-entry-row');
    rows.forEach(r => r.classList.remove('active'));
    // Find and highlight current row (simpler than re-rendering)
    const currentRow = Array.from(rows).find(r => r.cells[0].textContent === entry.revision);
    if (currentRow) currentRow.classList.add('active');

    const detailPanel = Utils.$('log-detail-panel');
    const msgBox = Utils.$('log-detail-msg');
    const pathList = Utils.$('log-detail-paths-list');

    detailPanel.style.display = 'block';
    msgBox.textContent = entry.message;
    pathList.innerHTML = '<div class="loading-text">正在獲取受影響之路徑...</div>';

    // Fetch verbose info (Option B: Lazy Loading)
    const result = await window.svnApi.log(this._currentPath, { 
      revision: entry.revision, 
      verbose: true,
      limit: 1
    });

    if (result.success && result.entries.length > 0) {
      const fullEntry = result.entries[0];
      this._renderPaths(fullEntry.changedPaths, pathList);
    } else {
      pathList.innerHTML = '<div style="color: var(--danger-color);">無法獲取路徑細節</div>';
    }
  },

  _renderPaths(paths, container) {
    if (!paths || paths.length === 0) {
      container.innerHTML = '<div class="empty-text">無異動路徑資訊</div>';
      return;
    }

    container.innerHTML = '';
    paths.forEach(p => {
      const div = document.createElement('div');
      div.className = 'path-item';
      
      let actionLabel = p.action;
      let actionClass = 'action-m';
      
      if (p.action === 'A') { actionLabel = 'Added'; actionClass = 'action-a'; }
      else if (p.action === 'D') { actionLabel = 'Deleted'; actionClass = 'action-d'; }
      else if (p.action === 'M') { actionLabel = 'Modified'; actionClass = 'action-m'; }
      else if (p.action === 'R') { actionLabel = 'Replaced'; actionClass = 'action-r'; }

      div.innerHTML = `
        <span class="path-action ${actionClass}">${actionLabel}</span>
        <span class="path-text" title="${p.path} [雙擊可檢視差異]">${p.path}</span>
      `;

      // Double click to open diff
      div.addEventListener('dblclick', () => {
        if (!this._selectedRevision || !this._repoRoot) return;
        
        // Concatenate full URL: repoRoot + relativePath
        // Svn log paths usually start with /, repoRoot usually doesn't end with /
        const fullUrl = this._repoRoot + (p.path.startsWith('/') ? '' : '/') + p.path;
        window.svnApi.openDiff(fullUrl, { revision: this._selectedRevision });
      });

      container.appendChild(div);
    });
  }
};
