/**
 * Merge executor controller.
 * Handles pre-merge validation, merge execution, conflict resolution,
 * and post-merge commit.
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

    btn.disabled = !valid || selected.length === 0;

    if (!valid) {
      btn.title = '請選擇來源與目標分支';
    } else if (selected.length === 0) {
      btn.title = 'Select at least one revision to merge';
    } else {
      btn.title = `合併 ${selected.length} 筆 revision`;
    }
  },

  /**
   * Main merge flow.
   */
  async startMerge() {
    const paths = BranchSelector.getResolvedPaths();
    const revisions = RevisionPicker.getSelectedRevisions();

    if (!paths.targetWcPath || revisions.length === 0) return;

    // ─── Step 1: Pre-merge validation ───
    const statusResult = await window.svnApi.status(paths.targetWcPath);

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

      if (!proceed) return;
    } else if (!statusResult.success) {
      Toast.error('檢查失敗', statusResult.error?.message || '無法檢查 Working Copy 狀態');
      return;
    }

    // ─── Step 2: Execute merge ───
    Toast.show('warning', '合併中...', `正在合併 ${revisions.length} 筆 revision...`, 0);

    const mergeResult = await window.svnApi.merge(paths.sourceUrl, paths.targetWcPath, revisions);

    // Remove the "merging" toast
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(t => t.classList.add('removing'));

    if (!mergeResult.success) {
      this._showMergeError(mergeResult.error);
      return;
    }

    // ─── Step 3: Check for conflicts ───
    const postStatus = await window.svnApi.status(paths.targetWcPath);
    const conflicts = (postStatus.entries || []).filter(e => e.itemStatus === 'conflicted');

    if (conflicts.length > 0) {
      await this._handleConflicts(conflicts, paths);
    } else {
      Toast.success('合併成功', mergeResult.output || '所有檔案已合併');
      this._promptCommit(paths, revisions);
    }
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
   * Handle conflicts: show list with external tool launch buttons.
   */
  async _handleConflicts(conflicts, paths) {
    const conflictItems = conflicts.map(c => ({
      path: c.path,
      resolved: false
    }));

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
        ${allResolved ? '<p style="color: var(--success); margin-top: var(--space-md);">所有衝突已解決！可以進行提交。</p>' : ''}
      `;

      const buttons = allResolved
        ? [
            { text: '稍後再說', className: 'btn-ghost', onClick: () => Modal.hide() },
            { text: '提交 (Commit)', className: 'btn-primary', onClick: () => {
                Modal.hide();
                const revisions = RevisionPicker.getSelectedRevisions();
                this._promptCommit(paths, revisions);
              }
            }
          ]
        : [
            { text: '關閉', className: 'btn-ghost', onClick: () => Modal.hide() }
          ];

      Modal.show({
        title: '衝突解決',
        bodyHtml,
        buttons,
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

        // Remove "waiting" toast
        document.querySelectorAll('.toast').forEach(t => {
          if (t.querySelector('.toast-title')?.textContent === '等待外部工具...') {
            t.classList.add('removing');
          }
        });

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
   * Show commit dialog after successful merge.
   */
  _promptCommit(paths, revisions) {
    const revStr = revisions.map(r => `r${r}`).join(', ');
    const defaultMsg = `Merge ${revStr} from ${paths.sourceEnv}/${paths.sourceVersion} to ${paths.targetEnv}/${paths.targetVersion}`;

    Modal.show({
      title: '提交合併結果',
      bodyHtml: `
        <div class="form-group">
          <label for="commit-message" style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: var(--space-xs);">Commit Message</label>
          <textarea id="commit-message" class="commit-textarea">${Utils.escapeHtml(defaultMsg)}</textarea>
        </div>
      `,
      buttons: [
        { text: '稍後再說', className: 'btn-ghost', onClick: () => Modal.hide() },
        {
          text: '提交 (Commit)',
          className: 'btn-primary',
          onClick: async () => {
            const msg = Utils.$('commit-message').value.trim();
            if (!msg) {
              Toast.warning('提示', '請輸入 commit message');
              return;
            }
            Modal.hide();
            await this._executeCommit(paths.targetWcPath, msg);
          }
        }
      ]
    });
  },

  /**
   * Execute the SVN commit.
   */
  async _executeCommit(wcPath, message) {
    Toast.show('warning', '提交中...', '正在執行 svn commit...', 0);

    const result = await window.svnApi.commit(wcPath, message);

    // Remove "committing" toast
    document.querySelectorAll('.toast').forEach(t => {
      if (t.querySelector('.toast-title')?.textContent === '提交中...') {
        t.classList.add('removing');
      }
    });

    if (result.success) {
      const revMsg = result.revision ? `Committed revision ${result.revision}` : '提交成功';
      Toast.success('提交成功', revMsg);
    } else {
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
    }
  }
};
