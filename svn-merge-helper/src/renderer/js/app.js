/**
 * Application entry point.
 * Initializes all modules and manages screen flow.
 */
const App = {
  async init() {
    // ─── Step 0: Restore mode immediately from cache (before async IPC) ───
    ModeController.restoreEarly();

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

    // ─── Step 5: Initialize Theme & Mode ───
    ThemeController.init();
    ModeController.init();

    // ─── Step 5.5: Initialize View Switcher ───
    ViewSwitcher.init();

    // ─── Step 6: Determine initial screen ───
    const config = Settings.getConfig();

    if (!config.projects || config.projects.length === 0) {
      // First launch — show setup
      Utils.showScreen('setup-screen');
      // Apply theme & mode even on setup screen
      ThemeController.applyTheme(config.theme || 'physicam');
      ModeController.applyMode(config.mode || 'dark');
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
    // Apply saved theme and mode
    ThemeController.applyTheme(config.theme || 'physicam');
    ModeController.applyMode(config.mode || 'dark');
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
 * ViewSwitcher — manages navigation between merge and commit views.
 */
const ViewSwitcher = {
  currentView: 'merge-view',
  init() {
    const btnMerge = Utils.$('nav-merge-view');
    const btnCommit = Utils.$('nav-commit-view');
    
    if (btnMerge) {
      btnMerge.addEventListener('click', () => this.switchView('merge-view'));
    }
    if (btnCommit) {
      btnCommit.addEventListener('click', () => this.switchView('commit-view'));
    }

    // Restore last view
    const lastView = localStorage.getItem('code7-last-view') || 'merge-view';
    this.switchView(lastView);
  },
  
  switchView(viewId) {
    this.currentView = viewId;
    localStorage.setItem('code7-last-view', viewId);
    
    // Toggle DOM elements
    const mergeView = Utils.$('merge-view');
    const commitView = Utils.$('commit-view');
    
    if (mergeView) {
      mergeView.style.display = viewId === 'merge-view' ? 'flex' : 'none';
    }
    if (commitView) {
      commitView.style.display = viewId === 'commit-view' ? 'flex' : 'none';
    }
    
    // Toggle button styles
    const btnMerge = Utils.$('nav-merge-view');
    const btnCommit = Utils.$('nav-commit-view');
    
    if (btnMerge) {
      btnMerge.className = viewId === 'merge-view' ? 'btn btn-sm active' : 'btn btn-sm btn-ghost';
    }
    if (btnCommit) {
      btnCommit.className = viewId === 'commit-view' ? 'btn btn-sm active' : 'btn btn-sm btn-ghost';
    }
    
    if (viewId === 'commit-view' && window.CommitManager) {
      CommitManager.refresh();
    }
  }
};

/**
 * ThemeController — manages theme switching, persistence, and UI.
 */
const ThemeController = {
  THEMES: [
    { value: 'physicam',  label: 'PHYSICAM'  },
    { value: 'technolom', label: 'TECHNOLOM' },
    { value: 'esprim',    label: 'ESPRIM'    },
    { value: 'paradigm',  label: 'PARADIGM'  },
    { value: 'inazuma',   label: 'INAZUMA'   }
  ],

  init() {
    const btn = Utils.$('theme-switcher-btn');
    const dropdown = Utils.$('theme-dropdown');

    if (!btn || !dropdown) return;

    // Toggle dropdown open/close
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close when clicking outside
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });

    // Option click handler
    dropdown.querySelectorAll('.theme-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const themeValue = opt.dataset.themeValue;
        this.selectTheme(themeValue);
        dropdown.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  },

  /**
   * Apply a theme by name to the document root.
   * @param {string} themeValue
   */
  applyTheme(themeValue) {
    document.documentElement.setAttribute('data-theme', themeValue);
    // Update button label
    const nameEl = Utils.$('theme-current-name');
    if (nameEl) {
      const found = this.THEMES.find(t => t.value === themeValue);
      nameEl.textContent = found ? found.label : themeValue.toUpperCase();
    }
    // Update active state in dropdown
    const dropdown = Utils.$('theme-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.themeValue === themeValue);
      });
    }
  },

  /**
   * Select theme, apply immediately, and persist to config.
   * @param {string} themeValue
   */
  async selectTheme(themeValue) {
    this.applyTheme(themeValue);
    // Save to config
    const config = Settings.getConfig();
    config.theme = themeValue;
    try {
      await window.svnApi.saveConfig(config);
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  }
};

/**
 * ModeController — manages dark/light mode toggle and persistence.
 * Uses localStorage as an immediate cache so mode is restored before
 * the async IPC config load completes.
 */
const ModeController = {
  _current: 'dark',
  _LS_KEY: 'code7-mode',

  /**
   * Called early (before config is loaded) to snapshot from localStorage.
   * This prevents the flash of wrong theme on reload.
   */
  restoreEarly() {
    const saved = localStorage.getItem(this._LS_KEY) || 'dark';
    this._current = saved;
    if (saved === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
    }
  },

  init() {
    const btn = Utils.$('btn-mode-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => this.toggle());
  },

  /**
   * Apply mode ('dark' or 'light') to the document root.
   * @param {string} mode
   */
  applyMode(mode) {
    this._current = mode;
    localStorage.setItem(this._LS_KEY, mode);
    const btn = Utils.$('btn-mode-toggle');

    if (mode === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
      if (btn) btn.textContent = '☀️';
      if (btn) btn.title = '切換為深色模式';
    } else {
      document.documentElement.removeAttribute('data-mode');
      if (btn) btn.textContent = '🌙';
      if (btn) btn.title = '切換為淺色模式';
    }
  },

  /**
   * Toggle between dark and light mode and persist.
   */
  async toggle() {
    const next = this._current === 'dark' ? 'light' : 'dark';
    this.applyMode(next);
    const config = Settings.getConfig();
    config.mode = next;
    try {
      await window.svnApi.saveConfig(config);
    } catch (err) {
      console.error('Failed to save mode:', err);
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
