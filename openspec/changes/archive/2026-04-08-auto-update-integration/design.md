## Context

Code7 是一個基於 Electron 的桌面工具。目前的更新流程需要開發者手動編譯並上傳到 GitHub Release，再由使用者自行下載安裝。隨著功能增加，需要一套 App 自動檢查、下載並在使用者同意後重啟安裝的機制。

## Goals / Non-Goals

**Goals:**
- 提供一致的使用者介面檢查更新。
- 支援背景自動檢查與下載，減少使用者等待時間。
- 建立自動化發佈流水線 (CI/CD)，一鍵發佈。
- 提供清楚的下載進度與狀態回饋。

**Non-Goals:**
- 目前僅支援 Windows (nsis) 安裝包，不支援多平台 (macOS/Linux) 更新。
- 暫不實行增量更新 (Delta Update)，僅採用全量安裝包。

## Decisions

### 使用 `electron-updater` 作為核心套件
- **理由**：它是目前 Electron 生態系最穩定、與 `electron-builder` 深度整合的解決方案，支援 NSIS 安裝程式的背景下載。

### 採用 GitHub Releases 分發模式
- **理由**：Code7 代碼託管於 GitHub，可利用免費且強大的 Releases 檔案存儲，且 `electron-updater` 原生支援此 Provider。

### 主進程與渲染進程通訊
- **理由**：在 `main.js` 監聽 `autoUpdater` 事件，並透過 IPC 將進度發送至 UI，確保介面能即時反映下載狀態。

### CI/CD 環境優化 (Node.js 24/22)
- **決策**：在 `release.yml` 中設置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` 並使用 Node.js 22 編譯。
- **原因**：規避 GitHub 對 Node.js 20 的棄用警告，確保發佈工作流的現代性與相容性。

## Risks / Trade-offs

- **[Risk] 代碼簽章 (Code Signing)**：目前未配置 Windows 數位簽章，使用者安裝時可能看到 SmartScreen 警告。折衷方案是在 README 指導使用者信任安裝。
- **[Risk] GitHub Token 安全**：`GH_TOKEN` 存儲於 GitHub Secrets 中，僅在 CI 環境調用，確保安全性。
