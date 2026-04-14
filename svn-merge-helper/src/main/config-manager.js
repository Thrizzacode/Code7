const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { execFile } = require('child_process');

const CONFIG_DIR_NAME = 'svn-merge-helper';
const CONFIG_FILE_NAME = 'config.json';

const DEFAULT_PATH_TEMPLATES = {
  branches: 'branches/{version}',
  qat: 'trunk/05-Code-{version}',
  stg: 'trunk/05-Code-Stage-{version}'
};

/**
 * Get the config file path.
 * Uses Electron's app.getPath('userData') if available, else falls back to APPDATA.
 */
function getConfigDir() {
  try {
    return app.getPath('userData');
  } catch {
    const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    return path.join(appData, CONFIG_DIR_NAME);
  }
}

function getConfigPath() {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Create default empty config.
 */
function createDefaultConfig() {
  return {
    projects: [],
    mergeToolPath: '',
    defaultPathTemplates: { ...DEFAULT_PATH_TEMPLATES },
    theme: 'physicam',
    mode: 'dark',
    iisSettingFilesPath: ''
  };
}

// Lazy-require to avoid circular deps (SvnBridge also requires electron, which is fine in main)
function getSvnBridge() {
  return require('./svn-bridge');
}

/**
 * Read the branches directory for a given working copy root and return
 * subdirectory names that look like version numbers (e.g. "1.9.0", "2.0.1").
 * Hidden entries (starting with ".") are ignored.
 * @param {string} wcRoot - Absolute path to project working copy root
 * @returns {string[]} Sorted list of version-like branch names
 */
function readProjectVersions(wcRoot) {
  const branchesDir = path.join(wcRoot, 'branches');
  try {
    if (!fs.existsSync(branchesDir)) return [];
    const entries = fs.readdirSync(branchesDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
  } catch {
    return [];
  }
}

const ConfigManager = {
  /**
   * Load config from disk.
   * @returns {{projects: Array, mergeToolPath: string, defaultPathTemplates: object}}
   */
  load() {
    const configPath = getConfigPath();
    try {
      if (!fs.existsSync(configPath)) {
        return createDefaultConfig();
      }
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      // Ensure all required fields exist
      return {
        projects: config.projects || [],
        mergeToolPath: config.mergeToolPath || '',
        defaultPathTemplates: config.defaultPathTemplates || { ...DEFAULT_PATH_TEMPLATES },
        theme: config.theme || 'physicam',
        mode: config.mode || 'dark',
        iisSettingFilesPath: config.iisSettingFilesPath || ''
      };
    } catch {
      return createDefaultConfig();
    }
  },

  /**
   * Save config to disk.
   * @param {object} config
   * @returns {{success: boolean, error?: string}}
   */
  save(config) {
    const configPath = getConfigPath();
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Validate that a path exists on the filesystem.
   * @param {string} dirPath
   * @returns {{valid: boolean, error?: string}}
   */
  validatePath(dirPath) {
    try {
      if (!dirPath || dirPath.trim() === '') {
        return { valid: false, error: 'Path is empty' };
      }
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Path does not exist' };
    }
  },

  /**
   * Attempt to auto-detect TortoiseMerge from Windows Registry.
   * Falls back to common installation paths.
   * @returns {Promise<{found: boolean, path?: string}>}
   */
  async detectMergeTool() {
    // Try common registry paths via command line
    const regPaths = [
      'HKLM\\SOFTWARE\\TortoiseSVN',
      'HKLM\\SOFTWARE\\WOW6432Node\\TortoiseSVN',
      'HKCU\\SOFTWARE\\TortoiseSVN'
    ];

    for (const regPath of regPaths) {
      try {
        const result = await new Promise((resolve, reject) => {
          execFile('reg', ['query', regPath, '/v', 'Directory', '/reg:64'], { timeout: 5000 }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          });
        });

        const match = result.match(/Directory\s+REG_SZ\s+(.+)/i);
        if (match) {
          const tortoiseDir = match[1].trim();
          const mergePath = path.join(tortoiseDir, 'bin', 'TortoiseMerge.exe');
          if (fs.existsSync(mergePath)) {
            return { found: true, path: mergePath };
          }
        }
      } catch {
        // Try next path
      }
    }

    // Fallback: check common installation directories
    const commonPaths = [
      'C:\\Program Files\\TortoiseSVN\\bin\\TortoiseMerge.exe',
      'C:\\Program Files (x86)\\TortoiseSVN\\bin\\TortoiseMerge.exe'
    ];

    for (const toolPath of commonPaths) {
      if (fs.existsSync(toolPath)) {
        return { found: true, path: toolPath };
      }
    }

    return { found: false };
  },

  /**
   * Get default path templates.
   */
  getDefaultPathTemplates() {
    return { ...DEFAULT_PATH_TEMPLATES };
  },

  /**
   * Resolve SVN path from project config + environment + version.
   * @param {object} project - Project config object
   * @param {string} env - 'branches' | 'qat' | 'stg'
   * @param {string} version - e.g., '1.9.0'
   * @returns {{repoUrl: string, wcPath: string}}
   */
  resolvePaths(project, env, version) {
    const templates = project.pathTemplates || DEFAULT_PATH_TEMPLATES;
    const template = templates[env];
    if (!template) {
      throw new Error(`No path template found for environment: ${env}`);
    }
    const relativePath = template.replace('{version}', version);
    return {
      repoUrl: `${project.repoUrl}/${relativePath}`,
      wcPath: path.join(project.workingCopyRoot, relativePath)
    };
  },

  /**
   * Expose dynamic branch detection for the renderer (BranchSelector).
   * Parses the path templates to find the correct directory and prefix,
   * then scans it for available versions, avoiding returning versions
   * that belong to a more specific prefix in the same directory.
   * @param {string} wcRoot - Working copy root path
   * @param {object} templates - All path templates for the project
   * @param {string} env - The target environment key (e.g. 'qat')
   * @returns {string[]} List of version names
   */
  /**
   * Expose dynamic branch detection for the renderer (BranchSelector).
   * Hybrid mode: Queries both remote SVN and local filesystem.
   * @param {string} wcRoot - Working copy root path
   * @param {object} templates - All path templates for the project
   * @param {string} env - The target environment key (e.g. 'qat')
   * @returns {Promise<Array<{version: string, presentLocally: boolean}>>}
   */
  async getEnvVersions(wcRoot, templates, env) {
    const pathTemplate = templates && templates[env];
    if (!wcRoot || !pathTemplate || !pathTemplate.includes('{version}')) {
      return [];
    }

    const prefixPath = pathTemplate.split('{version}')[0];
    const lastSlashIndex = prefixPath.lastIndexOf('/');
    
    let subDir = '';
    let prefix = prefixPath;
    
    if (lastSlashIndex !== -1) {
      subDir = prefixPath.substring(0, lastSlashIndex);
      prefix = prefixPath.substring(lastSlashIndex + 1);
    }

    const targetDir = path.join(wcRoot, subDir);
    const config = this.load();
    const project = config.projects.find(p => p.workingCopyRoot === wcRoot);
    const baseUrl = project ? project.repoUrl : null;

    // 1. Pre-calculate other prefixes that should be excluded from this env
    // (e.g., if env is 'qat', we exclude '05-Code-Stage-' prefix from 'stg')
    const otherPrefixes = Object.keys(templates || {})
      .filter(k => k !== env)
      .map(k => templates[k].split('{version}')[0])
      .filter(p => {
        const pLastSlash = p.lastIndexOf('/');
        const pDir = pLastSlash !== -1 ? p.substring(0, pLastSlash) : '';
        const pPrefix = pLastSlash !== -1 ? p.substring(pLastSlash + 1) : p;
        // Prefix must be in the same subDir, start with our prefix, and be longer
        return pDir === subDir && pPrefix.startsWith(prefix) && pPrefix.length > prefix.length;
      })
      .map(p => {
        const pLastSlash = p.lastIndexOf('/');
        return pLastSlash !== -1 ? p.substring(pLastSlash + 1) : p;
      });

    // 2. Fetch Remote Versions
    const remotePromise = (async () => {
      if (!baseUrl) return [];
      const SvnBridge = getSvnBridge();
      const remotePath = `${baseUrl}/${subDir}`;
      const res = await SvnBridge.list(remotePath.replace(/\/$/, ''));
      if (!res.success) return [];
      
      return res.entries
        .filter(e => {
          if (e.kind !== 'dir' || !e.name.startsWith(prefix)) return false;
          // Must not match any longer prefix from another environment
          for (const other of otherPrefixes) {
            if (e.name.startsWith(other)) return false;
          }
          return true;
        })
        .map(e => e.name.slice(prefix.length));
    })();

    // 3. Fetch Local Versions
    const localVersions = [];
    if (fs.existsSync(targetDir)) {
      try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        entries.forEach(e => {
          if (!e.isDirectory() || !e.name.startsWith(prefix) || e.name === '.svn') return;
          // Must not match any longer prefix from another environment
          for (const otherPrefix of otherPrefixes) {
            if (e.name.startsWith(otherPrefix)) return;
          }
          localVersions.push(e.name.slice(prefix.length));
        });
      } catch {
        // Ignore local read errors
      }
    }

    const remoteVersions = await remotePromise;
    const remoteSet = new Set(remoteVersions);
    const localSet = new Set(localVersions);

    // 4. Merge and mark status
    const allVersions = Array.from(new Set([...remoteVersions, ...localVersions]));
    
    return allVersions
      .map(v => ({
        version: v,
        presentLocally: localSet.has(v),
        presentRemotely: remoteSet.has(v)
      }))
      .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true, sensitivity: 'base' }));
  },

  /**
   * Scan parentDir for Fz_* SVN working copies, auto-resolve repo URLs via
   * `svn info`, read branches directories for version lists, then overwrite
   * config.projects and persist.
   *
   * @param {string} parentDir - Absolute path to the workspace parent directory
   * @returns {Promise<{
   *   success: boolean,
   *   count: number,
   *   projects: object[],
   *   errors: {folder: string, error: string}[],
   *   saveError?: string
   * }>}
   */
  async scanAndImportWorkspace(parentDir) {
    if (!parentDir || typeof parentDir !== 'string' || parentDir.trim() === '') {
      return { success: false, count: 0, projects: [], errors: [], saveError: 'parentDir is empty or invalid' };
    }

    // 2.1 Discover Fz_* directories that contain a .svn folder
    let entries;
    try {
      entries = fs.readdirSync(parentDir, { withFileTypes: true });
    } catch (err) {
      return { success: false, count: 0, projects: [], errors: [], saveError: `Cannot read directory: ${err.message}` };
    }

    const candidates = entries.filter(e => {
      if (!e.isDirectory()) return false;
      if (!e.name.startsWith('Fz')) return false;
      const svnDir = path.join(parentDir, e.name, '.svn');
      return fs.existsSync(svnDir);
    });

    // 2.2 / 3.1 Resolve repo URL + branches in parallel
    const SvnBridge = getSvnBridge();
    const results = await Promise.allSettled(
      candidates.map(async (entry) => {
        const wcRoot = path.join(parentDir, entry.name);

        // svn info for repo URL
        const infoResult = await SvnBridge.info(wcRoot);
        if (!infoResult.success || !infoResult.info) {
          throw new Error(infoResult.error?.message || infoResult.error?.raw || 'svn info failed');
        }

        const repoUrl = infoResult.info.repositoryRoot || infoResult.info.url;
        const versions = readProjectVersions(wcRoot);
        const config = this.load();
        const pathTemplates = config.defaultPathTemplates || { ...DEFAULT_PATH_TEMPLATES };

        return {
          name: entry.name,
          workingCopyRoot: wcRoot,
          repoUrl,
          versions,
          pathTemplates
        };
      })
    );

    const projects = [];
    const errors = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        projects.push(result.value);
      } else {
        errors.push({
          folder: candidates[i].name,
          error: result.reason?.message || String(result.reason)
        });
      }
    });

    // 4.1 Overwrite config.projects and save
    const config = this.load();
    config.projects = projects;
    const saveResult = this.save(config);

    return {
      success: saveResult.success,
      count: projects.length,
      projects,
      errors,
      saveError: saveResult.success ? undefined : saveResult.error
    };
  }
};

module.exports = ConfigManager;
