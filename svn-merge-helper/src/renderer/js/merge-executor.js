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

    // ─── Step 1.5: Dry-run preview + confirm ───
    const previewGate = await this.previewAndConfirm(paths, revisions);
    if (!previewGate.proceed) return;

    // ─── Step 2: Execute merge (+ conflict detection) ───
    const mergeRes = await this.runMerge(paths.sourceUrl, paths.targetWcPath, revisions, previewGate.preview);
    if (!mergeRes.success) return;

    // ─── Step 3: Resolve conflicts if any ───
    if (mergeRes.conflicts.length > 0) {
      const resolved = await this.resolveConflictsInteractive(mergeRes.conflicts, paths, mergeRes.preview);
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
   * Merge preview gate. When the "show merge preview" setting is enabled, runs a
   * dry-run merge and shows a confirmation dialog before the real merge touches
   * the working copy. When disabled, proceeds immediately with no dialog.
   * @param {object} paths - must include sourceUrl and targetWcPath
   * @param {number[]} revisions
   * @returns {Promise<{proceed:boolean, preview:(object|null)}>}
   */
  async previewAndConfirm(paths, revisions) {
    const cfg = (typeof Settings !== 'undefined' && Settings.getConfig && Settings.getConfig()) || {};
    if (cfg.showMergePreview === false) {
      return { proceed: true, preview: null };
    }

    Toast.show('warning', '產生合併預覽...', `正在以 dry-run 分析 ${revisions.length} 筆 revision...`, 0);
    const res = await window.svnApi.mergePreview(paths.sourceUrl, paths.targetWcPath, revisions);
    Toast.removeByTitle('產生合併預覽...');

    if (!res || !res.success) {
      const skip = await this._promptPreviewFailure(res && res.error);
      return { proceed: skip, preview: null };
    }

    const confirmed = await this._showPreviewDialog(res.preview);
    return { proceed: confirmed, preview: res.preview };
  },

  /**
   * Dialog shown when `svn merge --dry-run` itself fails. Lets the user skip the
   * preview and merge directly, or cancel.
   * @returns {Promise<boolean>} true = skip preview and proceed, false = cancel
   */
  _promptPreviewFailure(error) {
    const errMsg = error?.message || error?.raw || '未知錯誤';
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      Modal.show({
        title: '合併預覽失敗',
        bodyHtml: `
          <p style="color: var(--warning); margin-bottom: var(--space-md);">無法產生合併預覽（dry-run）：</p>
          <pre style="background: var(--bg-tertiary); padding: var(--space-md); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto;">${Utils.escapeHtml(errMsg)}</pre>
          <p style="color: var(--text-muted); font-size: 12px; margin-top: var(--space-sm);">可以略過預覽直接執行合併，或取消本次合併。</p>
        `,
        buttons: [
          { text: '取消', className: 'btn-ghost', onClick: () => { done(false); Modal.hide(); } },
          { text: '略過預覽直接合併', className: 'btn-danger', onClick: () => { done(true); Modal.hide(); } }
        ],
        onClose: () => done(false)
      });
    });
  },

  /**
   * Preview dialog listing the files a dry-run merge expects to change.
   * @param {{updated:string[], added:string[], deleted:string[], conflicted:string[]}} preview
   * @returns {Promise<boolean>} true = confirm and run the real merge
   */
  _showPreviewDialog(preview) {
    const { updated = [], added = [], deleted = [], conflicted = [] } = preview || {};
    const nothing = !updated.length && !added.length && !deleted.length && !conflicted.length;

    const section = (label, arr, color) => arr.length
      ? `<div style="margin-top: var(--space-sm);">
           <strong style="color: ${color};">${label} (${arr.length})</strong>
           <ul style="margin: var(--space-xs) 0 0; padding-left: var(--space-lg); font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">
             ${arr.map(f => `<li>${Utils.escapeHtml(f)}</li>`).join('')}
           </ul>
         </div>`
      : '';

    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      Modal.show({
        title: '合併預覽',
        bodyHtml: `
          <p style="color: var(--text-secondary); margin-bottom: var(--space-sm);">
            預期異動：${updated.length} 更新 / ${added.length} 新增 / ${deleted.length} 刪除 / ${conflicted.length} 預期衝突
          </p>
          ${conflicted.length ? '<p style="color: var(--warning); font-size: 12px;">⚠ 預覽為 SVN 估算，實際衝突以合併結果為準。</p>' : ''}
          ${nothing ? '<p style="color: var(--text-muted);">此合併預期不會有檔案異動。</p>' : ''}
          <div style="max-height: 320px; overflow-y: auto;">
            ${section('衝突', conflicted, 'var(--warning)')}
            ${section('更新', updated, 'var(--text-primary)')}
            ${section('新增', added, 'var(--success)')}
            ${section('刪除', deleted, 'var(--error)')}
          </div>
        `,
        buttons: [
          { text: '取消', className: 'btn-ghost', onClick: () => { done(false); Modal.hide(); } },
          { text: '確認執行合併', className: 'btn-primary', onClick: () => { done(true); Modal.hide(); } }
        ],
        onClose: () => done(false)
      });
    });
  },

  /**
   * Abandon an uncommitted merge: recursive revert of the target working copy
   * plus removal of the preview-identified additions that remain unversioned.
   * Committed content is never touched.
   * @param {string} targetWcPath
   * @param {string[]} previewAdded - paths (relative to wc) the dry-run marked as added
   * @returns {Promise<boolean>} true when the working copy was restored
   */
  async abandonAndRollback(targetWcPath, previewAdded = []) {
    const confirmed = await Modal.confirm(
      '放棄合併並還原',
      '將對目標工作目錄執行 svn revert -R，捨棄本次尚未提交的合併變更，並清除合併新增的檔案。\n\n已提交的內容不受影響。確定要繼續嗎？',
      '放棄並還原',
      'btn-danger'
    );
    if (!confirmed) return false;

    Toast.show('warning', '還原中...', '正在執行 svn revert -R...', 0);
    const res = await window.svnApi.rollbackMerge(targetWcPath, previewAdded || []);
    Toast.removeByTitle('還原中...');

    if (!res || !res.success) {
      const errMsg = res?.error?.message || res?.error?.raw || '未知錯誤';
      Toast.error('還原失敗', `${errMsg}\n請改用 TortoiseSVN 手動還原工作目錄。`);
      return false;
    }

    const rmN = (res.removed || []).length;
    if (res.failedRemovals && res.failedRemovals.length > 0) {
      Toast.warning('已還原（部分新增檔未刪除）', `工作目錄已還原；下列新增檔無法刪除：\n${res.failedRemovals.join('\n')}`);
    } else {
      Toast.success('已還原', `工作目錄已回到合併前狀態${rmN ? `（清除 ${rmN} 個新增檔）` : ''}。`);
    }
    return true;
  },

  /**
   * Execute the merge and detect conflicts.
   * @param {string} sourceUrl
   * @param {string} targetWcPath
   * @param {number[]} revisions
   * @param {object|null} preview - dry-run preview result, relayed for rollback
   * @returns {Promise<{success:boolean, conflicts:Array, output?:string, preview:(object|null), error?:object}>}
   */
  async runMerge(sourceUrl, targetWcPath, revisions, preview = null) {
    Toast.show('warning', '合併中...', `正在合併 ${revisions.length} 筆 revision...`, 0);

    const mergeResult = await window.svnApi.merge(sourceUrl, targetWcPath, revisions);

    Toast.removeByTitle('合併中...');

    if (!mergeResult.success) {
      this._showMergeError(mergeResult.error, { targetWcPath, added: (preview && preview.added) || [] });
      return { success: false, conflicts: [], preview, error: mergeResult.error };
    }

    const postStatus = await window.svnApi.status(targetWcPath);
    const conflicts = (postStatus.entries || []).filter(e => e.itemStatus === 'conflicted');

    return { success: true, conflicts, output: mergeResult.output, preview };
  },

  /**
   * Show merge error with copy button. When `rollbackCtx` is supplied, also
   * offers to abandon the (partially applied) merge and revert.
   * @param {object} error
   * @param {{targetWcPath:string, added:string[]}|null} [rollbackCtx]
   */
  _showMergeError(error, rollbackCtx = null) {
    const errMsg = error?.message || error?.raw || 'Unknown error';

    const buttons = [
      {
        text: '複製錯誤訊息',
        className: 'btn-secondary',
        onClick: async () => {
          const copied = await Utils.copyToClipboard(errMsg);
          if (copied) Toast.success('已複製', '錯誤訊息已複製到剪貼簿');
        }
      }
    ];

    if (rollbackCtx && rollbackCtx.targetWcPath) {
      buttons.push({
        text: '放棄合併並還原',
        className: 'btn-danger',
        onClick: async () => {
          const done = await this.abandonAndRollback(rollbackCtx.targetWcPath, rollbackCtx.added || []);
          if (done) Modal.hide();
          else this._showMergeError(error, rollbackCtx);
        }
      });
    }

    buttons.push({ text: '關閉', className: 'btn-ghost', onClick: () => Modal.hide() });

    Modal.show({
      title: '合併失敗',
      bodyHtml: `
        <p style="color: var(--error); margin-bottom: var(--space-md);">合併過程中發生錯誤：</p>
        <pre style="background: var(--bg-tertiary); padding: var(--space-md); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto;">${Utils.escapeHtml(errMsg)}</pre>
      `,
      buttons
    });
  },

  /**
   * Interactive conflict resolution. Resolves to true when all conflicts are
   * resolved and the user chooses to continue; resolves to false if the user
   * aborts (closes the dialog or clicks "稍後再說") before resolving everything.
   * @param {Array<{path:string}>} conflicts
   * @param {object} paths - must include targetWcPath
   * @param {object|null} preview - dry-run preview result, used for rollback cleanup
   * @returns {Promise<boolean>}
   */
  resolveConflictsInteractive(conflicts, paths, preview = null) {
    return new Promise((resolve) => {
      let settled = false;

      // Track the per-conflict status pollers started by _resolveConflict so they
      // can all be stopped the moment this dialog is dismissed — otherwise a
      // stale poll can see a file that is no longer conflicted (e.g. because the
      // user chose "放棄合併並還原" and svn revert -R cleared the marker) and
      // wrongly report it as "resolved", re-opening this dialog.
      const pollers = new Set();
      const stopAllPolling = () => {
        for (const id of pollers) clearInterval(id);
        pollers.clear();
        Toast.removeByTitle('等待外部工具...');
      };

      const settle = (value) => {
        if (settled) return;
        settled = true;
        stopAllPolling();
        resolve(value);
      };
      const isActive = () => !settled;

      const conflictItems = conflicts.map(c => ({ path: c.path, resolved: false }));

      const renderConflictList = () => {
        if (settled) return; // dialog already dismissed — never re-open it
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
              {
                text: '放棄合併並還原',
                className: 'btn-danger',
                onClick: async () => {
                  const done = await MergeExecutor.abandonAndRollback(paths.targetWcPath, (preview && preview.added) || []);
                  if (done) { settle(false); Modal.hide(); }
                  else { renderConflictList(); }
                }
              },
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
                await this._resolveConflict(conflictItems[idx], idx, paths.targetWcPath, renderConflictList, {
                  isActive,
                  registerPoller: (id) => pollers.add(id)
                });
              });
            });
          }
        });
      };

      renderConflictList();
    });
  },

  /**
   * Launch external tool for a single conflict, then poll for its resolution.
   * @param {{path:string, resolved:boolean}} conflictItem
   * @param {number} index
   * @param {string} targetWcPath
   * @param {Function} rerenderFn
   * @param {{isActive?: () => boolean, registerPoller?: (id:any) => void}} [ctx]
   *   isActive gates every poll tick and the resolve/rerender — once the parent
   *   dialog is dismissed the poller must not act (a reverted file reads as
   *   "no longer conflicted", which is not the same as "resolved").
   */
  async _resolveConflict(conflictItem, index, targetWcPath, rerenderFn, ctx = {}) {
    const isActive = ctx.isActive || (() => true);

    Toast.show('warning', '開啟外部工具...', `正在開啟 TortoiseMerge: ${conflictItem.path}`, 3000);

    const launchResult = await window.svnApi.launchMergeTool(conflictItem.path);

    if (!launchResult.success) {
      Toast.error('無法開啟工具', launchResult.error || '請檢查合併工具設定');
      return;
    }

    if (!isActive()) return;

    // Wait a moment, then re-check status
    Toast.show('warning', '等待外部工具...', '請在外部工具中解決衝突後關閉', 0);

    // Poll for conflict resolution
    const checkResolved = async () => {
      if (!isActive()) return;
      const statusResult = await window.svnApi.status(targetWcPath);
      if (!statusResult.success || !isActive()) return;

      const still = (statusResult.entries || []).find(
        e => e.itemStatus === 'conflicted' && e.path === conflictItem.path
      );

      if (!still) {
        // Conflict no longer flagged — treat as resolved in the external tool.
        await window.svnApi.resolve(conflictItem.path);
        if (!isActive()) return;
        conflictItem.resolved = true;
        Toast.success('衝突已解決', conflictItem.path);
        Toast.removeByTitle('等待外部工具...');
        rerenderFn();
      }
    };

    // Check after a delay, and set up periodic polling
    setTimeout(() => { if (isActive()) checkResolved(); }, 3000);
    const interval = setInterval(async () => {
      if (conflictItem.resolved || !isActive()) {
        clearInterval(interval);
        return;
      }
      await checkResolved();
    }, 5000);
    if (ctx.registerPoller) ctx.registerPoller(interval);

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
