/**
 * Jenkins REST API bridge (main process).
 *
 * Every exported function returns either `{ success: true, ... }` or
 * `{ success: false, error }` where `error` is one of the ERROR codes below
 * or a raw `HTTP <status>` string. This mirrors the shape used by
 * `ai-service.js` so the renderer can branch on a stable set of values.
 *
 * Design: openspec/changes/add-jenkins-publish-page/design.md
 * - 決策一：所有 Jenkins 溝通集中在此模組，只用 Node 內建 fetch
 * - 決策二：basic auth（使用者 + API Token）寫入 Authorization header
 * - 決策三：POST 前取 CSRF crumb，GET 不需要
 * - 決策八：統一錯誤形狀與錯誤碼常數
 */

const ConfigManager = require("./config-manager");

const ERROR = {
  CONFIG_MISSING: "CONFIG_MISSING",
  AUTH_FAILED: "AUTH_FAILED",
  NOT_FOUND: "NOT_FOUND",
  NETWORK_ERROR: "NETWORK_ERROR",
  CRUMB_FAILED: "CRUMB_FAILED",
};

const REQUEST_TIMEOUT_MS = 20000;

/**
 * Read Jenkins connection settings from config and normalise them.
 * @returns {{baseUrl: string, user: string, token: string, viewName: string}}
 */
function getConfig() {
  const c = ConfigManager.load();
  return {
    baseUrl: (c.jenkinsBaseUrl || "").trim().replace(/\/+$/, ""),
    user: (c.jenkinsUser || "").trim(),
    token: (c.jenkinsToken || "").trim(),
    viewName: (c.jenkinsViewName || "").trim(),
  };
}

function isConfigured(cfg) {
  return Boolean(cfg.baseUrl && cfg.user && cfg.token);
}

