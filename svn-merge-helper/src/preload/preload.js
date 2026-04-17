const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('svnApi', {
  // SVN Bridge
  checkAvailability: () => ipcRenderer.invoke('svn:check-availability'),
  log: (svnPath, options) => ipcRenderer.invoke('svn:log', svnPath, options),
  info: (svnPath) => ipcRenderer.invoke('svn:info', svnPath),
  status: (svnPath) => ipcRenderer.invoke('svn:status', svnPath),
  merge: (sourceUrl, targetWcPath, revisions) => ipcRenderer.invoke('svn:merge', sourceUrl, targetWcPath, revisions),
  commit: (wcPath, message, filesArray) => ipcRenderer.invoke('svn:commit', wcPath, message, filesArray),
  resolve: (filePath) => ipcRenderer.invoke('svn:resolve', filePath),
  revert: (targetPath) => ipcRenderer.invoke('svn:revert', targetPath),
  getMergeInfo: (sourceUrl, targetWcPath) => ipcRenderer.invoke('svn:mergeinfo', sourceUrl, targetWcPath),
  update: (wcPath) => ipcRenderer.invoke('svn:update', wcPath),
  ensureLocalPath: (wcPath) => ipcRenderer.invoke('svn:ensure-local-path', wcPath),
  updateBatch: (paths) => ipcRenderer.invoke('svn:update-batch', paths),
  onUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('svn:update-progress');
    ipcRenderer.on('svn:update-progress', (_event, data) => callback(data));
  },

  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  getDefaultMergeTool: () => ipcRenderer.invoke('config:get-default-merge-tool'),
  validatePath: (dirPath) => ipcRenderer.invoke('config:validate-path', dirPath),
  importWorkspace: (parentDir) => ipcRenderer.invoke('config:import-workspace', parentDir),
  getEnvVersions: (wcRoot, templates, env) => ipcRenderer.invoke('config:get-env-versions', wcRoot, templates, env),

  // Dialog
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),

  // External Tools
  launchMergeTool: (filePath) => ipcRenderer.invoke('tool:launch-merge-tool', filePath),
  openDiff: (filePath, options = {}) => ipcRenderer.invoke('tool:open-diff', filePath, options),
  openFile: (filePath) => ipcRenderer.invoke('tool:open-file', filePath),

  // IIS Version Switcher
  iisListVersions: (settingFilesRoot) => ipcRenderer.invoke('iis:list-versions', settingFilesRoot),
  iisPickSettingFilesDir: () => ipcRenderer.invoke('iis:pick-setting-files-dir'),
  iisSwitchVersion: (settingFilesRoot, version) => ipcRenderer.invoke('iis:switch-version', settingFilesRoot, version),
  iisGetCurrentVersion: () => ipcRenderer.invoke('iis:get-current-version'),

  // App Update
  checkForUpdates: () => ipcRenderer.invoke('update:check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onAppUpdateStatus: (callback) => {
    ipcRenderer.removeAllListeners('update:status');
    ipcRenderer.on('update:status', (_event, data) => callback(data));
  },
  onAppUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('update:progress');
    ipcRenderer.on('update:progress', (_event, data) => callback(data));
  },
  getVersion: () => ipcRenderer.invoke('update:get-version')
});
