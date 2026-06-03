/**
 * Chained merge orchestrator.
 *
 * Drives a continuous branches → qat → stg merge by sequencing the reusable
 * MergeExecutor step units across stages and relaying each stage's commit
 * revision to the next stage. Only stage 1 uses the revision picker; subsequent
 * stages merge the previous stage's commit revision (svn merge -c <rev>).
 *
 * The flow pauses only at conflicts (external resolution) and commit
 * confirmation. On interruption it halts at the current stage and preserves
 * any already-committed stage — it never rolls back.
 */
const ChainedMerge = {
  _stgVersions: [],

  init() {
    const checkbox = Utils.$('chain-to-stg');
    const stgSelect = Utils.$('chain-stg-version');
    if (!checkbox || !stgSelect) return;

    checkbox.addEventListener('change', () => this._onToggle());
    stgSelect.addEventListener('change', () => MergeExecutor.updateMergeButton());

    this.refreshAvailability();
  },

  /**
   * Whether the chained merge mode is currently enabled and fully selected.
   * @returns {boolean}
   */
  isEnabled() {
    const checkbox = Utils.$('chain-to-stg');
    if (!checkbox || !checkbox.checked) return false;
    if (!this._preconditionsMet()) return false;
    return !!Utils.$('chain-stg-version').value;
  },

  /** branches → qat is the only valid entry point for the chain. */
  _preconditionsMet() {
    const paths = BranchSelector.getResolvedPaths();
    return paths.sourceEnv === 'branches'
      && paths.targetEnv === 'qat'
      && !!paths.sourceUrl
      && !!paths.targetWcPath;
  },

  /**
   * Re-evaluate whether the chain controls should be available, based on the
   * current source/target selection. Called by BranchSelector on changes.
   */
  refreshAvailability() {
    const checkbox = Utils.$('chain-to-stg');
    const label = Utils.$('chain-to-stg-label');
    if (!checkbox) return;

    const available = this._preconditionsMet();
    checkbox.disabled = !available;
    if (label) {
      label.title = available
        ? '勾選後一路合併 branches → qat → stg'
        : '需先選擇 來源=branches、目標=qat 才能啟用';
      label.classList.toggle('disabled', !available);
    }

    // If the selection drifted away from branches → qat, drop the chain mode.
    if (!available && checkbox.checked) {
      checkbox.checked = false;
      this._onToggle();
      return;
    }
    MergeExecutor.updateMergeButton();
  },

  /** Reset chain state when the project changes. */
  onProjectChange() {
    const checkbox = Utils.$('chain-to-stg');
    const stgSelect = Utils.$('chain-stg-version');
    if (checkbox) checkbox.checked = false;
    this._stgVersions = [];
    if (stgSelect) {
      stgSelect.innerHTML = '<option value="">選擇 STG 版本...</option>';
      stgSelect.style.display = 'none';
      stgSelect.disabled = true;
    }
    this.refreshAvailability();
  },

  async _onToggle() {
    const checkbox = Utils.$('chain-to-stg');
    const stgSelect = Utils.$('chain-stg-version');
    if (checkbox.checked) {
      stgSelect.style.display = '';
      await this._loadStgVersions();
    } else {
      stgSelect.style.display = 'none';
    }
    MergeExecutor.updateMergeButton();
  },

  /**
   * Load STG versions for the current project, reusing the same IPC path the
   * branch selector uses (getEnvVersions).
   */
  async _loadStgVersions() {
    const stgSelect = Utils.$('chain-stg-version');
    const project = BranchSelector.getCurrentProject();
    if (!project) return;

    const previous = stgSelect.value;
    stgSelect.innerHTML = '<option value="">載入中...</option>';
    stgSelect.disabled = true;

    let versions = [];
    try {
      const templates = project.pathTemplates || {};
      if (project.workingCopyRoot && templates.stg && window.svnApi.getEnvVersions) {
        versions = await window.svnApi.getEnvVersions(project.workingCopyRoot, templates, 'stg') || [];
      }
    } catch (err) {
      console.error('Failed to load stg versions:', err);
    }

    this._stgVersions = versions;
    stgSelect.innerHTML = '<option value="">選擇 STG 版本...</option>';
    versions.forEach(v => {
      const versionStr = typeof v === 'string' ? v : v.version;
      const isLocal = typeof v === 'string' || v.presentLocally;
      const opt = document.createElement('option');
      opt.value = versionStr;
      opt.textContent = isLocal ? versionStr : `${versionStr} (遠端)`;
      if (!isLocal) opt.classList.add('remote-version');
      stgSelect.appendChild(opt);
    });
    stgSelect.disabled = false;
    // Restore previous selection if still present.
    if (previous && versions.some(v => (typeof v === 'string' ? v : v.version) === previous)) {
      stgSelect.value = previous;
    }
  },

  /**
   * Build the stage plan from the current selection and run the chain.
   * Performs the STG working-copy presence check before starting.
   */
  async start() {
    const paths = BranchSelector.getResolvedPaths();
    const stage1Revisions = RevisionPicker.getSelectedRevisions();
    const stgVersion = Utils.$('chain-stg-version').value;

    if (!this._preconditionsMet() || !stgVersion || stage1Revisions.length === 0) {
      Toast.warning('無法開始鏈式合併', '請確認 來源=branches、目標=qat、已選 STG 版本與至少一筆 revision');
      return;
    }

    // Resolve qat (stage-1 target / stage-2 source) and stg (stage-2 target).
    const qatVersion = paths.targetVersion;
    const qatResolved = BranchSelector.resolvePath('qat', qatVersion);
    const stgResolved = BranchSelector.resolvePath('stg', stgVersion);
    if (!qatResolved || !stgResolved) {
      Toast.error('路徑解析失敗', '無法解析 qat 或 stg 路徑，請檢查專案範本設定');
      return;
    }

    // STG working copy must exist locally before starting.
    const stgReady = await this._ensureStgLocal(stgVersion, stgResolved.wcPath);
    if (!stgReady) return;

    // Inform user that auto-update is enabled for chain merge.
    const confirmed = await Modal.confirm(
      '開始鏈式合併',
      `即將依序執行：\n• ${paths.sourceEnv}/${paths.sourceVersion} → qat/${qatVersion}\n• qat/${qatVersion} → stg/${stgVersion}\n\n注意：若各站工作目錄版本落後伺服器，將自動執行 SVN Update。\n\n確定要開始嗎？`,
      '開始合併',
      'btn-primary'
    );
    if (!confirmed) return;

    const stages = [
      {
        label: `${paths.sourceEnv}/${paths.sourceVersion} → qat/${qatVersion}`,
        sourceUrl: paths.sourceUrl,
        targetWcPath: paths.targetWcPath,
        revisions: stage1Revisions,
        paths: {
          sourceUrl: paths.sourceUrl,
          targetWcPath: paths.targetWcPath,
          sourceEnv: paths.sourceEnv,
          sourceVersion: paths.sourceVersion,
          targetEnv: 'qat',
          targetVersion: qatVersion
        }
      },
      {
        label: `qat/${qatVersion} → stg/${stgVersion}`,
        sourceUrl: qatResolved.repoUrl,
        targetWcPath: stgResolved.wcPath,
        revisions: null, // relayed from the previous stage's commit revision
        paths: {
          sourceUrl: qatResolved.repoUrl,
          targetWcPath: stgResolved.wcPath,
          sourceEnv: 'qat',
          sourceVersion: qatVersion,
          targetEnv: 'stg',
          targetVersion: stgVersion
        }
      }
    ];

    await this.run(stages);
  },

  /**
   * Ensure the STG working copy exists locally. If only remote, offer to sync
   * via ensureLocalPath. Returns true when present (or synced) and the chain
   * may proceed; false to block.
   * @param {string} stgVersion
   * @param {string} stgWcPath
   * @returns {Promise<boolean>}
   */
  async _ensureStgLocal(stgVersion, stgWcPath) {
    const data = this._stgVersions.find(v => (typeof v === 'string' ? v : v.version) === stgVersion);
    const presentLocally = !data || typeof data === 'string' || data.presentLocally;
    if (presentLocally) return true;

    const doSync = await Modal.confirm(
      'STG 版本尚未同步至本地',
      `STG 版本 ${stgVersion} 僅存在於遠端，鏈式合併需要本地工作目錄。\n\n要現在同步至本地嗎？`,
      '同步至本地',
      'btn-primary'
    );
    if (!doSync) return false;

    Toast.show('warning', '同步中...', `正在同步 stg/${stgVersion} 至本地...`, 0);
    const result = await window.svnApi.ensureLocalPath(stgWcPath);
    Toast.removeByTitle('同步中...');

    if (!result.success) {
      Toast.error('同步失敗', result.error?.message || '無法同步 STG 版本，請稍後重試');
      return false;
    }

    Toast.success('同步成功', `stg/${stgVersion} 已同步至本地`);
    // Refresh presence flags and keep the selection.
    await this._loadStgVersions();
    Utils.$('chain-stg-version').value = stgVersion;
    return true;
  },

  /**
   * Run the ordered stage plan, relaying commit revisions across stages.
   * @param {Array<object>} stages
   */
  async run(stages) {
    let prevCommitRev = null;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      // Pre-merge validation for this stage (auto-update if behind).
      const ok = await MergeExecutor.preMergeValidate(stage.targetWcPath, { autoUpdate: true });
      if (!ok) return this._haltAt(i, stages, '前置檢查未通過或已取消');

      // Revision relay: stage 0 uses the picked revisions; later stages use
      // the previous stage's commit revision (svn merge -c <rev>).
      const revisions = i === 0 ? stage.revisions : [prevCommitRev];

      Toast.info(`鏈式合併 ${i + 1}/${stages.length}`, stage.label, 3000);

      const mergeRes = await MergeExecutor.runMerge(stage.sourceUrl, stage.targetWcPath, revisions);
      if (!mergeRes.success) return this._haltAt(i, stages, '合併失敗');

      if (mergeRes.conflicts.length > 0) {
        const resolved = await MergeExecutor.resolveConflictsInteractive(mergeRes.conflicts, stage.paths);
        if (!resolved) return this._haltAt(i, stages, '衝突未解決或已取消');
      }

      MergeContext.set(stage.sourceUrl, revisions, `${stage.paths.sourceEnv}/${stage.paths.sourceVersion}`);

      const commitRes = await MergeExecutor.promptCommit(stage.paths, revisions, { mandatory: true, autoUpdate: true });
      if (commitRes.noChanges) {
        return this._haltAt(i, stages, '本站合併後無變更，無法接續後續階段', true);
      }
      if (!commitRes.committed) {
        return this._haltAt(i, stages, '提交已取消');
      }
      prevCommitRev = commitRes.revision;

      // A non-final stage must yield a revision to relay to the next stage.
      if (i < stages.length - 1 && (prevCommitRev === null || prevCommitRev === undefined)) {
        return this._haltAt(i, stages, '無法取得本站 commit 的 revision，無法接續下一站');
      }
    }

    this._showComplete(stages, prevCommitRev);
  },

  /**
   * Halt the chain at the given stage, preserving completed stages.
   * @param {number} stageIndex
   * @param {Array<object>} stages
   * @param {string} reason
   * @param {boolean} [info] - whether this is an informational stop, not an error
   */
  _haltAt(stageIndex, stages, reason, info = false) {
    const completed = stages.slice(0, stageIndex).map(s => s.label);
    const stopped = stages[stageIndex].label;

    const completedText = completed.length
      ? `已完成並提交：\n${completed.map(c => `• ${c}`).join('\n')}\n\n`
      : '尚未完成任何階段。\n\n';

    const body = `${completedText}停在：${stopped}\n原因：${reason}\n\n已提交的階段保留不變，可稍後從該階段接續。`;

    Modal.show({
      title: info ? '鏈式合併結束' : '鏈式合併已中止',
      bodyHtml: `<p style="color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; word-break: break-all;">${Utils.escapeHtml(body)}</p>`,
      buttons: [{ text: '了解', className: 'btn-primary', onClick: () => Modal.hide() }]
    });

    this._reloadAfter(stages[0]);
  },

  _showComplete(stages, lastRev) {
    Toast.success('鏈式合併完成', `branches → qat → stg 全部完成（最後提交 r${lastRev}）`);
    this._reloadAfter(stages[0]);
  },

  /** Reload the revision picker for the first stage so the view reflects reality. */
  _reloadAfter(firstStage) {
    if (firstStage && firstStage.sourceUrl && firstStage.targetWcPath) {
      RevisionPicker.loadRevisions(firstStage.sourceUrl, firstStage.targetWcPath);
    }
  }
};

window.ChainedMerge = ChainedMerge;