function authHeaders(cfg) {
  const basic = Buffer.from(`${cfg.user}:${cfg.token}`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

function statusToError(status) {
  if (status === 401 || status === 403) return ERROR.AUTH_FAILED;
  if (status === 404) return ERROR.NOT_FOUND;
  return `HTTP ${status}`;
}

/**
 * Perform an authenticated request against the Jenkins base URL.
 * Throws on network failure / timeout; the caller maps that to NETWORK_ERROR.
 * @param {object} cfg
 * @param {string} pathAndQuery - starts with "/"
 * @param {RequestInit} [opts]
 * @returns {Promise<Response>}
 */
async function jenkinsFetch(cfg, pathAndQuery, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(cfg.baseUrl + pathAndQuery, {
      ...opts,
      headers: { ...authHeaders(cfg), ...(opts.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Encode each path segment but keep the slashes between them. */
function encodePath(name) {
  return encodeURIComponent(name);
}

/**
 * A view entry is a folder/container (not a buildable job) when its `_class`
 * ends in "Folder" (com.cloudbees.hudson.plugins.folder.Folder,
 * ...AbstractFolder, OrganizationFolder, …). Such entries have no `color`.
 */
function isFolder(entry) {
  const cls = entry && entry._class ? String(entry._class) : "";
  return /Folder$/.test(cls) || (!entry.color && /folder/i.test(cls));
}

/**
 * GET a Jenkins `api/json` endpoint and parse the body.
 * @returns {Promise<{success: true, data: object} | {success: false, error: string}>}
 */
async function getJson(cfg, pathAndQuery) {
  let res;
  try {
    res = await jenkinsFetch(cfg, pathAndQuery);
  } catch {
    return { success: false, error: ERROR.NETWORK_ERROR };
  }
  if (!res.ok) {
    return { success: false, error: statusToError(res.status) };
  }
  try {
    return { success: true, data: await res.json() };
  } catch {
    return { success: false, error: ERROR.NETWORK_ERROR };
  }
}

// ─── Jobs ────────────────────────────────────────────────────────────────

/**
 * List every job in the configured Jenkins view.
 * 決策四：view API，呼叫端每次進入頁面重新抓取，此處不做快取。
 * @returns {Promise<{success: true, jobs: Array<{name: string, url: string, color: string}>} | {success: false, error: string}>}
 */
async function listJobs() {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!cfg.viewName) return { success: false, error: ERROR.NOT_FOUND };

  const result = await getJson(
    cfg,
    `/view/${encodePath(cfg.viewName)}/api/json?tree=jobs[name,url,color,_class]`,
  );
  if (!result.success) return result;

  const jobs = (result.data.jobs || [])
    // Folders (e.g. "Archive") are containers, not buildable jobs — skip them.
    .filter((j) => !isFolder(j))
    .map((j) => ({
      name: j.name,
      url: j.url,
      color: j.color || "",
    }));
  return { success: true, jobs };
}

/**
 * Fetch a job's parameter definitions.
 * 決策五（資料面）：回傳原始型別，控件對應由渲染層處理。
 * @param {string} jobName
 * @returns {Promise<{success: true, hasParams: boolean, params: Array} | {success: false, error: string}>}
 */
async function getJobParameters(jobName) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!jobName) return { success: false, error: ERROR.NOT_FOUND };

  const tree =
    "property[parameterDefinitions[name,type,description," +
    "defaultParameterValue[value],choices,sectionHeader]]";
  const result = await getJson(
    cfg,
    `/job/${encodePath(jobName)}/api/json?tree=${encodeURIComponent(tree)}`,
  );
  if (!result.success) return result;

  const defs = [];
  for (const prop of result.data.property || []) {
    if (Array.isArray(prop.parameterDefinitions)) {
      defs.push(...prop.parameterDefinitions);
    }
  }

  const params = defs.map((d) => ({
    name: d.name,
    type: d.type || "",
    description: d.description || "",
    defaultValue:
      d.defaultParameterValue && d.defaultParameterValue.value !== undefined
        ? d.defaultParameterValue.value
        : "",
    choices: Array.isArray(d.choices) ? d.choices : null,
    // ParameterSeparatorDefinition (Parameter Separator plugin) — a visual
    // divider, not an input. `sectionHeader` is its display heading.
    sectionHeader: d.sectionHeader || "",
  }));

  return { success: true, hasParams: params.length > 0, params };
}

// ─── Trigger ─────────────────────────────────────────────────────────────

function paramValueToString(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value == null ? "" : value);
}

/**
 * Fetch a CSRF crumb. Returns `null` when the crumb issuer is unavailable
 * so the caller can fall back to a crumb-less POST (決策三 / spec scenario
 * "Crumb endpoint unavailable").
 * @returns {Promise<{field: string, value: string} | null>}
 */
async function fetchCrumb(cfg) {
  try {
    const res = await jenkinsFetch(cfg, "/crumbIssuer/api/json");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.crumbRequestField || !data.crumb) return null;
    return { field: data.crumbRequestField, value: data.crumb };
  } catch {
    return null;
  }
}

async function postBuild(cfg, endpoint, body, crumb) {
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (crumb) headers[crumb.field] = crumb.value;
  return jenkinsFetch(cfg, endpoint, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
}

/**
 * Trigger a build for `jobName` with the given parameter map.
 * 決策三：先取 crumb 再 POST；crumb 不可用時以無 crumb 重試一次，仍失敗回 CRUMB_FAILED。
 * @param {string} jobName
 * @param {Record<string, string|boolean>} params
 * @returns {Promise<{success: true, queueUrl: string} | {success: false, error: string}>}
 */
async function triggerBuild(jobName, params) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!jobName) return { success: false, error: ERROR.NOT_FOUND };

  const entries = Object.entries(params || {});
  const hasParams = entries.length > 0;
  const endpoint = hasParams
    ? `/job/${encodePath(jobName)}/buildWithParameters`
    : `/job/${encodePath(jobName)}/build`;

  const body = new URLSearchParams();
  for (const [key, value] of entries) {
    body.append(key, paramValueToString(value));
  }

  const crumb = await fetchCrumb(cfg);
  const crumbUnavailable = crumb === null;

  let res;
  try {
    res = await postBuild(cfg, endpoint, body, crumb);
  } catch {
    return {
      success: false,
      error: crumbUnavailable ? ERROR.CRUMB_FAILED : ERROR.NETWORK_ERROR,
    };
  }

  // A stale/rejected crumb still surfaces as 403 — retry once without it.
  if ((res.status === 403 || res.status === 401) && crumb) {
    try {
      res = await postBuild(cfg, endpoint, body, null);
    } catch {
      return { success: false, error: ERROR.NETWORK_ERROR };
    }
  }

  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      error: crumbUnavailable ? ERROR.CRUMB_FAILED : ERROR.AUTH_FAILED,
    };
  }
  if (res.status === 404) return { success: false, error: ERROR.NOT_FOUND };
  if (!(res.status >= 200 && res.status < 400)) {
    return { success: false, error: `HTTP ${res.status}` };
  }

  const location = res.headers.get("location");
  if (!location) {
    return { success: false, error: "NO_QUEUE_LOCATION" };
  }
  return { success: true, queueUrl: location };
}

