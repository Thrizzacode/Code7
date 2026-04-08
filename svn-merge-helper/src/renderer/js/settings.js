/**
 * Settings panel controller.
 * Project management via "Import Workspace" instead of manual add/edit.
 * Users can still delete individual projects.
 */
const Settings = {
  _config: null,
  _importing: false,

  async init() {
    this._config = await window.svnApi.loadConfig();
    
    // Fetch and display current version
    const version = await window.svnApi.getVersion();
    const versionBadge = Utils.$('current-app-version');
    if (versionBadge) versionBadge.textContent = `v${version}`;

    // Settings open/close
    Utils.$('btn-settings').addEventListener('click', () => this.open());
    Utils.$('btn-close-settings').addEventListener('click', () => this.close());

    // Import workspace — main settings panel button
    Utils.$('btn-import-workspace').addEventListener('click', () => this.importWorkspace());

    // Import workspace — first-launch setup screen button
    const addFirstBtn = Utils.$('btn-add-first-project');
    if (addFirstBtn) {
      addFirstBtn.addEventListener('click', () => {
        this.open();
        this.importWorkspace();
      });
    }

    // Merge tool
    Utils.$('btn-detect-merge-tool').addEventListener('click', () => this.detectMergeTool());
    Utils.$('btn-save-merge-tool').addEventListener('click', () => this.saveMergeTool());

    // App Update (Requirement: Manual Update Check)
    Utils.$('btn-check-updates').addEventListener('click', () => this.manualCheckUpdates());
    Utils.$('btn-restart-install').addEventListener('click', () => window.svnApi.quitAndInstall());

    // Register Update Listeners
    this.registerUpdateListeners();
  },

  getConfig() {
    return this._config;
  },

  registerUpdateListeners() {
    window.svnApi.onAppUpdateStatus((data) => {
      const statusText = Utils.$('update-status-text');
      const checkBtn = Utils.$('btn-check-updates');
      const restartBtn = Utils.$('btn-restart-install');
      const progressContainer = Utils.$('update-progress-container');

      statusText.classList.remove('available', 'ready', 'error');

      switch (data.state) {
        case 'checking':
          statusText.textContent = '正在檢查更新...';
          checkBtn.disabled = true;
          break;

        case 'available':
          statusText.textContent = `發現新版本: ${data.version}`;
          statusText.classList.add('available');
          progressContainer.style.display = 'block';
          checkBtn.disabled = true;
          break;

        case 'not-available':
          statusText.textContent = '已是最新版本';
          checkBtn.disabled = false;
          break;

        case 'ready':
          statusText.textContent = `版本 ${data.version} 已下載完成`;
          statusText.classList.add('ready');
          progressContainer.style.display = 'none';
          checkBtn.style.display = 'none';
          restartBtn.style.display = 'inline-block';
          break;

        case 'error':
          statusText.textContent = `錯誤: ${data.message || '無法檢查更新'}`;
          statusText.classList.add('error');
          checkBtn.disabled = false;
          break;
      }
    });

    window.svnApi.onAppUpdateProgress((data) => {
      const progressBar = Utils.$('update-progress-bar');
      const progressInfo = Utils.$('update-progress-info');
      
      const percent = Math.round(data.percent);
      const speed = (data.bytesPerSecond / 1024 / 1024).toFixed(2); // MB/s
      
      progressBar.style.width = `${percent}%`;
      progressInfo.textContent = `${percent}% (${speed} MB/s)`;
    });
  },

  async manualCheckUpdates() {
    try {
      await window.svnApi.checkForUpdates();
    } catch (err) {
      console.error('Manual check failed:', err);
    }
  },

  open() {
    this.renderProjectsList();
    Utils.$('merge-tool-path').value = this._config.mergeToolPath || '';
    Utils.$('settings-overlay').style.display = 'flex';
  },

  close() {
    Utils.$('settings-overlay').style.display = 'none';
    if (typeof App !== 'undefined' && App.onConfigChanged) {
      App.onConfigChanged();
    }
  },

  renderProjectsList() {
    const container = Utils.$('settings-projects-list');
    container.innerHTML = '';

    if (!this._config.projects || this._config.projects.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">尚未匯入任何專案。點擊下方按鈕來掃描工作目錄。</p>';
      return;
    }

    this._config.projects.forEach((project, index) => {
      const isBatch = project.isBatchEnabled !== false;
      const item = document.createElement('div');
      item.className = 'project-item';
      item.innerHTML = `
        <div class="project-item-info">
          <div class="project-item-name">${Utils.escapeHtml(project.name)}</div>
          <div class="project-item-path">${Utils.escapeHtml(project.workingCopyRoot)}</div>
        </div>
        <div class="project-item-actions">
          <label class="project-batch-toggle" title="包含在「更新所有專案」中">
            <input type="checkbox" data-action="toggle-batch" ${isBatch ? 'checked' : ''}>
            <span>同步</span>
          </label>
          <button class="btn btn-sm btn-ghost" data-action="delete" data-index="${index}" title="刪除" style="color: var(--error);">✕</button>
        </div>
      `;

      item.querySelector('[data-action="toggle-batch"]').addEventListener('change', (e) => {
        this.toggleBatchUpdate(index, e.target.checked);
      });
      item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteProject(index));
      container.appendChild(item);
    });
  },

  async toggleBatchUpdate(index, enabled) {
    this._config.projects[index].isBatchEnabled = enabled;
    await window.svnApi.saveConfig(this._config);
  },

  /**
   * Open native directory picker → scan → update config → refresh UI.
   * Shows and hides the loading overlay while work is in progress.
   */
  async importWorkspace() {
    if (this._importing) return;

    // Step 1: open directory dialog
    const dialogResult = await window.svnApi.openDirectory();
    if (dialogResult.canceled || !dialogResult.path) return;

    const parentDir = dialogResult.path;

    // Step 2: show loading overlay
    this._setImporting(true);
    const statusEl = Utils.$('import-loading-status');
    if (statusEl) statusEl.textContent = parentDir;

    try {
      // Step 3: run workspace scan (svn info + branches read) in main process
      const result = await window.svnApi.importWorkspace(parentDir);

      // Step 4: hide loading overlay
      this._setImporting(false);

      if (!result.success && result.count === 0) {
        // Total failure (e.g. cannot read directory)
        Toast.error('匯入失敗', result.saveError || '無法掃描所選目錄');
        return;
      }

      // Reload config from disk so state stays consistent
      this._config = await window.svnApi.loadConfig();
      this.renderProjectsList();

      // Build user-facing result message
      if (result.count === 0) {
        Toast.warning('未發現專案', `在「${parentDir}」下找不到任何符合條件的 Fz_ SVN Working Copy`);
      } else {
        const errNote = result.errors && result.errors.length > 0
          ? `（${result.errors.length} 個資料夾略過：${result.errors.map(e => e.folder).join(', ')}）`
          : '';
        Toast.success('匯入完成', `成功匯入 ${result.count} 個專案${errNote}`);
      }

      // If we were on the setup screen, re-evaluate app state
      if (typeof App !== 'undefined' && App.onConfigChanged) {
        App.onConfigChanged();
      }
    } catch (err) {
      this._setImporting(false);
      Toast.error('匯入錯誤', err.message || '未知錯誤');
    }
  },

  _setImporting(active) {
    this._importing = active;
    const overlay = Utils.$('import-loading-overlay');
    if (overlay) overlay.style.display = active ? 'flex' : 'none';

    // Disable the import button during scan to prevent double-clicks
    const btn = Utils.$('btn-import-workspace');
    if (btn) btn.disabled = active;
  },

  async deleteProject(index) {
    const project = this._config.projects[index];
    const confirmed = await Modal.confirm(
      '刪除專案',
      `確定要刪除專案「${project.name}」嗎？此操作不會刪除磁碟上的檔案。`,
      '刪除',
      'btn-danger'
    );

    if (!confirmed) return;

    this._config.projects.splice(index, 1);
    const result = await window.svnApi.saveConfig(this._config);
    if (result.success) {
      Toast.success('已刪除', `專案「${project.name}」已移除`);
      this.renderProjectsList();
    } else {
      Toast.error('刪除失敗', result.error);
    }
  },

  async detectMergeTool() {
    Toast.show('warning', '偵測中...', '正在搜尋 TortoiseMerge...', 2000);
    const result = await window.svnApi.getDefaultMergeTool();
    if (result.found) {
      Utils.$('merge-tool-path').value = result.path;
      Toast.success('已找到', result.path);
    } else {
      Toast.warning('未找到', '無法自動偵測 TortoiseMerge，請手動輸入路徑');
    }
  },

  async saveMergeTool() {
    this._config.mergeToolPath = Utils.$('merge-tool-path').value.trim();
    const result = await window.svnApi.saveConfig(this._config);
    if (result.success) {
      Toast.success('已儲存', '合併工具設定已更新');
    } else {
      Toast.error('儲存失敗', result.error);
    }
  }
};
