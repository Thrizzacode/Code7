const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('svnApi', {
  // SVN Bridge
  checkAvailability: () => ipcRenderer.invoke('svn:check-availability'),
  log: (svnPath, options) => ipcRenderer.invoke('svn:log', svnPath, options),
  info: (svnPath) => ipcRenderer.invoke('svn:info', svnPath),
  status: (svnPath) => ipcRenderer.invoke('svn:status', svnPath),
  merge: (sourceUrl, targetWcPath, revisions) => ipcRenderer.invoke('svn:merge', sourceUrl, targetWcPath, revisions),
  commit: (wcPath, message) => ipcRenderer.invoke('svn:commit', wcPath, message),
  resolve: (filePath) => ipcRenderer.invoke('svn:resolve', filePath),
  getMergeInfo: (sourceUrl, targetWcPath) => ipcRenderer.invoke('svn:mergeinfo', sourceUrl, targetWcPath),
  update: (wcPath) => ipcRenderer.invoke('svn:update', wcPath),
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
  }
});
