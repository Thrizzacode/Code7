## 1. 環境配置與依賴安裝 (使用 `electron-updater` 作為核心套件)

- [x] 1.1 執行 `npm install electron-updater` 安裝自動更新套件。
- [x] 1.2 修改 `package.json`，在 `build` 欄位中加入 `publish: { provider: "github", owner: "Thrizzacode", repo: "Code7" }`。 (採用 GitHub Releases 分發模式)

## 2. 主進程更新邏輯實作 (Automated Update Check) (主進程封裝通訊邏輯)

- [x] 2.1 在 `src/main/main.js` 中引入並配置 `electron-updater`。
- [x] 2.2 實作 `UpdateManager` 監聽 `autoUpdater` 事件：`checking-for-update`、`update-available`、`update-not-available`、`error`、`download-progress` 及 `update-downloaded`。
- [x] 2.3 實作 APP 啟動時的背景自動檢查邏輯。(Automated Update Check)
- [x] 2.4 實作 `ipcMain.handle("update:check-for-updates")` 用於手動觸發檢查。(Manual Update Check)

## 3. 渲染進程與介面整合 (Manual Update Check) (設定介面 UI 設計)

- [x] 3.1 在 `src/renderer/index.html` 的設定面板底部新增包含目前版號、檢查更新按鈕與進度顯示的 UI 區塊。
- [x] 3.2 在 `src/renderer/js/settings.js` 實作手動更新檢查邏輯。(Manual Update Check)
- [x] 3.3 在 `src/renderer/js/settings.js` 實作進度條更新的 DOM 操作邏輯。(Background Downloading and Progress)

## 4. 重啟與安裝實作 (Post-Download Installation)

- [x] 4.1 在 `src/main/main.js` 實作 `ipcMain.handle("update:quit-and-install")` 用於呼叫 `autoUpdater.quitAndInstall()`。(Post-Download Installation)
- [x] 4.2 確保下載完畢後，UI 會從「檢查更新」切換為「立即重啟並安裝」按鈕。

## 5. 自動化發佈流程配置 (使用 GitHub Actions 實作 CI/CD)

- [x] 5.1 建立 `.github/workflows/release.yml`，配置基於 Windows 環境的打包與上傳工作流。
- [x] 5.2 在 README 中補充說明如何設置 `GH_TOKEN` 與發佈新版本 (Tag) 的流程。


