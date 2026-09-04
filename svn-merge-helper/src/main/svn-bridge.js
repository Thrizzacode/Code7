const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const LOG_TIMEOUT = 60000;     // 60 seconds

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  trimValues: true
});

/**
 * Execute an SVN command using execFile (not exec, to prevent shell injection).
 * @param {string[]} args - SVN command arguments
 * @param {object} options - { timeout, cwd }
 * @returns {Promise<string>} stdout
 */
function execSvn(args, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const cwd = options.cwd || undefined;

  return new Promise((resolve, reject) => {
    const child = execFile('svn', args, { timeout, cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const errMsg = stderr || error.message;
        // Classify error type
        if (error.killed) {
          reject({ type: 'timeout', message: `SVN command timed out after ${timeout / 1000} seconds`, raw: errMsg });
        } else if (/authorization failed|authentication/i.test(errMsg)) {
          reject({ type: 'auth', message: 'SVN authentication failed. Please check your SVN credentials.', raw: errMsg });
        } else if (/unable to connect|could not connect|network/i.test(errMsg)) {
          reject({ type: 'network', message: 'Cannot connect to SVN server. Please check your network connection.', raw: errMsg });
        } else {
          reject({ type: 'generic', message: errMsg, raw: errMsg });
        }
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Parse SVN XML log output into structured LogEntry array.
 */
function parseLogXml(xml) {
  const parsed = xmlParser.parse(xml);
  if (!parsed.log || !parsed.log.logentry) return [];

  const entries = Array.isArray(parsed.log.logentry) ? parsed.log.logentry : [parsed.log.logentry];

  return entries.map(entry => {
    let changedPaths = [];
    if (entry.paths && entry.paths.path) {
      const paths = Array.isArray(entry.paths.path) ? entry.paths.path : [entry.paths.path];
      changedPaths = paths.map(p => ({
        action: p['@_action'],
        path: p['#text'] || p['#cdata-section'] || ''
      }));
    }

    return {
      revision: entry['@_revision'],
      author: entry.author || 'unknown',
      date: entry.date || '',
      message: entry.msg || '',
      changedPaths
    };
  });
}

/**
 * Parse SVN XML info output.
 */
function parseInfoXml(xml) {
  const parsed = xmlParser.parse(xml);
  const entry = parsed.info && parsed.info.entry;
  if (!entry) return null;

  return {
    url: entry.url || '',
    repositoryRoot: (entry.repository && entry.repository.root) || '',
    revision: entry['@_revision'],
    lastChangedRevision: (entry.commit && entry.commit['@_revision']) || entry['@_revision']
  };
}

/**
 * Parse SVN XML status output.
 */
function parseStatusXml(xml) {
  const parsed = xmlParser.parse(xml);
  if (!parsed.status || !parsed.status.target || !parsed.status.target.entry) return [];

  const entries = Array.isArray(parsed.status.target.entry)
    ? parsed.status.target.entry
    : [parsed.status.target.entry];

  return entries.map(entry => ({
    path: entry['@_path'] || '',
    itemStatus: (entry['wc-status'] && entry['wc-status']['@_item']) || 'none',
    propsStatus: (entry['wc-status'] && entry['wc-status']['@_props']) || 'none'
  }));
}

/**
 * Parse SVN XML list output.
 */
function parseListXml(xml) {
  const parsed = xmlParser.parse(xml);
  if (!parsed.lists || !parsed.lists.list || !parsed.lists.list.entry) return [];

  const entries = Array.isArray(parsed.lists.list.entry)
    ? parsed.lists.list.entry
    : [parsed.lists.list.entry];

  return entries.map(entry => ({
    name: entry.name || '',
    kind: entry['@_kind'] || 'unknown',
    size: entry.size || 0,
    commit: entry.commit ? {
      revision: entry.commit['@_revision'],
      author: entry.commit.author,
      date: entry.commit.date
    } : null
  }));
}

/**
 * Parse `svn merge --dry-run` notification output into categorised file lists.
 * SVN prints one line per changed path with up to four leading status columns
 * (col 1 = content action, col 4 = tree-conflict marker), then the path.
 * Section headers ("--- Merging ...", "--- Recording mergeinfo ...") and the
 * "Summary of conflicts" trailer are ignored, as is the working-copy root ('.').
 * @param {string} stdout
 * @returns {{updated: string[], added: string[], deleted: string[], conflicted: string[], raw: string}}
 */
function parseMergePreview(stdout) {
  const updated = new Set();
  const added = new Set();
  const deleted = new Set();
  const conflicted = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('---') || /^Summary of conflicts/.test(line)) continue;

    const m = line.match(/^(.)(.)(.)(.)\s+(.+)$/);
    if (!m) continue;

    const contentCol = m[1];
    const treeCol = m[4];
    const file = m[5].trim();
    if (!file || file === '.') continue;

    if (treeCol === 'C' || contentCol === 'C') {
      conflicted.add(file);
    } else if (contentCol === 'A') {
      added.add(file);
    } else if (contentCol === 'D') {
      deleted.add(file);
    } else if (contentCol === 'U' || contentCol === 'G' || contentCol === 'M') {
      updated.add(file);
    }
  }

  // A conflicted file must not also be reported as a plain update/add.
  for (const f of conflicted) {
    updated.delete(f);
    added.delete(f);
    deleted.delete(f);
  }

  return {
    updated: [...updated],
    added: [...added],
    deleted: [...deleted],
    conflicted: [...conflicted],
    raw: stdout
  };
}

// ─── Public API ────────────────────────────────────────────────────

const SvnBridge = {
  /**
   * Check if SVN CLI is available.
   * @returns {Promise<{available: boolean, version?: string, error?: string}>}
   */
  async checkAvailability() {
    try {
      const stdout = await execSvn(['--version', '--quiet'], { timeout: 10000 });
      return { available: true, version: stdout.trim() };
    } catch (err) {
      return { available: false, error: err.message || 'SVN CLI not found' };
    }
  },

  /**
   * Get SVN log entries.
   * @param {string} svnPath - SVN URL or working copy path
   * @param {object} options - { limit, startRevision, endRevision }
   * @returns {Promise<{success: boolean, entries?: LogEntry[], error?: object}>}
   */
  async log(svnPath, options = {}) {
    try {
      const args = ['log', '--xml'];
      
      // Handle limit
      const limit = options.limit || 100;
      args.push('--limit', String(limit));

      // Handle revision range or single revision
      if (options.revision) {
        args.push('--revision', String(options.revision));
      } else if (options.startRevision && options.endRevision) {
        args.push('--revision', `${options.startRevision}:${options.endRevision}`);
      } else {
        // Default to HEAD:1 so local WC BASE revision doesn't hide recent commits
        args.push('--revision', 'HEAD:1');
      }

      // Handle verbose
      if (options.verbose) {
        args.push('--verbose');
      }

      args.push(svnPath);

      const stdout = await execSvn(args, { timeout: LOG_TIMEOUT });
      const entries = parseLogXml(stdout);
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Get SVN info.
   * @param {string} svnPath
   * @returns {Promise<{success: boolean, info?: RepoInfo, error?: object}>}
   */
  async info(svnPath, options = {}) {
    try {
      const args = ['info', '--xml'];
      if (options.revision) {
        args.push('--revision', String(options.revision));
      }
      args.push(svnPath);
      const stdout = await execSvn(args);
      const info = parseInfoXml(stdout);
      return { success: true, info };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Get SVN status (working copy state).
   * @param {string} wcPath - Working copy path
   * @returns {Promise<{success: boolean, entries?: StatusEntry[], error?: object}>}
   */
  async status(wcPath) {
    try {
      const stdout = await execSvn(['status', '--xml', wcPath]);
      const entries = parseStatusXml(stdout);
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Merge specific revisions from source URL into target working copy.
   * @param {string} sourceUrl - Source SVN URL
   * @param {string} targetWcPath - Target working copy path
   * @param {number[]} revisions - Revision numbers to cherry-pick
   * @returns {Promise<{success: boolean, output?: string, error?: object}>}
   */
  async merge(sourceUrl, targetWcPath, revisions) {
    try {
      const args = ['merge'];
      // Build -c flag for cherry-pick: -c r1,r2,r3
      revisions.forEach(rev => {
        args.push('-c', String(rev));
      });
      args.push(sourceUrl, targetWcPath);

      const stdout = await execSvn(args, { timeout: 120000 }); // 2 min timeout for merge
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Dry-run a cherry-pick merge to preview which files would change, without
   * touching the working copy. Runs with cwd set to the target working copy and
   * merges into '.', so notification paths are relative to the working copy root.
   * @param {string} sourceUrl - Source SVN URL
   * @param {string} targetWcPath - Target working copy path
   * @param {number[]} revisions - Revision numbers to preview
   * @returns {Promise<{success: boolean, preview?: {updated: string[], added: string[], deleted: string[], conflicted: string[], raw: string}, error?: object}>}
   */
  async mergePreview(sourceUrl, targetWcPath, revisions) {
    try {
      const args = ['merge'];
      revisions.forEach(rev => {
        args.push('-c', String(rev));
      });
      args.push('--dry-run', sourceUrl, '.');

      const stdout = await execSvn(args, { timeout: 120000, cwd: targetWcPath });
      return { success: true, preview: parseMergePreview(stdout) };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Roll back an uncommitted merge in the target working copy: recursive revert,
   * then delete the files the dry-run preview reported as additions that are
   * still unversioned afterwards. Pre-existing unversioned files are left alone.
   * @param {string} wcPath - Target working copy path
   * @param {string[]} [addedPaths] - Paths (relative to wcPath) the preview classified as added
   * @returns {Promise<{success: boolean, reverted: string[], removed: string[], failedRemovals: string[], error?: object}>}
   */
  async rollbackMerge(wcPath, addedPaths = []) {
    const revertRes = await this.revert(wcPath, { recursive: true });
    if (!revertRes.success) {
      return { success: false, reverted: [], removed: [], failedRemovals: [], error: revertRes.error };
    }

    const removed = [];
    const failedRemovals = [];

    if (Array.isArray(addedPaths) && addedPaths.length > 0) {
      const statusRes = await this.status(wcPath);
      const unversioned = new Set(
        (statusRes.success ? statusRes.entries : [])
          .filter(e => e.itemStatus === 'unversioned')
          .map(e => path.resolve(e.path))
      );

      for (const rel of addedPaths) {
        const abs = path.resolve(wcPath, rel);
        if (!unversioned.has(abs)) continue; // committed elsewhere, or not actually left behind
        try {
          fs.rmSync(abs, { force: true, recursive: true });
          removed.push(rel);
        } catch (_) {
          failedRemovals.push(rel);
        }
      }
    }

    return { success: true, reverted: [wcPath], removed, failedRemovals };
  },

  /**
   * Commit changes in working copy.
   * @param {string} wcPath
   * @param {string} message
   * @param {string[]} [filesArray] - Optional array of specific files to commit
   * @returns {Promise<{success: boolean, revision?: number, error?: object}>}
   */
  async commit(wcPath, message, filesArray) {
    try {
      if (filesArray && filesArray.length > 0) {
        // Find unversioned files and add them
        const statusRes = await this.status(wcPath);
        let unversionedPaths = [];
        if (statusRes.success && statusRes.entries) {
          unversionedPaths = statusRes.entries
            .filter(e => e.itemStatus === 'unversioned')
            .map(e => e.path);

          const toAdd = filesArray.filter(f => unversionedPaths.includes(f));
          if (toAdd.length > 0) {
             await execSvn(['add', ...toAdd], { timeout: 60000 });
          }
        }

        // --depth empty: commit exactly the paths the user selected. Without it,
        // a directory target (e.g. a folder whose only change is svn:mergeinfo)
        // would recursively sweep in unselected modifications of its children.
        // Exception: a newly-added directory (scheduled add, or an unversioned
        // dir just added above) must stay recursive so its contents commit too.
        const recursivePaths = new Set([
          ...(statusRes.entries || [])
            .filter(e => e.itemStatus === 'added')
            .map(e => e.path),
          ...unversionedPaths
        ]);
        const hasAddedDir = filesArray.some(f => {
          if (!recursivePaths.has(f)) return false;
          try { return fs.statSync(f).isDirectory(); } catch (_) { return false; }
        });

        const args = ['commit'];
        if (!hasAddedDir) args.push('--depth', 'empty');
        args.push('-m', message, ...filesArray);
        const stdout = await execSvn(args, { timeout: 120000 });
        const match = stdout.match(/Committed revision (\d+)/i);
        const revision = match ? parseInt(match[1], 10) : null;
        return { success: true, revision, output: stdout };
      } else {
        const stdout = await execSvn(['commit', '-m', message, wcPath], { timeout: 120000 });
        const match = stdout.match(/Committed revision (\d+)/i);
        const revision = match ? parseInt(match[1], 10) : null;
        return { success: true, revision, output: stdout };
      }
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Resolve a conflicted file (accept working copy version).
   * @param {string} filePath
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async resolve(filePath) {
    try {
      await execSvn(['resolve', '--accept', 'working', filePath]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Get eligible revisions from sourceUrl to targetWcPath.
   * @param {string} sourceUrl
   * @param {string} targetWcPath
   * @returns {Promise<{success: boolean, eligibleRevisions?: number[], error?: object}>}
   */
  async mergeinfo(sourceUrl, targetWcPath) {
    try {
      const stdout = await execSvn(['mergeinfo', '--show-revs=eligible', sourceUrl, targetWcPath]);
      const eligibleRevisions = [];
      stdout.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('r')) {
          const cleanLine = line.replace(/r/g, '').replace(/\*/g, '');
          const parts = cleanLine.split('-');
          if (parts.length === 2) {
            const start = parseInt(parts[0], 10);
            const end = parseInt(parts[1], 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                eligibleRevisions.push(i);
              }
            }
          } else {
            const rev = parseInt(parts[0], 10);
            if (!isNaN(rev)) eligibleRevisions.push(rev);
          }
        }
      });
      
      return { success: true, eligibleRevisions };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Retrieve SVN conflict file paths for a conflicted file via `svn info --xml`.
   * Returns { base, theirs, mine } absolute paths, or null if the file has no
   * conflict info. For tree conflicts the three fields are null (no text-conflict
   * files exist), and the caller falls back to opening the file directly.
   *
   * NOTE: in `svn info --xml` (SVN 1.8+) the <conflict> element is a direct child
   * of <entry>, not nested under <wc-info>. The <wc-info> lookup is kept only as
   * a fallback for hypothetical older layouts.
   */
  async _getConflictFiles(filePath) {
    try {
      const xml = await execSvn(['info', '--xml', filePath]);
      const parsed = xmlParser.parse(xml);
      const entry = parsed?.info?.entry;
      const conflict = entry?.conflict ?? entry?.['wc-info']?.conflict;
      if (!conflict) return null;

      const dir = path.dirname(filePath);
      // SVN reports absolute paths here; path.resolve is a no-op on those and
      // still handles the bare-filename form that older SVN emitted.
      const resolve = (p) => (p ? path.resolve(dir, String(p)) : null);

      return {
        base:   resolve(conflict['prev-base-file']),
        theirs: resolve(conflict['cur-base-file']),
        mine:   resolve(conflict['prev-wc-file']),
      };
    } catch {
      return null;
    }
  },

  /**
   * Launch an external merge tool for a conflicted file.
   * @param {string} toolPath - Path to the merge tool executable
   * @param {string} filePath - Conflicted file path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async launchExternalTool(toolPath, filePath) {
    const conflictFiles = await this._getConflictFiles(filePath);

    let args;
    if (conflictFiles && conflictFiles.base && conflictFiles.theirs && conflictFiles.mine) {
      args = [
        `/base:${conflictFiles.base}`,
        `/theirs:${conflictFiles.theirs}`,
        `/mine:${conflictFiles.mine}`,
        `/merged:${filePath}`,
      ];
    } else {
      // Fallback: let TortoiseMerge open the file directly
      args = [filePath];
    }

    return new Promise((resolve) => {
      try {
        const child = spawn(toolPath, args, {
          detached: true,
          stdio: 'ignore'
        });

        child.on('error', (err) => {
          resolve({ success: false, error: `Failed to launch merge tool: ${err.message}` });
        });

        child.on('close', (code) => {
          resolve({ success: true, exitCode: code });
        });

        child.unref();
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  },

  /**
   * Update a working copy.
   * @param {string} wcPath
   * @returns {Promise<{success: boolean, output?: string, error?: object}>}
   */
  async update(wcPath) {
    try {
      const stdout = await execSvn(['update', wcPath], { timeout: 120000 });
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Revert changes in a working copy path.
   * @param {string|string[]} targetPath - Path or array of paths to revert
   * @param {{recursive?: boolean}} [options] - recursive:true adds -R for a full subtree revert
   * @returns {Promise<{success: boolean, output?: string, error?: object}>}
   */
  async revert(targetPath, options = {}) {
    try {
      const paths = Array.isArray(targetPath) ? targetPath : [targetPath];
      const args = ['revert'];
      if (options && options.recursive) args.push('-R');
      args.push(...paths);
      const stdout = await execSvn(args, { timeout: 60000 });
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Ensure a local path exists in the working copy (expand sparse checkout).
   * @param {string} wcPath
   * @returns {Promise<{success: boolean, output?: string, error?: object}>}
   */
  async ensureLocalPath(wcPath) {
    try {
      const stdout = await execSvn(['update', '--set-depth', 'infinity', wcPath], { timeout: 120000 });
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * List contents of a remote SVN repository URL.
   * @param {string} svnUrl
   * @returns {Promise<{success: boolean, entries?: object[], error?: object}>}
   */
  async list(svnUrl) {
    try {
      const stdout = await execSvn(['list', '--xml', svnUrl], { timeout: 15000 });
      const entries = parseListXml(stdout);
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Get SVN log entries for specific revision numbers.
   * Fetches the range from min to max revision and filters to the requested set.
   * @param {string} svnPath - SVN URL or working copy path
   * @param {number[]} revisions - Exact revision numbers to fetch
   * @returns {Promise<{success: boolean, entries?: LogEntry[], error?: object}>}
   */
  async logRevisions(svnPath, revisions) {
    if (!revisions || revisions.length === 0) return { success: true, entries: [] };

    const nums = revisions.map(Number);
    const minRev = Math.min(...nums);
    const maxRev = Math.max(...nums);
    const revSet = new Set(nums);

    try {
      const args = ['log', '--xml', '--revision', `${minRev}:${maxRev}`, svnPath];
      const stdout = await execSvn(args, { timeout: LOG_TIMEOUT });
      const allEntries = parseLogXml(stdout);
      const entries = allEntries
        .filter(e => revSet.has(Number(e.revision)))
        .sort((a, b) => Number(a.revision) - Number(b.revision));
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err };
    }
  },

  /**
   * Get SVN diff for specific versioned files.
   * @param {string[]} filePaths - Array of absolute paths to versioned files
   * @returns {Promise<{success: boolean, diff?: string, error?: string}>}
   */
  async diff(filePaths) {
    if (filePaths.length === 0) {
      return { success: true, diff: '' };
    }

    try {
      const stdout = await execSvn(['diff', ...filePaths]);
      const DIFF_LIMIT = 8000;
      const diff = stdout.length > DIFF_LIMIT
        ? stdout.slice(0, DIFF_LIMIT) + '\n[... diff 已截斷，僅顯示前 8000 字元 ...]'
        : stdout;
      return { success: true, diff };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }
};

module.exports = SvnBridge;