// ─── Poll ────────────────────────────────────────────────────────────────

/**
 * Check a queue item. 決策六 階段一/二。
 * @param {string} queueUrl - absolute URL from `triggerBuild`, ends with "/"
 * @returns {Promise<{success: true, state: 'queued'|'running'|'cancelled', buildNumber?: number} | {success: false, error: string}>}
 */
async function getQueueStatus(queueUrl) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!queueUrl) return { success: false, error: ERROR.NOT_FOUND };

  const normalized = queueUrl.endsWith("/") ? queueUrl : `${queueUrl}/`;
  let res;
  try {
    res = await fetch(`${normalized}api/json`, {
      headers: authHeaders(cfg),
    });
  } catch {
    return { success: false, error: ERROR.NETWORK_ERROR };
  }
  if (!res.ok) return { success: false, error: statusToError(res.status) };

  let data;
  try {
    data = await res.json();
  } catch {
    return { success: false, error: ERROR.NETWORK_ERROR };
  }

  if (data.cancelled) return { success: true, state: "cancelled" };
  if (data.executable && typeof data.executable.number === "number") {
    return {
      success: true,
      state: "running",
      buildNumber: data.executable.number,
    };
  }
  return { success: true, state: "queued" };
}

/**
 * Check a build. 決策六 階段二。
 * @param {string} jobName
 * @param {number} buildNumber
 * @returns {Promise<{success: true, building: boolean, result: string|null, durationMs: number, timestamp: number} | {success: false, error: string}>}
 */
async function getBuildStatus(jobName, buildNumber) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!jobName || !buildNumber) return { success: false, error: ERROR.NOT_FOUND };

  const result = await getJson(
    cfg,
    `/job/${encodePath(jobName)}/${buildNumber}/api/json` +
      `?tree=building,result,duration,timestamp`,
  );
  if (!result.success) return result;

  return {
    success: true,
    building: Boolean(result.data.building),
    result: result.data.result || null,
    durationMs: result.data.duration || 0,
    timestamp: result.data.timestamp || 0,
  };
}

/**
 * Fetch a progressive slice of a build's console log.
 * @param {string} jobName
 * @param {number} buildNumber
 * @param {number} start - byte offset; 0 for the first call
 * @returns {Promise<{success: true, text: string, nextStart: number, hasMore: boolean} | {success: false, error: string}>}
 */
async function getConsole(jobName, buildNumber, start) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) return { success: false, error: ERROR.CONFIG_MISSING };
  if (!jobName || !buildNumber) return { success: false, error: ERROR.NOT_FOUND };

  const offset = Number.isFinite(start) && start > 0 ? Math.floor(start) : 0;
  let res;
  try {
    res = await jenkinsFetch(
      cfg,
      `/job/${encodePath(jobName)}/${buildNumber}/logText/progressiveText?start=${offset}`,
    );
  } catch {
    return { success: false, error: ERROR.NETWORK_ERROR };
  }
  if (!res.ok) return { success: false, error: statusToError(res.status) };

  const text = await res.text();
  const textSize = parseInt(res.headers.get("x-text-size") || "", 10);
  const hasMore = res.headers.get("x-more-data") === "true";
  return {
    success: true,
    text,
    nextStart: Number.isFinite(textSize) ? textSize : offset + text.length,
    hasMore,
  };
}

module.exports = {
  ERROR,
  listJobs,
  getJobParameters,
  triggerBuild,
  getQueueStatus,
  getBuildStatus,
  getConsole,
};
