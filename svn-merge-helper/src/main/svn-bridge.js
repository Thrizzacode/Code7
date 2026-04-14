const { execFile, spawn } = require('child_process');
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

  return entries.map(entry => ({
    revision: entry['@_revision'],
    author: entry.author || 'unknown',
    date: entry.date || '',
    message: entry.msg || ''
  }));
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
      const limit = options.limit || 100;
      args.push('--limit', String(limit));

      if (options.startRevision && options.endRevision) {
        args.push('--revision', `${options.startRevision}:${options.endRevision}`);
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
  async info(svnPath) {
    try {
      const stdout = await execSvn(['info', '--xml', svnPath]);
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
        if (statusRes.success && statusRes.entries) {
          const unversionedPaths = statusRes.entries
            .filter(e => e.itemStatus === 'unversioned')
            .map(e => e.path);
          
          const toAdd = filesArray.filter(f => unversionedPaths.includes(f));
          if (toAdd.length > 0) {
             await execSvn(['add', ...toAdd], { timeout: 60000 });
          }
        }
        
        const args = ['commit', '-m', message, ...filesArray];
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
   * Launch an external merge tool for a conflicted file.
   * @param {string} toolPath - Path to the merge tool executable
   * @param {string} filePath - Conflicted file path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async launchExternalTool(toolPath, filePath) {
    return new Promise((resolve) => {
      try {
        const child = spawn(toolPath, [filePath], {
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
  }
};

module.exports = SvnBridge;
