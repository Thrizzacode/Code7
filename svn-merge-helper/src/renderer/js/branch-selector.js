/**
 * Branch selector controller.
 * Manages project selection, source/target environment + version dropdowns,
 * path resolution, and merge flow validation.
 */
const BranchSelector = {
  _currentProject: null,
  _sourcePath: null,
  _targetPath: null,
  _sourceWcPath: null,
  _targetWcPath: null,
  _commitPath: null,
  _commitWcPath: null,
  _sourceVersions: [],
  _targetVersions: [],
  _commitVersions: [],
  _warningDismissed: false,

  // Allowed merge flow order
  _flowOrder: ['branches', 'qat', 'stg'],

  init() {
    // Project selector
    Utils.$('project-selector').addEventListener('change', (e) => this.onProjectChange(e.target.value));

    // Source selectors
    Utils.$('source-env').addEventListener('change', () => this.onEnvChange('source'));
    Utils.$('source-version').addEventListener('change', () => this.onSelectionChange('source'));

    // Target selectors
    Utils.$('target-env').addEventListener('change', () => this.onEnvChange('target'));
    Utils.$('target-version').addEventListener('change', () => this.onSelectionChange('target'));

    // Commit selectors
    Utils.$('commit-env').addEventListener('change', () => this.onEnvChange('commit'));
    Utils.$('commit-version').addEventListener('change', () => this.onSelectionChange('commit'));

    // Warning dismiss
    Utils.$('btn-dismiss-warning').addEventListener('click', () => {
      this._warningDismissed = true;
      Utils.$('merge-flow-warning').style.display = 'none';
    });

    this._updateDisabledState();
  },

  /**
   * Populate project selector from config.
   */
  populateProjects(config) {
    const select = Utils.$('project-selector');
    // Clear existing options
    select.innerHTML = '<option value="">選擇專案...</option>';

    if (!config.projects || config.projects.length === 0) return;

    config.projects.forEach((project, index) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = project.name;
      select.appendChild(opt);
    });

    // Auto-select if only one project
    if (config.projects.length === 1) {
      select.value = '0';
      this.onProjectChange('0');
    }
  },

  /**
   * Handle project selection change.
   */
  async onProjectChange(indexStr) {
    const config = Settings.getConfig();
    if (!indexStr || !config.projects) {
      this._currentProject = null;
      this.resetSelectors();
      return;
    }

    const index = parseInt(indexStr, 10);
    this._currentProject = config.projects[index];

    // Reset env selectors & clear versions
    Utils.$('source-env').value = '';
    Utils.$('target-env').value = '';
    Utils.$('commit-env').value = '';
    this._populateVersions('source-version', []);
    this._populateVersions('target-version', []);
    this._populateVersions('commit-version', []);
    Utils.$('source-path').textContent = '';
    Utils.$('target-path').textContent = '';
    const cp = Utils.$('commit-path');
    if (cp) cp.textContent = '';
    
    Utils.$('source-path').classList.remove('active');
    Utils.$('target-path').classList.remove('active');
    Utils.$('source-path').classList.remove('warning');
    Utils.$('target-path').classList.remove('warning');

    this._sourceVersions = [];
    this._targetVersions = [];
    this._commitVersions = [];

    this._sourcePath = null;
    this._targetPath = null;
    this._commitPath = null;
    this._warningDismissed = false;
    Utils.$('merge-flow-warning').style.display = 'none';

    // Clear revision list
    RevisionPicker.clear();
    MergeExecutor.updateMergeButton();
    this._updateDisabledState();

    // Set defaults: branches -> qat
    if (this._currentProject) {
      Utils.$('source-env').value = 'branches';
      Utils.$('target-env').value = 'qat';
      Utils.$('commit-env').value = 'branches';
      // Trigger update logic
      this.onEnvChange('source');
      this.onEnvChange('target');
      this.onEnvChange('commit');
    }
  },

  resetSelectors() {
    ['source-version', 'target-version', 'commit-version'].forEach(id => {
      const sel = Utils.$(id);
      sel.innerHTML = '<option value="">選擇版本...</option>';
      sel.disabled = true;
    });
    ['source-env', 'target-env', 'commit-env'].forEach(id => {
      Utils.$(id).value = '';
    });
    Utils.$('source-path').textContent = '';
    Utils.$('target-path').textContent = '';
    const cp = Utils.$('commit-path');
    if (cp) cp.textContent = '';

    Utils.$('source-path').classList.remove('active');
    Utils.$('target-path').classList.remove('active');
    this._updateDisabledState();
  },
  
  _updateDisabledState() {
    const isProjectSelected = !!this._currentProject;
    
    // Toggle environments
    ['source-env', 'target-env', 'commit-env'].forEach(id => {
      Utils.$(id).disabled = !isProjectSelected;
    });

    // Handle versions - if project is unselected, ensure they are also locked
    if (!isProjectSelected) {
      ['source-version', 'target-version', 'commit-version'].forEach(id => {
        const sel = Utils.$(id);
        sel.innerHTML = '<option value="">選擇版本...</option>';
        sel.disabled = true;
      });
    }
  },

  _populateVersions(selectId, versions) {
    const sel = Utils.$(selectId);
    sel.innerHTML = '<option value="">選擇版本...</option>';

    if (!versions || versions.length === 0) {
      sel.disabled = true;
      return;
    }

    versions.forEach(v => {
      const opt = document.createElement('option');
      const versionStr = typeof v === 'string' ? v : v.version;
      const isLocal = typeof v === 'string' || v.presentLocally;
      const isRemote = typeof v === 'string' || v.presentRemotely;
      
      opt.value = versionStr;
      
      let label = versionStr;
      if (isLocal && !isRemote) {
        label += ' (僅本地)';
      } else if (!isLocal && isRemote) {
        label += ' (遠端)';
      }
      
      opt.textContent = label;
      
      if (!isLocal) {
        opt.classList.add('remote-version');
      } else if (!isRemote) {
        opt.classList.add('local-only-version');
      }
      sel.appendChild(opt);
    });

    sel.disabled = false;
  },

  /**
   * Handle environment dropdown change.
   */
  async onEnvChange(side) {
    if (!this._currentProject) return;

    const env = Utils.$(`${side}-env`).value;
    const versionSelectId = `${side}-version`;

    if (!env) {
      this._populateVersions(versionSelectId, []);
      this.onSelectionChange(side);
      return;
    }

    // Show loading text in the dropdown
    const sel = Utils.$(versionSelectId);
    sel.innerHTML = '<option value="">載入中...</option>';
    sel.disabled = true;

    // Fetch dynamic versions for this specific environment
    let versions = [];
    try {
      const wcRoot = this._currentProject.workingCopyRoot;
      const templates = this._currentProject.pathTemplates || {};
      const template = templates[env];
      
      if (wcRoot && template && window.svnApi.getEnvVersions) {
        versions = await window.svnApi.getEnvVersions(wcRoot, templates, env);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
      // Only fallback to static if absolutely necessary (e.g. IPC error), 
      // but an empty array from getEnvVersions should be respected.
      if (versions === null || versions === undefined) {
        versions = this._currentProject.versions || [];
      }
    }

    this._populateVersions(versionSelectId, versions);
    if (side === 'source') this._sourceVersions = versions;
    else if (side === 'target') this._targetVersions = versions;
    else if (side === 'commit') this._commitVersions = versions;

    this.onSelectionChange(side);
  },

  /**
   * Handle environment or version change.
   */
  onSelectionChange(side) {
    if (!this._currentProject) return;

    const env = Utils.$(`${side}-env`).value;
    const version = Utils.$(`${side}-version`).value;
    const pathEl = Utils.$(`${side}-path`);

    if (!env || !version) {
      if (pathEl) {
        pathEl.textContent = '';
        pathEl.classList.remove('active');
        pathEl.title = '';
      }
      if (side === 'source') { this._sourcePath = null; this._sourceWcPath = null; }
      else if (side === 'target') { this._targetPath = null; this._targetWcPath = null; }
      else if (side === 'commit') { this._commitPath = null; this._commitWcPath = null; }
      this._checkAndLoadRevisions();
      return;
    }

    // Resolve paths
    const templates = this._currentProject.pathTemplates || {};
    const template = templates[env];
    if (!template) {
      pathEl.textContent = 'Template not found for: ' + env;
      pathEl.classList.remove('active');
      return;
    }

    const relativePath = template.replace('{version}', version);
    const repoUrl = `${this._currentProject.repoUrl}/${relativePath}`;
    const wcPath = `${this._currentProject.workingCopyRoot}/${relativePath}`;

    const versions = side === 'source' ? this._sourceVersions : 
                     side === 'target' ? this._targetVersions : this._commitVersions;
    const versionData = versions.find(v => (typeof v === 'string' ? v : v.version) === version);
    const isLocal = !versionData || (typeof versionData === 'string') || versionData.presentLocally;

    if (pathEl) {
      pathEl.textContent = isLocal ? repoUrl : `⚠ ${repoUrl}`;
      pathEl.title = (isLocal ? '' : '[尚未獲取本地代碼]\n') + `Repo: ${repoUrl}\nWC: ${wcPath}`;
      pathEl.classList.add('active');
      if (!isLocal) {
        pathEl.classList.add('warning');
      } else {
        pathEl.classList.remove('warning');
      }
    }

    if (side === 'source') {
      this._sourcePath = repoUrl;
      this._sourceWcPath = wcPath;
    } else if (side === 'target') {
      this._targetPath = repoUrl;
      this._targetWcPath = wcPath;
    } else if (side === 'commit') {
      this._commitPath = repoUrl;
      this._commitWcPath = wcPath;
      // Also notify CommitManager if it exists
      if (window.CommitManager) {
        window.CommitManager.onSelectionChange(wcPath);
      }
    }

    // Update Sync Button visibility
    this._updateSyncButton(side, versionData);

    // Validate merge flow
    this._validateMergeFlow();
    this._checkAndLoadRevisions();
  },

  /**
   * Update the visibility and state of the 'Sync to Local' button.
   * @param {'source'|'target'} side 
   * @param {object|string} versionData 
   */
  _updateSyncButton(side, versionData) {
    const container = Utils.$(`${side}-sync-container`);
    if (!container) return;
    
    container.innerHTML = '';

    if (!versionData || typeof versionData === 'string' || versionData.presentLocally) {
      return;
    }

    // Only show if it's presentRemotely but NOT presentLocally
    if (versionData.presentRemotely && !versionData.presentLocally) {
      const btn = document.createElement('button');
      btn.className = 'btn-sync-local';
      btn.innerHTML = '<span class="sync-icon">📥</span> 同步至本地 (Update Local)';
      btn.title = '此版本僅存在於遠端，點擊以同步至本地目錄。';
      btn.addEventListener('click', () => this.syncToLocal(side, versionData));
      container.appendChild(btn);
    }
  },

  /**
   * Sync a remote-only version to the local working copy.
   * @param {'source'|'target'} side 
   * @param {object|string} versionData 
   */
  async syncToLocal(side, versionData) {
    const container = Utils.$(`${side}-sync-container`);
    const btn = container.querySelector('.btn-sync-local');
    if (!btn || btn.classList.contains('loading')) return;

    try {
      btn.classList.add('loading');
      btn.innerHTML = '<span class="sync-icon">⏳</span> 正在同步 (Syncing...)';

      const templates = this._currentProject.pathTemplates || {};
      const env = Utils.$(`${side}-env`).value;
      const template = templates[env];
      const versionStr = typeof versionData === 'string' ? versionData : versionData.version;
      const relativePath = template.replace('{version}', versionStr);
      const wcPath = `${this._currentProject.workingCopyRoot}/${relativePath}`;

      Toast.info('正在同步', `正在同步 ${versionStr} 至本地 (這可能需要一點時間)...`);
      
      const result = await window.svnApi.ensureLocalPath(wcPath);
      
      if (result.success) {
        Toast.success('同步成功', `${versionStr} 已下載至本地`);
        // Refresh versions to update the local presence flag
        await this.refreshVersions();
      } else {
        Toast.error('同步失敗', `${versionStr} 同步失敗: ${result.error?.message || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      Toast.error(`同步過程出錯: ${err.message}`);
    } finally {
      if (btn) {
        btn.classList.remove('loading');
        btn.innerHTML = '<span class="sync-icon">📥</span> 同步至本地 (Update Local)';
      }
    }
  },

  /**
   * Validate the merge direction against allowed flow.
   */
  _validateMergeFlow() {
    const sourceEnv = Utils.$('source-env').value;
    const targetEnv = Utils.$('target-env').value;
    const sourceVersion = Utils.$('source-version').value;
    const targetVersion = Utils.$('target-version').value;

    const warningBar = Utils.$('merge-flow-warning');
    const warningText = Utils.$('merge-flow-warning-text');

    // Check: same source and target
    if (sourceEnv && targetEnv && sourceEnv === targetEnv && sourceVersion === targetVersion) {
      warningText.textContent = '來源與目標不能相同。';
      warningBar.style.display = 'flex';
      this._warningDismissed = false;
      return;
    }

    if (!sourceEnv || !targetEnv) {
      warningBar.style.display = 'none';
      return;
    }

    const sourceIdx = this._flowOrder.indexOf(sourceEnv);
    const targetIdx = this._flowOrder.indexOf(targetEnv);

    // Reverse flow: target is before source in standard flow
    if (targetIdx <= sourceIdx && sourceEnv !== targetEnv) {
      warningText.textContent = `非標準合併方向：${sourceEnv} → ${targetEnv}。標準流程為 branches → qat → stg。`;
      if (!this._warningDismissed) {
        warningBar.style.display = 'flex';
      }
    } else {
      warningBar.style.display = 'none';
    }
  },

  /**
   * If both source and target are fully selected, load revisions.
   */
  _checkAndLoadRevisions() {
    if (this._sourcePath && this._targetPath) {
      // Pass both source URL and target Working Copy path
      RevisionPicker.loadRevisions(this._sourcePath, this._targetWcPath);
    } else {
      RevisionPicker.clear();
    }
    MergeExecutor.updateMergeButton();
  },

  /**
   * Get the current resolved paths.
   */
  getResolvedPaths() {
    return {
      sourceUrl: this._sourcePath,
      targetUrl: this._targetPath,
      commitUrl: this._commitPath,
      sourceWcPath: this._sourceWcPath,
      targetWcPath: this._targetWcPath,
      commitWcPath: this._commitWcPath,
      sourceEnv: Utils.$('source-env').value,
      targetEnv: Utils.$('target-env').value,
      commitEnv: Utils.$('commit-env').value,
      sourceVersion: Utils.$('source-version').value,
      targetVersion: Utils.$('target-version').value,
      commitVersion: Utils.$('commit-version').value
    };
  },

  /**
   * Check if source and target are validly selected (not identical).
   */
  isValid() {
    const sourceEnv = Utils.$('source-env').value;
    const targetEnv = Utils.$('target-env').value;
    const sourceVersion = Utils.$('source-version').value;
    const targetVersion = Utils.$('target-version').value;

    if (!this._sourcePath || !this._targetPath) return false;
    if (sourceEnv === targetEnv && sourceVersion === targetVersion) return false;
    return true;
  },

  /**
   * Manually trigger a refresh of versions for all sides.
   */
  async refreshVersions() {
    if (!this._currentProject) return;
    await Promise.all([
      this.onEnvChange('source'),
      this.onEnvChange('target'),
      this.onEnvChange('commit')
    ]);
  }
};
