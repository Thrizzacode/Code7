const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0f0f13",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: true,
    titleBarStyle: "default",
    title: "Code7",
    icon: path.join(__dirname, "..", "..", "assets", "app_icon.png"),
  });

  if (!process.argv.includes("--dev")) {
    mainWindow.setMenu(null);
  }
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  const SvnBridge = require("./svn-bridge");
  const ConfigManager = require("./config-manager");

  // ─── SVN Bridge IPC Handlers ───────────────────────────────────────

  ipcMain.handle("svn:check-availability", async () => {
    return SvnBridge.checkAvailability();
  });

  ipcMain.handle("svn:log", async (_event, svnPath, options) => {
    return SvnBridge.log(svnPath, options);
  });

  ipcMain.handle("svn:info", async (_event, svnPath) => {
    return SvnBridge.info(svnPath);
  });

  ipcMain.handle("svn:status", async (_event, svnPath) => {
    return SvnBridge.status(svnPath);
  });

  ipcMain.handle(
    "svn:merge",
    async (_event, sourceUrl, targetWcPath, revisions) => {
      return SvnBridge.merge(sourceUrl, targetWcPath, revisions);
    },
  );

  ipcMain.handle("svn:commit", async (_event, wcPath, message) => {
    return SvnBridge.commit(wcPath, message);
  });

  ipcMain.handle("svn:resolve", async (_event, filePath) => {
    return SvnBridge.resolve(filePath);
  });

  ipcMain.handle("svn:mergeinfo", async (_event, sourceUrl, targetWcPath) => {
    return SvnBridge.mergeinfo(sourceUrl, targetWcPath);
  });

  ipcMain.handle("svn:update", async (_event, wcPath) => {
    return SvnBridge.update(wcPath);
  });

  ipcMain.handle("svn:update-batch", async (_event, paths) => {
    const results = [];
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      // Send progress to renderer
      mainWindow.webContents.send("svn:update-progress", {
        index: i,
        total: paths.length,
        current: p.name,
      });

      const res = await SvnBridge.update(p.path);
      results.push({ name: p.name, ...res });
    }
    return results;
  });

  // ─── Config IPC Handlers ───────────────────────────────────────────

  ipcMain.handle("config:load", async () => {
    return ConfigManager.load();
  });

  ipcMain.handle("config:save", async (_event, config) => {
    return ConfigManager.save(config);
  });

  ipcMain.handle("config:get-default-merge-tool", async () => {
    return ConfigManager.detectMergeTool();
  });

  ipcMain.handle("config:validate-path", async (_event, dirPath) => {
    return ConfigManager.validatePath(dirPath);
  });

  ipcMain.handle(
    "config:get-env-versions",
    (_event, wcRoot, templates, env) => {
      return ConfigManager.getEnvVersions(wcRoot, templates, env);
    },
  );

  // ─── Dialog IPC Handlers ───────────────────────────────────────────────────

  ipcMain.handle("dialog:open-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "選擇工作目錄 (Workspace Parent Directory)",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("config:import-workspace", async (_event, parentDir) => {
    return ConfigManager.scanAndImportWorkspace(parentDir);
  });

  // ─── External Tool IPC Handlers ────────────────────────────────────────────

  ipcMain.handle("tool:launch-merge-tool", async (_event, filePath) => {
    const config = ConfigManager.load();
    const toolPath = config.mergeToolPath;
    if (!toolPath) {
      return { success: false, error: "Merge tool path not configured" };
    }
    return SvnBridge.launchExternalTool(toolPath, filePath);
  });

  // ─── Update IPC Handlers ───────────────────────────────────────────────────

  ipcMain.handle("update:check-for-updates", () => {
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle("update:quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });
}

/**
 * Configure and register auto-update event listeners.
 */
function setupAutoUpdater() {
  // Disable automatic downloading to allow user-triggered or manual progress control if needed, 
  // but since we want "double-layered", we keep autoDownload enabled by default for convenience.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("update:status", { state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update:status", { 
      state: "available", 
      version: info.version 
    });
  });

  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("update:status", { state: "not-available" });
  });

  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("update:status", { 
      state: "error", 
      message: err.message 
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    mainWindow?.webContents.send("update:progress", {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update:status", { 
      state: "ready", 
      version: info.version 
    });
  });
}

// ─── App Lifecycle ─────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();
  setupAutoUpdater();
  createWindow();

  // Initial background check (Requirement: Automated Update Check)
  if (!process.argv.includes("--dev")) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
