/**
 * Revision picker controller.
 * Displays commit history, supports multi-selection and filtering.
 */
const RevisionPicker = {
  _allRevisions: [],
  _selectedRevisions: new Set(), // Set of revision numbers
  _mergedRevisions: new Set(), // Set of already merged revision numbers
  _filterText: '',
  _currentPath: null,
  _targetWcPath: null,
  _oldestRevision: null,
  _isLoading: false,

  init() {
    // Filter input
    Utils.$('revision-filter-input').addEventListener('input', (e) => {
      this._filterText = e.target.value.trim(); // Preserve case for Regex
      this.render();
    });

    // Select all checkbox
    Utils.$('select-all-revisions').addEventListener('change', (e) => {
      if (e.target.checked) {
        this._getUnmergedVisibleRevisions().forEach(r => this._selectedRevisions.add(r.revision));
      } else {
        // Deselect only unmerged ones
        this._getUnmergedVisibleRevisions().forEach(r => this._selectedRevisions.delete(r.revision));
      }
      this.render();
      this._updateSummary();
      MergeExecutor.updateMergeButton();
    });

    // Load more button
    Utils.$('btn-load-more').addEventListener('click', () => this.loadMore());

    // Click on row to toggle
    Utils.$('revision-tbody').addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-rev]');
      if (!row) return;
      
      const rev = parseInt(row.dataset.rev, 10);
      if (this._selectedRevisions.has(rev)) {
        this._selectedRevisions.delete(rev);
      } else {
        this._selectedRevisions.add(rev);
      }
      this.render();
      this._updateSummary();
      MergeExecutor.updateMergeButton();
    });
  },

  /**
   * Load revisions from a source SVN path, and mergeinfo for targetWC.
   */
  async loadRevisions(svnPath, targetWcPath) {
    if (this._isLoading) return;
    this._currentPath = svnPath;
    this._targetWcPath = targetWcPath;
    this._selectedRevisions.clear();
    this._eligibleRevisions.clear();
    this._oldestRevision = null;
    this._filterText = '';
    Utils.$('revision-filter-input').value = '';
    Utils.$('select-all-revisions').checked = false;

    this._showLoading(true);

    const [logResult, mergeinfoResult] = await Promise.all([
      window.svnApi.log(svnPath, { limit: 100 }),
      window.svnApi.getMergeInfo(svnPath, targetWcPath)
    ]);

    this._showLoading(false);

    if (!logResult.success) {
      Toast.error('載入失敗', logResult.error?.message || '無法取得 SVN log');
      this._showEmpty('載入失敗');
      return;
    }

    this._mergeinfoSuccess = mergeinfoResult.success;
    if (mergeinfoResult.success && mergeinfoResult.eligibleRevisions) {
      mergeinfoResult.eligibleRevisions.forEach(r => this._eligibleRevisions.add(r));
    }

    this._allRevisions = logResult.entries || [];
    if (this._allRevisions.length > 0) {
      this._oldestRevision = this._allRevisions[this._allRevisions.length - 1].revision;
    }

    if (this._allRevisions.length === 0) {
      this._showEmpty('No revisions found');
    } else {
      Utils.$('revision-empty').style.display = 'none';
      // Show load more if we got exactly 100
      Utils.$('btn-load-more').style.display = this._allRevisions.length >= 100 ? '' : 'none';
    }

    this.render();
    this._updateSummary();
    MergeExecutor.updateMergeButton();
  },

  /**
   * Load more revisions (pagination).
   */
  async loadMore() {
    if (this._isLoading || !this._currentPath || !this._oldestRevision) return;

    this._isLoading = true;
    Utils.$('btn-load-more').textContent = '載入中...';
    Utils.$('btn-load-more').disabled = true;

    const endRev = this._oldestRevision - 1;
    if (endRev <= 0) {
      Utils.$('btn-load-more').style.display = 'none';
      this._isLoading = false;
      return;
    }

    const result = await window.svnApi.log(this._currentPath, {
      limit: 100,
      startRevision: endRev,
      endRevision: 1
    });

    this._isLoading = false;
    Utils.$('btn-load-more').textContent = '載入更多';
    Utils.$('btn-load-more').disabled = false;

    if (!result.success) {
      Toast.error('載入失敗', result.error?.message || '無法取得更多 revision');
      return;
    }

    const newEntries = result.entries || [];
    if (newEntries.length === 0) {
      Utils.$('btn-load-more').style.display = 'none';
      return;
    }

    this._allRevisions = this._allRevisions.concat(newEntries);
    this._oldestRevision = newEntries[newEntries.length - 1].revision;

    // Hide load more if less than 100 returned
    Utils.$('btn-load-more').style.display = newEntries.length >= 100 ? '' : 'none';

    this.render();
  },

  /**
   * Clear all revisions.
   */
  clear() {
    this._allRevisions = [];
    this._selectedRevisions = new Set();
    this._eligibleRevisions = new Set();
    this._mergeinfoSuccess = false;
    this._currentPath = null;
    this._filterText = '';
    this._isLoading = false;
    Utils.$('revision-filter-input').value = '';
    Utils.$('select-all-revisions').checked = false;
    Utils.$('revision-tbody').innerHTML = '';
    Utils.$('btn-load-more').style.display = 'none';
    this._showEmpty('請先選擇來源與目標分支');
    this._updateSummary();
  },

  /**
   * Get selected revision numbers.
   * @returns {number[]}
   */
  getSelectedRevisions() {
    return Array.from(this._selectedRevisions).sort((a, b) => a - b);
  },

  /**
   * Render the revision table based on current filter.
   */
  render() {
    const tbody = Utils.$('revision-tbody');
    const visible = this._getVisibleRevisions();

    if (visible.length === 0 && this._allRevisions.length > 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: var(--space-lg);">無符合篩選條件的結果</td></tr>`;
      return;
    }

    tbody.innerHTML = visible.map(entry => {
      const isSelected = this._selectedRevisions.has(entry.revision);
      const isMerged = this._mergeinfoSuccess ? !this._eligibleRevisions.has(entry.revision) : false;
      
      let classes = [];
      if (isSelected) classes.push('selected');
      if (isMerged) classes.push('merged');
      
      return `
        <tr data-rev="${entry.revision}" class="${classes.join(' ')}">
          <td class="col-check">
            <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1" />
          </td>
          <td class="col-rev">r${entry.revision}</td>
          <td class="col-author">${Utils.escapeHtml(entry.author)}</td>
          <td class="col-date">${Utils.formatDate(entry.date)}</td>
          <td class="col-message" title="${Utils.escapeHtml(entry.message)}">
            ${isMerged ? '<span class="status-badge" style="background:var(--bg-tertiary);color:var(--text-muted);font-size:10px;padding:2px 4px;border-radius:4px;margin-right:6px;">已合併</span>' : ''}
            ${Utils.escapeHtml(Utils.truncate(entry.message, 120))}
          </td>
        </tr>
      `;
    }).join('');
  },

  _getVisibleRevisions() {
    if (!this._filterText) {
      this._invalidRegexToastShown = false;
      return this._allRevisions;
    }

    let searchRegex = null;
    try {
      searchRegex = new RegExp(this._filterText, 'i');
      this._invalidRegexToastShown = false;
    } catch (e) {
      searchRegex = null;
      if (!this._invalidRegexToastShown) {
        Toast.error('語法異常', '不合法的正規表達式，已退回純文字搜尋。');
        this._invalidRegexToastShown = true;
      }
    }

    const lowerFilter = this._filterText.toLowerCase();

    return this._allRevisions.filter(entry => {
      const revStr = String(entry.revision);
      const author = entry.author || '';
      const msg = entry.message || '';
      
      if (searchRegex) {
        return searchRegex.test(revStr) || searchRegex.test(author) || searchRegex.test(msg);
      } else {
        return revStr.includes(lowerFilter) ||
               author.toLowerCase().includes(lowerFilter) ||
               msg.toLowerCase().includes(lowerFilter);
      }
    });
  },

  _getUnmergedVisibleRevisions() {
    return this._getVisibleRevisions().filter(entry => this._eligibleRevisions.has(entry.revision));
  },

  _updateSummary() {
    const summaryEl = Utils.$('selection-summary');
    const count = this._selectedRevisions.size;
    if (count === 0) {
      summaryEl.textContent = '尚未選取';
    } else {
      const revs = this.getSelectedRevisions();
      const display = revs.length <= 5
        ? revs.map(r => `r${r}`).join(', ')
        : `r${revs[0]}...r${revs[revs.length - 1]}`;
      summaryEl.textContent = `${count} 筆已選 (${display})`;
    }

    // Update merge summary in action bar
    const mergeSummary = Utils.$('merge-summary');
    if (count > 0 && BranchSelector.isValid()) {
      const paths = BranchSelector.getResolvedPaths();
      mergeSummary.textContent = `${paths.sourceEnv}/${paths.sourceVersion} → ${paths.targetEnv}/${paths.targetVersion}，${count} 筆 revision`;
    } else {
      mergeSummary.textContent = '';
    }
  },

  _showLoading(show) {
    this._isLoading = show;
    Utils.$('revision-loading').style.display = show ? 'flex' : 'none';
    Utils.$('revision-empty').style.display = 'none';
    if (show) {
      Utils.$('revision-tbody').innerHTML = '';
    }
  },

  _showEmpty(msg) {
    const el = Utils.$('revision-empty');
    el.querySelector('p').textContent = msg;
    el.style.display = 'flex';
    Utils.$('revision-loading').style.display = 'none';
  }
};
