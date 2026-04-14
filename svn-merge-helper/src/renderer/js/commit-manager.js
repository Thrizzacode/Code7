/**
 * CommitManager — Handles standalone commit tab logic, SVN status fetching,
 * file selection, and commit execution.
 */
const CommitManager = {
  currentStatusEntries: [],
  selectedFiles: new Set(),
  wcPath: '',

  init() {
    this._bindEvents();
  },

  _bindEvents() {
    // Refresh button
    const btnRefresh = Utils.$('btn-refresh-status');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.refresh();
      });
    }

    // Unversioned toggle
    const toggleUnversioned = Utils.$('commit-show-unversioned');
    if (toggleUnversioned) {
      toggleUnversioned.addEventListener('change', () => {
        this.renderList();
      });
    }

    // Select all
    const selectAll = Utils.$('commit-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const checkboxes = document.querySelectorAll('.commit-file-checkbox');
        checkboxes.forEach(cb => {
          // Only select currently visible ones
          if (cb.closest('tr').style.display !== 'none') {
            cb.checked = checked;
            if (checked) {
              this.selectedFiles.add(cb.value);
            } else {
              this.selectedFiles.delete(cb.value);
            }
          }
        });
        this._updateSelectionSummary();
      });
    }

    // Commit button
    const btnCommit = Utils.$('btn-standalone-commit');
    if (btnCommit) {
      btnCommit.addEventListener('click', () => {
        this.executeCommit();
      });
    }
    
    // Message change
    const msgArea = Utils.$('standalone-commit-message');
    if (msgArea) {
      msgArea.addEventListener('input', () => {
        this._updateSelectionSummary();
      });
    }
  },

  /**
   * Called by BranchSelector when commit path changes.
   */
  onSelectionChange(newWcPath) {
    this.wcPath = newWcPath;
    this.refresh();
  },

  async refresh() {
    if (!this.wcPath) {
      // Check if we can get it from BranchSelector immediately
      const paths = window.BranchSelector ? window.BranchSelector.getResolvedPaths() : null;
      if (paths && paths.commitWcPath) {
        this.wcPath = paths.commitWcPath;
      } else {
        Utils.$('commit-tbody').innerHTML = '';
        Utils.$('commit-empty-state').style.display = 'flex';
        Utils.$('commit-empty-state').querySelector('p').textContent = '請先選擇環境與版本以開始掃描變更';
        this._updateSelectionSummary();
        return;
      }
    }

    Utils.$('commit-tbody').innerHTML = '';
    Utils.$('commit-empty-state').style.display = 'none';
    Utils.$('commit-loading-state').style.display = 'flex';
    Utils.$('commit-select-all').checked = false;
    this.selectedFiles.clear();
    this._updateSelectionSummary();

    const result = await window.svnApi.status(this.wcPath);

    Utils.$('commit-loading-state').style.display = 'none';

    if (!result.success) {
      if (result.error && result.error.raw && result.error.raw.includes('is not a working copy')) {
        Utils.$('commit-empty-state').style.display = 'flex';
        Utils.$('commit-empty-state').querySelector('p').textContent = '此路徑不是有效的 SVN 工作複本';
      } else {
        Toast.error('狀態掃描失敗', result.error ? result.error.message : '無法取得 svn status');
      }
      this.currentStatusEntries = [];
    } else {
      // Filter out 'none' or 'normal' statuses
      this.currentStatusEntries = result.entries.filter(e => 
          e.itemStatus !== 'none' && e.itemStatus !== 'normal'
      );
    }
    
    this.renderList();
  },

  renderList() {
    const tbody = Utils.$('commit-tbody');
    tbody.innerHTML = '';

    const showUnversioned = Utils.$('commit-show-unversioned').checked;
    let visibleCount = 0;

    this.currentStatusEntries.forEach(entry => {
      if (!showUnversioned && entry.itemStatus === 'unversioned') {
        return; // skip unversioned if toggled off
      }

      visibleCount++;
      const tr = document.createElement('tr');
      
      let badgeClass = 'badge-secondary';
      let statusLabel = entry.itemStatus;
      
      if (entry.itemStatus === 'modified') { badgeClass = 'badge-primary'; statusLabel = '修改';}
      else if (entry.itemStatus === 'added') { badgeClass = 'badge-success'; statusLabel = '新增';}
      else if (entry.itemStatus === 'deleted') { badgeClass = 'badge-danger'; statusLabel = '刪除';}
      else if (entry.itemStatus === 'unversioned') { badgeClass = 'badge-warning'; statusLabel = '未追蹤';}
      else if (entry.itemStatus === 'conflicted') { badgeClass = 'badge-danger'; statusLabel = '衝突';}

      let actionBtnHTML = '';
      let actionType = '';
      if (['modified', 'conflicted', 'deleted'].includes(entry.itemStatus)) {
        actionBtnHTML = '<button class="btn btn-sm btn-action preview-btn" title="比對差異 (Diff) / 支援快點兩下" style="padding: 2px 6px; background: transparent; border: none; cursor: pointer; border-radius: 4px;">🔍</button>';
        actionType = 'diff';
      } else if (['added', 'unversioned'].includes(entry.itemStatus)) {
        actionBtnHTML = '<button class="btn btn-sm btn-action preview-btn" title="開啟檔案 (Open) / 支援快點兩下" style="padding: 2px 6px; background: transparent; border: none; cursor: pointer; border-radius: 4px;">📝</button>';
        actionType = 'open';
      }

      tr.innerHTML = `
        <td style="padding-left: 16px;">
          <input type="checkbox" class="commit-file-checkbox" value="${Utils.escapeHtml(entry.path)}" />
        </td>
        <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
        <td class="text-truncate" title="${Utils.escapeHtml(entry.path)}">${Utils.escapeHtml(entry.path)}</td>
        <td style="text-align: center;">${actionBtnHTML}</td>
      `;

      const cb = tr.querySelector('.commit-file-checkbox');
      if (this.selectedFiles.has(entry.path)) {
        cb.checked = true;
      }

      cb.addEventListener('change', (e) => {
        if (e.target.checked) this.selectedFiles.add(entry.path);
        else this.selectedFiles.delete(entry.path);
        
        const allVisibleCbs = document.querySelectorAll('.commit-file-checkbox');
        const allChecked = Array.from(allVisibleCbs).every(c => c.checked);
        Utils.$('commit-select-all').checked = allChecked && allVisibleCbs.length > 0;
        
        this._updateSelectionSummary();
      });

      const handlePreviewAction = async () => {
        if (!actionType) return;
        try {
          if (actionType === 'diff') {
            await window.svnApi.openDiff(entry.path);
          } else if (actionType === 'open') {
            await window.svnApi.openFile(entry.path);
          }
        } catch (err) {
          console.error('Failed to trigger preview action:', err);
        }
      };

      // Add double-click to the row
      tr.addEventListener('dblclick', (e) => {
        // Ignore dblclick if clicking on the checkbox to prevent issues
        if (e.target.type !== 'checkbox') {
          handlePreviewAction();
          // Clear text selection possibly caused by double-click
          window.getSelection().removeAllRanges();
        }
      });

      // Add button click listener
      const actionBtn = tr.querySelector('.preview-btn');
      if (actionBtn) {
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handlePreviewAction();
        });
      }

      tbody.appendChild(tr);
    });

    if (visibleCount === 0) {
      Utils.$('commit-empty-state').style.display = 'flex';
      Utils.$('commit-empty-state').querySelector('p').textContent = '工作區目前沒有變更';
    } else {
      Utils.$('commit-empty-state').style.display = 'none';
      const allVisibleCbs = document.querySelectorAll('.commit-file-checkbox');
      const allChecked = Array.from(allVisibleCbs).every(c => c.checked);
      Utils.$('commit-select-all').checked = allChecked && visibleCount > 0;
    }
  },

  _updateSelectionSummary() {
    const count = this.selectedFiles.size;
    Utils.$('commit-selection-summary').textContent = `已選擇 ${count} 個檔案`;
    
    const msg = Utils.$('standalone-commit-message').value.trim();
    Utils.$('btn-standalone-commit').disabled = (count === 0) || (msg === '');
  },

  async executeCommit() {
    if (this.selectedFiles.size === 0) return;
    const msg = Utils.$('standalone-commit-message').value.trim();
    if (!msg) {
      Toast.warning('提示', '請輸入 Commit Message');
      return;
    }
    
    const filesArray = Array.from(this.selectedFiles);

    Toast.show('warning', '提交中...', '正在執行 svn commit...', 0);
    Utils.$('btn-standalone-commit').disabled = true;

    try {
      const result = await window.svnApi.commit(this.wcPath, msg, filesArray);
      Toast.remove('warning', '提交中...');

      if (result.success) {
        Toast.success('提交成功', `Revision: ${result.revision || 'N/A'}`);
        Utils.$('standalone-commit-message').value = '';
        this.selectedFiles.clear();
        this.refresh();
      } else {
        Utils.showErrorWithCopy('SVN Commit 失敗', result.error);
        this._updateSelectionSummary();
      }
    } catch (err) {
      Toast.remove('warning', '提交中...');
      Utils.showErrorWithCopy('提交過程發生未預期的錯誤', { message: err.message || String(err) });
      this._updateSelectionSummary();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
    CommitManager.init();
});
window.CommitManager = CommitManager;
