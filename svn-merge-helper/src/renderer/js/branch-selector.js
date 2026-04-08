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
    this._populateVersions('source-version', []);
    this._populateVersions('target-version', []);
    Utils.$('source-path').textContent = '';
    Utils.$('target-path').textContent = '';
    Utils.$('source-path').classList.remove('active');
    Utils.$('target-path').classList.remove('active');

    this._sourcePath = null;
    this._targetPath = null;
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
      // Trigger update logic
      this.onEnvChange('source');
      this.onEnvChange('target');
    }
  },

  resetSelectors() {
    ['source-version', 'target-version'].forEach(id => {
      const sel = Utils.$(id);
      sel.innerHTML = '<option value="">選擇版本...</option>';
      sel.disabled = true;
    });
    ['source-env', 'target-env'].forEach(id => {
      Utils.$(id).value = '';
    });
    Utils.$('source-path').textContent = '';
    Utils.$('target-path').textContent = '';
    Utils.$('source-path').classList.remove('active');
    Utils.$('target-path').classList.remove('active');
    this._updateDisabledState();
  },
  
  _updateDisabledState() {
    const isProjectSelected = !!this._currentProject;
    
    // Toggle environments
    ['source-env', 'target-env'].forEach(id => {
      Utils.$(id).disabled = !isProjectSelected;
    });

    // Handle versions - if project is unselected, ensure they are also locked
    if (!isProjectSelected) {
      ['source-version', 'target-version'].forEach(id => {
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
      opt.value = v;
      opt.textContent = v;
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
      
      // Fallback to static versions if dynamic fails
      if (!versions || versions.length === 0) {
        versions = this._currentProject.versions || [];
      }
    } catch {
      versions = this._currentProject.versions || [];
    }

    this._populateVersions(versionSelectId, versions);
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
      pathEl.textContent = '';
      pathEl.classList.remove('active');
      pathEl.title = '';
      if (side === 'source') { this._sourcePath = null; this._sourceWcPath = null; }
      else { this._targetPath = null; this._targetWcPath = null; }
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

    pathEl.textContent = repoUrl;
    pathEl.title = `Repo: ${repoUrl}\nWC: ${wcPath}`;
    pathEl.classList.add('active');

    if (side === 'source') {
      this._sourcePath = repoUrl;
      this._sourceWcPath = wcPath;
    } else {
      this._targetPath = repoUrl;
      this._targetWcPath = wcPath;
    }

    // Validate merge flow
    this._validateMergeFlow();
    this._checkAndLoadRevisions();
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
      sourceWcPath: this._sourceWcPath,
      targetWcPath: this._targetWcPath,
      sourceEnv: Utils.$('source-env').value,
      targetEnv: Utils.$('target-env').value,
      sourceVersion: Utils.$('source-version').value,
      targetVersion: Utils.$('target-version').value
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
  }
};
