/**
 * Merge executor controller.
 * Handles pre-merge validation, merge execution, conflict resolution,
 * and post-merge commit.
 *
 * The core steps are exposed as reusable, Promise-returning units
 * (preMergeValidate / runMerge / resolveConflictsInteractive / promptCommit)
 * so that both the single-stage flow (startMerge) and the chained merge
 * orchestrator (ChainedMerge) can sequence them and relay results.
 */
const MergeExecutor = {
  init() {
    Utils.$('btn-merge').addEventListener('click', () => this.startMerge());
  },

  /**
   * Enable/disable the merge button based on current state.
   */
  updateMergeButton() {
    const btn = Utils.$('btn-merge');
    const selected = RevisionPicker.getSelectedRevisions();
    const valid = BranchSelector.isValid();
    const chainChecked = window.ChainedMerge && !!Utils.$('chain-to-stg')?.checked;
    const chainReady = chainChecked && ChainedMerge.isEnabled();

    btn.disabled = !valid || selected.length === 0 || (chainChecked && !chainReady);

    if (!valid) {
      btn.title = '請選擇來源與目標分支';
    } else if (selected.length === 0) {
      btn.title = 'Select at least one revision to merge';
    } else if (chainChecked && !chainReady) {
      btn.title = '鏈式合併：請先選擇 STG 版本';
    } else if (chainReady) {
      btn.title = `鏈式合併 ${selected.length} 筆 revision：branches → qat → stg`;
    } else {
      btn.title = `合併 ${selected.length} 筆 revision`;
    }
  },

  /**
   * Main merge entry. Dispatches to the chained orchestrator when the
   * "merge through to STG" option is enabled, otherwise runs a single stage.
   */
  async startMerge() {
    if (window.ChainedMerge && ChainedMerge.isEnabled()) {
      return ChainedMerge.start();
    }
    return this._startSingleMerge();
  },

  /**
   * Single-stage merge flow (source → target), composed from the reusable
   * step units. Behavior matches the original startMerge.
   */
  async _startSingleMerge() {
    const paths = BranchSelector.getResolvedPaths();
    const revisions = RevisionPicker.getSelectedRevisions();

    if (!paths.targetWcPath || revisions.length === 0) return;

    // ─── Step 1: Pre-merge validation ───
    const ok = await this.preMergeValidate(paths.targetWcPath);
    if (!ok) return;

    // ─── Step 2: Execute merge (+ conflict detection) ───
    const mergeRes = await this.runMerge(paths.sourceUrl, paths.targetWcPath, revisions);
    if (!mergeRes.success) return;

    // ─── Step 3: Resolve conflicts if any ───
    if (mergeRes.conflicts.length > 0) {
      const resolved = await this.resolveConflictsInteractive(mergeRes.conflicts, paths);
      if (!resolved) return;
    } else {
      Toast.success('合併成功', mergeRes.output || '所有檔案已合併');
    }

    // ─── Step 4: Commit ───
    MergeContext.set(paths.sourceUrl, revisions, `${paths.sourceEnv}/${paths.sourceVersion}`);
    await this.promptCommit(paths, revisions, { mandatory: false });
  },

  /**
   * Pre-merge validation: target working-copy cleanliness + up-to-date check.
   * @param {string} targetWcPath
   * @param {{autoUpdate?: boolean}} [options]
   * @returns {Promise<boolean>} true to proceed, false to abort.
   */
  async preMergeValidate(targetWcPath, { autoUpdate = false } = {}) {
    const statusResult = await window.svnApi.status(targetWcPath);

    if (statusResult.success && statusResult.entries && statusResult.entries.length > 0) {
      // Working copy has uncommitted changes
      const fileList = statusResult.entries
        .map(e => `• ${e.itemStatus}: ${e.path}`)
        .join('\n');

      const proceed = await Modal.confirm(
        '目標 Working Copy 有未提交的修改',
        `以下檔案有未提交的修改：\n\n${fileList}\n\n是否仍要繼續合併？`,
        '繼續合併',
        'btn-primary'
      );

      if (!proceed) return false;
    } else if (!statusResult.success) {
      Toast.error('檢查失敗', statusResult.error?.message || '無法檢查 Working Copy 狀態');
      return false;
    }

    // Check if working copy is up to date; auto-update in chain merge, prompt otherwise
    try {
      const [localInfo, headInfo] = await Promise.all([
        window.svnApi.info(targetWcPath),
        window.svnApi.info(targetWcPath, { revision: 'HEAD' })
      ]);
      if (localInfo.success && headInfo.success) {
        const localRev = localInfo.info.revision;
        const headRev = headInfo.info.revision;
        if (localRev < headRev) {
          if (autoUpdate) {
            Toast.show('warning', '自動更新中...', `本地版本 (r${localRev}) 落後，正在自動執行 Update 至 r${headRev}...`, 0);
            const updateResult = await window.svnApi.update(targetWcPath);
            Toast.removeByTitle('自動更新中...');
            if (!updateResult.success) {
              Toast.error('Update 失敗', updateResult.error?.message || '無法更新工作目錄，請手動執行 svn update 後重試');
              return false;
            }
            Toast.success('Update 完成', `工作目錄已更新至最新版本`);
          } else {
            const proceed = await Modal.confirm(
              '工作目錄版本落後',
              `本地版本 (r${localRev}) 落後伺服器最新版本 (r${headRev})，建議先執行 Update 以避免潛在的 commit 失敗。\n\n確定要繼續合併嗎？`,
              '仍要繼續合併',
              'btn-danger'
            );
            if (!proceed) return false;
          }
        }
      }
    } catch (_) {
      // info check failure is non-blocking
    }

    return true;
  },

  /**
   * Execute the merge and detect conflicts.
   * @param {string} sourceUrl
   * @param {string} targetWcPath
   * @param {number[]} revisions
   * @returns {Promise<{success:boolean, conflicts:Array, output?:string, error?:object}>}
   */
  async runMerge(sourceUrl, targetWcPath, revisions) {
    Toast.show('warning', '合併中...', `正在合併 ${revisions.length} 筆 revision...`, 0);

    const mergeResult = await window.svnApi.merge(sourceUrl, targetWcPath, revisions);

    Toast.removeByTitle('合併中...');

    if (!mergeResult.success) {
      this._showMergeError(mergeResult.error);
      return { success: false, conflicts: [], error: mergeResult.error };
    }

    const postStatus = await window.svnApi.status(targetWcPath);
    const conflicts = (postStatus.entries || []).filter(e => e.itemStatus === 'conflicted');

    return { success: true, conflicts, output: mergeResult.output };
  },

  /**
   * Show merge error with copy button.
   */
  _showMergeError(error) {
    const errMsg = error?.message || error?.raw || 'Unknown error';

    Modal.show({
      title: '合併失敗',
      bodyHtml: `
        <p style="color: var(--error); margin-bottom: var(--space-md);">合併過程中發生錯誤：</p>
        <pre style="background: var(--bg-tertiary); padding: var(--space-md); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto;">${Utils.escapeHtml(errMsg)}</pre>
      `,
      buttons: [
        {
          text: '複製錯誤訊息',
          className: 'btn-secondary',
          onClick: async () => {
            const copied = await Utils.copyToClipboard(errMsg);
            if (copied) Toast.success('已複製', '錯誤訊息已複製到剪貼簿');
          }
        },
        { text: '關閉', className: 'btn-ghost', onClick: () => Modal.hide() }
      ]
    });
  },

  /**
   * Interactive conflict resolution. Resolves to true when all conflicts are
   * resolved and the user chooses to continue; resolves to false if the user
   * aborts (closes the dialog or clicks "稍後再說") before resolving everything.
   * @param {Array<{path:string}>} conflicts
   * @param {object} paths - must include targetWcPath
   * @returns {Promise<boolean>}
   */
  resolveConflictsInteractive(conflicts, paths) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const conflictItems = conflicts.map(c => ({ path: c.path, resolved: false }));

      const renderConflictList = () => {
        const allResolved = conflictItems.every(c => c.resolved);
        const bodyHtml = `
          <p style="color: var(--warning); margin-bottom: var(--space-md);">
            偵測到 ${conflictItems.length} 個衝突檔案：
          </p>
          <div class="conflict-list">
            ${conflictItems.map((c, i) => `
              <div class="conflict-item ${c.resolved ? 'resolved' : ''}" data-index="${i}">
                <span class="conflict-item-path">${Utils.escapeHtml(c.path)}</span>
                ${c.resolved
                  ? '<span style="color: var(--success); font-size: 12px;">✓ 已解決</span>'
                  : `<button class="btn btn-sm btn-secondary conflict-resolve-btn" data-index="${i}">使用外部工具解決</button>`
                }
              </div>
            `).join('')}
          </div>
          ${allResolved ? '<p style="color: var(--success); margin-top: var(--space-md);">所有衝突已解決！可以繼續。</p>' : ''}
        `;

        const buttons = allResolved
          ? [
              { text: '稍後再說', className: 'btn-ghost', onClick: () => { settle(false); Modal.hide(); } },
              { text: '繼續', className: 'btn-primary', onClick: () => { settle(true); Modal.hide(); } }
            ]
          : [
              { text: '關閉', className: 'btn-ghost', onClick: () => { settle(false); Modal.hide(); } }
            ];

        Modal.show({
          title: '衝突解決',
          bodyHtml,
          buttons,
          // Closing the dialog (X / overlay) before continuing counts as abort.
          onClose: () => settle(false),
          onReady: (bodyEl) => {
            bodyEl.querySelectorAll('.conflict-resolve-btn').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                await this._resolveConflict(conflictItems[idx], idx, paths.targetWcPath, renderConflictList);
              });
            });
          }
        });
      };

      renderConflictList();
    });
  },

  /**
   * Launch external tool for a single conflict, then re-check.
   */
  async _resolveConflict(conflictItem, index, targetWcPath, rerenderFn) {
    Toast.show('warning', '開啟外部工具...', `正在開啟 TortoiseMerge: ${conflictItem.path}`, 3000);

    const launchResult = await window.svnApi.launchMergeTool(conflictItem.path);

    if (!launchResult.success) {
      Toast.error('無法開啟工具', launchResult.error || '請檢查合併工具設定');
      return;
    }

    // Wait a moment, then re-check status
    Toast.show('warning', '等待外部工具...', '請在外部工具中解決衝突後關閉', 0);

    // Poll for conflict resolution
    const checkResolved = async () => {
      const statusResult = await window.svnApi.status(targetWcPath);
      if (!statusResult.success) return;

      const still = (statusResult.entries || []).find(
        e => e.itemStatus === 'conflicted' && e.path === conflictItem.path
      );

      if (!still) {
        // Conflict resolved — run svn resolve
        await window.svnApi.resolve(conflictItem.path);
        conflictItem.resolved = true;
        Toast.success('衝突已解決', conflictItem.path);
        Toast.removeByTitle('等待外部工具...');
        rerenderFn();
      }
    };

    // Check after a delay, and set up periodic polling
    setTimeout(checkResolved, 3000);
    const interval = setInterval(async () => {
      if (conflictItem.resolved) {
        clearInterval(interval);
        return;
      }
      await checkResolved();
    }, 5000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  },

  /**
   * Show the commit dialog and execute the commit.
   *
   * When `mandatory` is true (chained merge), the "稍後再說" defer option is
   * removed — a commit is required to proceed to the next stage. When the
   * merged working copy has no changes, the commit is skipped (no empty commit)
   * and `{ committed: false, noChanges: true }` is returned.
   *
   * @param {object} paths - sourceUrl, targetWcPath, sourceEnv/Version, targetEnv/Version
   * @param {number[]} revisions
   * @param {{mandatory?: boolean, autoUpdate?: boolean}} [options]
   * @returns {Promise<{committed:boolean, revision:(number|null), noChanges?:boolean}>}
   */
  async promptCommit(paths, revisions, { mandatory = false, autoUpdate = false } = {}) {
    // Skip empty commits — nothing changed in the working copy.
    const pre = await window.svnApi.status(paths.targetWcPath);
    if (pre.success && (pre.entries || []).length === 0) {
      Toast.info('無變更', '合併後工作目錄沒有變更，略過提交');
      return { committed: false, revision: null, noChanges: true };
    }

    return new Promise((resolve) => {
      let settled = false;
      let proceeding = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const revStr = revisions.map(r => `r${r}`).join(', ');
      const defaultMsg = `Merge ${revStr} from ${paths.sourceEnv}/${paths.sourceVersion} to ${paths.targetEnv}/${paths.targetVersion}`;

      const buttons = [];
      if (!mandatory) {
        buttons.push({
          text: '稍後再說',
          className: 'btn-ghost',
          onClick: () => {
            settle({ committed: false, revision: null });
            Modal.hide();
            if (paths.sourceUrl && paths.targetWcPath) {
              RevisionPicker.loadRevisions(paths.sourceUrl, paths.targetWcPath);
            }
          }
        });
      }
      buttons.push({
        text: '提交 (Commit)',
        className: 'btn-primary',
        onClick: async () => {
          const msg = Utils.$('commit-message').value.trim();
          if (!msg) {
            Toast.warning('提示', '請輸入 commit message');
            return;
          }
          proceeding = true;
          Modal.hide();
          const result = await this._executeCommit(paths.targetWcPath, msg, { autoUpdate });
          if (result.success) {
            if (!mandatory && paths.sourceUrl && paths.targetWcPath) {
              RevisionPicker.loadRevisions(paths.sourceUrl, paths.targetWcPath);
            }
            settle({ committed: true, revision: result.revision });
          } else {
            // commit failed or cancelled (behind-HEAD) — not committed
            settle({ committed: false, revision: null });
          }
        }
      });

      Modal.show({
        title: mandatory ? '提交合併結果（鏈式必要步驟）' : '提交合併結果',
        bodyHtml: `
          <div class="form-group">
            <label for="commit-message" style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: var(--space-xs);">Commit Message</label>
            <textarea id="commit-message" class="commit-textarea">${Utils.escapeHtml(defaultMsg)}</textarea>
          </div>
          ${mandatory ? '<p style="color: var(--text-muted); font-size: 12px; margin-top: var(--space-sm);">鏈式合併需要提交本站才能接續下一站。</p>' : ''}
        `,
        buttons,
        // Closing the dialog without committing counts as not committed.
        onClose: () => { if (!proceeding) settle({ committed: false, revision: null }); }
      });

      if (paths.sourceUrl) {
        window.svnApi.buildMergeMessage({
          sourceUrl: paths.sourceUrl,
          revisions,
          branchLabel: `${paths.sourceEnv}/${paths.sourceVersion}`
        }).then(result => {
          if (result.success && result.message) {
            const textarea = Utils.$('commit-message');
            if (textarea) textarea.value = result.message;
          }
        }).catch(() => {});
      }
    });
  },

  /**
   * Execute the SVN commit, with a pre-commit up-to-date check.
   * @param {string} wcPath
   * @param {string} message
   * @param {{autoUpdate?: boolean}} [options]
   * @returns {Promise<{success:boolean, revision:(number|null), cancelled?:boolean, error?:object}>}
   */
  async _executeCommit(wcPath, message, { autoUpdate = false } = {}) {
    try {
      const [localInfo, headInfo] = await Promise.all([
        window.svnApi.info(wcPath),
        window.svnApi.info(wcPath, { revision: 'HEAD' })
      ]);
      if (localInfo.success && headInfo.success) {
        const localRev = localInfo.info.revision;
        const headRev = headInfo.info.revision;
        if (localRev < headRev) {
          if (autoUpdate) {
            Toast.show('warning', '提交前自動更新...', `本地版本 (r${localRev}) 落後，正在自動執行 Update 至 r${headRev}...`, 0);
            const updateResult = await window.svnApi.update(wcPath);
            Toast.removeByTitle('提交前自動更新...');
            if (!updateResult.success) {
              Toast.error('Update 失敗', updateResult.error?.message || '無法更新工作目錄，請手動執行 svn update 後重試');
              return { success: false, cancelled: true, revision: null };
            }
            Toast.success('Update 完成', '工作目錄已更新，繼續提交');
          } else {
            const proceed = await Modal.confirm(
              '工作目錄版本落後',
              `本地版本 (r${localRev}) 落後伺服器最新版本 (r${headRev})，提交前建議先執行 Update 以避免衝突。\n\n確定要直接提交嗎？`,
              '仍要提交',
              'btn-danger'
            );
            if (!proceed) return { success: false, cancelled: true, revision: null };
          }
        }
      }
    } catch (_) {
      // info check failure is non-blocking
    }

    Toast.show('warning', '提交中...', '正在執行 svn commit...', 0);

    const result = await window.svnApi.commit(wcPath, message);

    Toast.removeByTitle('提交中...');

    if (result.success) {
      const revMsg = result.revision ? `Committed revision ${result.revision}` : '提交成功';
      Toast.success('提交成功', revMsg);
      return { success: true, revision: result.revision || null };
    }

    const errMsg = result.error?.message || result.error?.raw || 'Commit failed';

    if (/out of date|needs to be updated/i.test(errMsg)) {
      Toast.error('提交失敗', '目標分支已過期，請先在外部執行 svn update 後重試。');
    } else {
      Modal.show({
        title: '提交失敗',
        bodyHtml: `
          <p style="color: var(--error); margin-bottom: var(--space-md);">提交過程中發生錯誤：</p>
          <pre style="background: var(--bg-tertiary); padding: var(--space-md); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; word-break: break-all;">${Utils.escapeHtml(errMsg)}</pre>
        `,
        buttons: [
          {
            text: '複製錯誤訊息',
            className: 'btn-secondary',
            onClick: async () => {
              await Utils.copyToClipboard(errMsg);
              Toast.success('已複製', '錯誤訊息已複製到剪貼簿');
            }
          },
          { text: '關閉', className: 'btn-ghost', onClick: () => Modal.hide() }
        ]
      });
    }
    return { success: false, revision: null, error: result.error };
  }
};
