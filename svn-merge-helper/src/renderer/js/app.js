/**
 * Application entry point.
 * Initializes all modules and manages screen flow.
 */
const App = {
  async init() {
    // ─── Step 1: Check SVN availability ───
    const svnCheck = await window.svnApi.checkAvailability();

    if (!svnCheck.available) {
      Utils.showScreen('svn-error-screen');
      Utils.$('btn-retry-svn').addEventListener('click', () => this.init());
      return;
    }

    // ─── Step 2: Initialize modules ───
    await Settings.init();
    BranchSelector.init();
    RevisionPicker.init();
    MergeExecutor.init();

    // ─── Step 3: Global Navigation ───
    Utils.$('app-logo').addEventListener('click', () => {
      const config = Settings.getConfig();
      if (config.projects && config.projects.length > 0) {
        this._showMainScreen(config);
      } else {
        Utils.showScreen('setup-screen');
      }
    });

    // ─── Step 4: Initialize Sync functionality ───
    SyncController.init();

    // ─── Step 5: Determine initial screen ───
    const config = Settings.getConfig();

    if (!config.projects || config.projects.length === 0) {
      // First launch — show setup
      Utils.showScreen('setup-screen');
    } else {
      // Normal launch — show main screen
      this._showMainScreen(config);
    }
  },

  /**
   * Show main screen and populate project selector.
   */
  _showMainScreen(config) {
    Utils.showScreen('main-screen');
    BranchSelector.populateProjects(config);
  },

  /**
   * Called when config changes (from Settings panel).
   */
  onConfigChanged() {
    const config = Settings.getConfig();

    if (!config.projects || config.projects.length === 0) {
      Utils.showScreen('setup-screen');
    } else {
      this._showMainScreen(config);
    }
  }
};

/**
 * Controller for SVN sync/update operations.
 */
const SyncController = {
  init() {
    Utils.$('btn-update-current').addEventListener('click', () => this.updateCurrent());
    Utils.$('btn-update-all').addEventListener('click', () => this.updateAll());

    // Listen for batch progress
    window.svnApi.onUpdateProgress((data) => {
      this._showBatchProgress(data);
    });
  },

  async updateCurrent() {
    const paths = BranchSelector.getResolvedPaths();
    const currentProject = BranchSelector._currentProject;

    if (!currentProject || !currentProject.workingCopyRoot) {
      Utils.showToast('尚未選擇專案', 'error');
      return;
    }

    const progress = Utils.showToast(`正在更新：${currentProject.name}...`, 'progress', 0);
    if (progress.progressBar) {
      progress.progressBar.classList.add('indeterminate');
    }
    
    try {
      const res = await window.svnApi.update(currentProject.workingCopyRoot);
      progress.remove();

      if (res.success) {
        Utils.showToast(`${currentProject.name} 更新成功！`, 'success');
        
        // Refresh versions to reflect folder changes on disk
        await BranchSelector.refreshVersions();

        // Refresh revisions only if selection is complete
        if (paths.sourceUrl && paths.targetWcPath) {
          RevisionPicker.loadRevisions(paths.sourceUrl, paths.targetWcPath);
        }
      } else {
        Utils.showToast(`更新失敗：${res.error.message}`, 'error', 5000);
      }
    } catch (err) {
      progress.remove();
      Utils.showToast('更新出錯，請檢查網路連線', 'error');
    }
  },

  async updateAll() {
    const config = Settings.getConfig();
    const projects = config.projects || [];
    const allowedProjects = projects.filter(p => p.isBatchEnabled !== false);

    if (projects.length === 0) {
      Utils.showToast('尚未匯入任何專案，請至設定頁面匯入', 'error');
      return;
    }

    if (allowedProjects.length === 0) {
      Utils.showToast('沒有任何專案被設定為批次更新，請至設定頁面勾選「同步」', 'warning', 5000);
      return;
    }

    const pathsToUpdate = allowedProjects.map(p => ({
      name: p.name,
      path: p.workingCopyRoot
    }));

    Utils.showToast(`開始批次更新已選取的 ${allowedProjects.length} 個專案...`, 'info');

    try {
      const results = await window.svnApi.updateBatch(pathsToUpdate);
      const failed = results.filter(r => !r.success);

      if (failed.length === 0) {
        Utils.showToast('✅ 所有專案更新完成！', 'success', 5000);
      } else {
        Utils.showToast(`更新完成，但有 ${failed.length} 個專案失敗。`, 'error', 6000);
      }
    } catch (err) {
      console.error('Batch Update Error:', err);
      Utils.showToast(`批次更新執行失敗：${err.message || '未知錯誤'}`, 'error');
    }
  },

  _showBatchProgress(data) {
    if (!this._batchToast) {
      this._batchToast = Utils.showToast('', 'progress', 0);
    }
    
    const percent = Math.round(((data.index + 1) / data.total) * 100);
    this._batchToast.updateText(`[${data.index + 1}/${data.total}] 正在更新：${data.current}...`);
    
    if (this._batchToast.progressBar) {
      this._batchToast.progressBar.style.width = `${percent}%`;
    }
    
    if (data.index + 1 === data.total) {
      setTimeout(() => {
        this._batchToast.remove();
        this._batchToast = null;
      }, 1500);
    }
  }
};

// ─── Bootstrap ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
