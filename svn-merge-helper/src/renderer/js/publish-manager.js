/**
 * PublishManager — Jenkins 發布頁面控制器。
 *
 * 職責：
 * - 憑證檢查閘門（決策：未設定 Base URL／User／Token 時不發任何請求）
 * - 拉取設定 view 底下的所有 job 並渲染清單
 * - 依 job 參數定義動態產生表單（決策五）
 * - 觸發建置並依 3 秒固定間隔輪詢 queue → build 狀態（決策六）
 * - 可展開的漸進式 console log
 * - 依統一錯誤碼顯示繁體中文 toast（決策八）
 *
 * Design: openspec/changes/add-jenkins-publish-page/design.md
 */
const PublishManager = {
  POLL_INTERVAL_MS: 3000,

  _initialised: false,
  _jobs: [],
  _selectedJob: null,
  _currentParams: [],

  // Poll / console state
  _pollTimer: null,
  _queueUrl: null,
  _buildNumber: null,
  _triggeredAt: 0,
  _consoleOpen: false,
  _consoleStart: 0,
  _consoleHasMore: false,

  ERROR_MESSAGES: {
    CONFIG_MISSING: '請先在設定填寫 Jenkins 連線資訊',
    AUTH_FAILED: 'Jenkins 認證失敗，請檢查使用者名稱與 API Token',
    NOT_FOUND: '找不到對應的 View 或作業，請確認設定的 View 名稱',
    NETWORK_ERROR: '無法連線到 Jenkins，請檢查網路與 Base URL',
    CRUMB_FAILED: '無法取得 Jenkins CSRF crumb，建置未送出',
    NO_QUEUE_LOCATION: 'Jenkins 未回傳建置佇列位置，請至 Jenkins 確認'
  },

  init() {
    if (this._initialised) return;
    this._initialised = true;

    const gotoSettings = Utils.$('btn-publish-goto-settings');
    if (gotoSettings) {
      gotoSettings.addEventListener('click', () => {
        if (typeof Settings !== 'undefined' && Settings.open) Settings.open();
      });
    }

    const refreshBtn = Utils.$('btn-publish-refresh-jobs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._loadJobs());
    }

    const triggerBtn = Utils.$('btn-publish-trigger');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this._triggerBuild());
    }

    const consoleToggle = Utils.$('btn-publish-toggle-console');
    if (consoleToggle) {
      consoleToggle.addEventListener('click', () => this._toggleConsole());
    }
  },

  /** Called by ViewSwitcher when the publish view becomes active. */
  onEnter() {
    const config =
      (typeof Settings !== 'undefined' && Settings.getConfig && Settings.getConfig()) || {};

    const configured =
      Boolean((config.jenkinsBaseUrl || '').trim()) &&
      Boolean((config.jenkinsUser || '').trim()) &&
      Boolean((config.jenkinsToken || '').trim());

    const notConfiguredEl = Utils.$('publish-not-configured');
    const contentEl = Utils.$('publish-content');

    if (!configured) {
      // Requirement: Gate publish view on configured credentials —
      // no jenkins:* IPC call happens on this path.
      if (notConfiguredEl) notConfiguredEl.style.display = 'block';
      if (contentEl) contentEl.style.display = 'none';
      return;
    }

    if (notConfiguredEl) notConfiguredEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    this._loadJobs();
  },

  /** Called by ViewSwitcher when leaving the publish view — stop all polling. */
  onLeave() {
    this._stopPolling();
    this._stopConsolePolling();
  },

  // ─── Job list ──────────────────────────────────────────────────────────

  async _loadJobs() {
    const listEl = Utils.$('publish-jobs-list');
    if (listEl) listEl.innerHTML = '<div class="loading-text">載入中…</div>';

    const res = await window.svnApi.jenkinsListJobs();
    if (!res.success) {
      if (listEl) listEl.innerHTML = '<div class="loading-text">載入失敗</div>';
      this._showError(res.error);
      return;
    }

    this._jobs = res.jobs || [];
    this._renderJobs();
  },

  _renderJobs() {
    const listEl = Utils.$('publish-jobs-list');
    if (!listEl) return;

    if (this._jobs.length === 0) {
      listEl.innerHTML = '<div class="loading-text">此 View 沒有任何作業</div>';
      return;
    }

    listEl.innerHTML = '';
    this._jobs.forEach((job) => {
      const item = document.createElement('div');
      item.className = 'publish-job-item';
      if (this._selectedJob === job.name) item.classList.add('active');
      item.innerHTML =
        `<span class="publish-job-status ${this._colorClass(job.color)}"></span>` +
        `<span>${Utils.escapeHtml(job.name)}</span>`;
      item.addEventListener('click', () => this._selectJob(job.name));
      listEl.appendChild(item);
    });
  },

  _colorClass(color) {
    if (!color) return 'disabled';
    if (color.indexOf('anime') !== -1) return 'running';
    if (color.indexOf('blue') !== -1 || color.indexOf('green') !== -1) return 'ok';
    if (color.indexOf('red') !== -1 || color.indexOf('yellow') !== -1) return 'fail';
    if (color.indexOf('disabled') !== -1 || color.indexOf('notbuilt') !== -1) return 'disabled';
    return 'disabled';
  },

  // ─── Job detail / dynamic form ─────────────────────────────────────────

  async _selectJob(jobName) {
    this._selectedJob = jobName;
    this._renderJobs();

    // Selecting a new job cancels any in-flight progress for the old one.
    this._resetProgress();

    Utils.$('publish-detail-empty').style.display = 'none';
    Utils.$('publish-detail').style.display = 'flex';
    Utils.$('publish-job-title').textContent = jobName;

    const form = Utils.$('publish-param-form');
    form.innerHTML = '<div class="loading-text">讀取參數…</div>';

    const res = await window.svnApi.jenkinsGetParams(jobName);
    if (!res.success) {
      form.innerHTML = '';
      this._showError(res.error);
      return;
    }

    this._currentParams = res.params || [];
    this._renderParamForm(res.hasParams, this._currentParams);
  },

  _renderParamForm(hasParams, params) {
    const form = Utils.$('publish-param-form');
    form.innerHTML = '';

    if (!hasParams) {
      const note = document.createElement('p');
      note.className = 'publish-param-desc';
      note.textContent = '此 job 無參數，將直接觸發建置';
      form.appendChild(note);
      return;
    }

    params.forEach((param) => {
      // ParameterSeparatorDefinition：純視覺分隔線，不是輸入欄位，也不送值。
      if (param.type === 'ParameterSeparatorDefinition') {
        const sep = document.createElement('div');
        sep.className = 'publish-param-separator';
        if (param.sectionHeader) {
          const h = document.createElement('div');
          h.className = 'publish-param-separator-header';
          h.textContent = param.sectionHeader;
          sep.appendChild(h);
        }
        sep.appendChild(document.createElement('hr'));
        form.appendChild(sep);
        return;
      }

      const field = document.createElement('div');
      field.className = 'publish-param-field';

      const label = document.createElement('label');
      label.textContent = param.name;
      label.setAttribute('for', this._fieldId(param.name));
      field.appendChild(label);

      if (param.description) {
        const desc = document.createElement('div');
        desc.className = 'publish-param-desc';
        // 決策五：description 原樣以 HTML 呈現（來源為團隊自建 Jenkins，信任邊界內）。
        desc.innerHTML = param.description;
        field.appendChild(desc);
      }

      field.appendChild(this._buildControl(param));
      form.appendChild(field);
    });
  },

  _fieldId(name) {
    return `publish-param-${name}`;
  },

  _buildControl(param) {
    const id = this._fieldId(param.name);
    const type = param.type || '';

    if (type === 'ChoiceParameterDefinition') {
      const select = document.createElement('select');
      select.id = id;
      select.className = 'input';
      select.dataset.paramName = param.name;
      select.dataset.control = 'choice';
      (param.choices || []).forEach((choice) => {
        const opt = document.createElement('option');
        opt.value = choice;
        opt.textContent = choice;
        select.appendChild(opt);
      });
      if (param.defaultValue) select.value = param.defaultValue;
      return select;
    }

    if (type === 'BooleanParameterDefinition') {
      const wrap = document.createElement('label');
      wrap.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.dataset.paramName = param.name;
      cb.dataset.control = 'boolean';
      cb.checked = param.defaultValue === true || param.defaultValue === 'true';
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(' 啟用'));
      return wrap;
    }

    if (type === 'TextParameterDefinition') {
      const ta = document.createElement('textarea');
      ta.id = id;
      ta.className = 'input';
      ta.rows = 4;
      ta.style.resize = 'vertical';
      ta.dataset.paramName = param.name;
      ta.dataset.control = 'text';
      ta.value = param.defaultValue != null ? String(param.defaultValue) : '';
      return ta;
    }

    // StringParameterDefinition + any unknown type → single-line text input.
    const container = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'input';
    input.dataset.paramName = param.name;
    input.dataset.control = 'text';
    input.value = param.defaultValue != null ? String(param.defaultValue) : '';
    container.appendChild(input);

    if (type && type !== 'StringParameterDefinition') {
      const warn = document.createElement('div');
      warn.className = 'publish-param-unsupported';
      warn.textContent = `未支援的參數型別（${type}），將以文字送出`;
      container.appendChild(warn);
    }
    return container;
  },

  _collectParams() {
    const form = Utils.$('publish-param-form');
    const params = {};
    form.querySelectorAll('[data-param-name]').forEach((el) => {
      const name = el.dataset.paramName;
      if (el.dataset.control === 'boolean') {
        params[name] = el.checked;
      } else {
        params[name] = el.value;
      }
    });
    return params;
  },

  // ─── Trigger + poll ────────────────────────────────────────────────────

  async _triggerBuild() {
    if (!this._selectedJob) return;

    // Re-triggering clears any previous progress + polling.
    this._resetProgress();

    const triggerBtn = Utils.$('btn-publish-trigger');
    triggerBtn.disabled = true;

    const params = this._collectParams();
    const res = await window.svnApi.jenkinsTrigger(this._selectedJob, params);
    triggerBtn.disabled = false;

    if (!res.success) {
      this._showError(res.error);
      return;
    }

    this._queueUrl = res.queueUrl;
    this._buildNumber = null;
    this._triggeredAt = Date.now();

    Utils.$('publish-progress').style.display = 'block';
    this._setStage('排隊中');
    this._setTime(0);
    this._setConsoleOpen(true); // 觸發後直接展開 console，省去手動點開

    this._pollTimer = setInterval(() => this._pollTick(), this.POLL_INTERVAL_MS);
    this._pollTick();
  },

  async _pollTick() {
    const jobName = this._selectedJob;

    if (!this._buildNumber) {
      const q = await window.svnApi.jenkinsQueueStatus(this._queueUrl);
      if (!q.success) {
        this._stopPolling();
        this._setStage('狀態查詢失敗');
        this._showError(q.error);
        return;
      }
      if (q.state === 'cancelled') {
        this._stopPolling();
        this._setStage('建置已取消');
        return;
      }
      if (q.state === 'running' && q.buildNumber) {
        this._buildNumber = q.buildNumber;
        this._consoleStart = 0;
        this._setStage(`建置中 #${q.buildNumber}`);
      } else {
        this._setStage('排隊中');
        this._bumpElapsed();
        return;
      }
    }

    const b = await window.svnApi.jenkinsBuildStatus(jobName, this._buildNumber);
    if (!b.success) {
      this._stopPolling();
      this._showError(b.error);
      return;
    }

    if (b.building) {
      this._setStage(`建置中 #${this._buildNumber}`);
      this._bumpElapsed();
    } else {
      this._stopPolling();
      const ok = b.result === 'SUCCESS';
      this._setStage(`${ok ? '成功' : (b.result === 'ABORTED' ? '已中止' : '失敗')} #${this._buildNumber}`);
      this._setTime(b.durationMs);
      // Pull the final console tail even if the panel is collapsed later.
      if (this._consoleOpen) this._pumpConsole();
    }

    if (this._consoleOpen) this._pumpConsole();
  },

  _bumpElapsed() {
    const secs = Math.round((Date.now() - this._triggeredAt) / 1000);
    Utils.$('publish-progress-time').textContent = `${secs} 秒`;
  },

  _setStage(text) {
    const el = Utils.$('publish-progress-stage');
    if (el) el.textContent = text;
  },

  _setTime(ms) {
    const el = Utils.$('publish-progress-time');
    if (!el) return;
    const secs = ms > 0 ? Math.round(ms / 1000) : Math.round((Date.now() - this._triggeredAt) / 1000);
    el.textContent = `${secs} 秒`;
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  _resetProgress() {
    this._stopPolling();
    this._stopConsolePolling();
    this._queueUrl = null;
    this._buildNumber = null;
    this._consoleOpen = false;
    this._consoleStart = 0;
    this._consoleHasMore = false;

    const progress = Utils.$('publish-progress');
    if (progress) progress.style.display = 'none';
    const consoleEl = Utils.$('publish-console');
    if (consoleEl) {
      consoleEl.style.display = 'none';
      consoleEl.textContent = '';
    }
    const toggle = Utils.$('btn-publish-toggle-console');
    if (toggle) toggle.textContent = '顯示 Console Log';
  },

  // ─── Console log ───────────────────────────────────────────────────────

  _toggleConsole() {
    this._setConsoleOpen(!this._consoleOpen);
  },

  _setConsoleOpen(open) {
    const consoleEl = Utils.$('publish-console');
    const toggle = Utils.$('btn-publish-toggle-console');
    if (!consoleEl) return;

    this._consoleOpen = open;
    consoleEl.style.display = open ? 'block' : 'none';
    if (toggle) toggle.textContent = open ? '隱藏 Console Log' : '顯示 Console Log';

    if (open && this._buildNumber) {
      this._pumpConsole();
    }
  },

  /**
   * Fetch console slices until there is no more data, or (while the build is
   * still running) fetch one slice and let the poll loop drive the next.
   */
  async _pumpConsole() {
    if (this._consolePumping || !this._buildNumber) return;
    this._consolePumping = true;
    try {
      // Loop only when the build has finished (poll loop stopped).
      const drain = this._pollTimer === null;
      do {
        const r = await window.svnApi.jenkinsConsole(
          this._selectedJob,
          this._buildNumber,
          this._consoleStart
        );
        if (!r.success) break;
        if (r.text) {
          const el = Utils.$('publish-console');
          if (el) {
            el.textContent += r.text;
            el.scrollTop = el.scrollHeight;
          }
        }
        this._consoleStart = r.nextStart;
        this._consoleHasMore = r.hasMore;
        if (!drain) break;
      } while (this._consoleHasMore);
    } finally {
      this._consolePumping = false;
    }
  },

  _stopConsolePolling() {
    this._consolePumping = false;
  },

  // ─── Errors ────────────────────────────────────────────────────────────

  _showError(code) {
    const msg = this.ERROR_MESSAGES[code] || `Jenkins 錯誤：${code}`;
    Toast.error('Jenkins', msg);
  }
};

window.PublishManager = PublishManager;
