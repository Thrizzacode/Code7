## Context

Code7 是一個基於 Electron 的桌面工具，目前的版本更新流程完全依賴於開發者手動編譯並上傳至 GitHub Release，再由使用者自行前往下載覆蓋安裝。隨著功能迭代加快，需要一套機制讓 App 能自動偵測新版本、背景下載並在使用者同意後重啟安裝。

## Goals / Non-Goals

**Goals:**
- 提供一鍵式介面讓使用者手動檢查更新。
- 支援背景自動檢查與下載，減少使用者等待時間。
- 建立自動化發佈流水線 (CI/CD)，降低維護成本。
- 提供清晰的下載進度顯示與成功提示。

**Non-Goals:**
- 無需支援多平台 (macOS/Linux)，目前僅針對 Windows (nsis) 設計。
- 不使用自建更新伺服器。

## Decisions

### 使用 `electron-updater` 作為核心套件
- **理由**：它是目前 Electron 生態中最成熟的方案，與 `electron-builder` 完美搭配，支援 NSIS 安裝程式的背景靜默下載與差異比對。
- **替代方案**：Electron 內建的 `autoUpdater` (Squirrel.Windows)，但需要複雜的 Nuts/Hazel 伺服器支援，配置難度較高。

### 採用 GitHub Releases 分發模式
- **理由**：Code7 本身託管於 GitHub，直接利用其 Releases 功能可節省伺服器成本，且 `electron-updater` 預設支持此 provider。
- **配置**：在 `package.json` 中配置 `publish: { provider: "github", owner: "...", repo: "..." }`。

### 主進程封裝通訊邏輯
- **理由**：由 `main.js` 統一監聽 `autoUpdater` 的 `checking-for-update`、`update-available`、`download-progress` 等事件。
- **通訊方式**：透過 IPC 向渲染進程發送非同步通知，讓 UI 能即時反應狀態變化。

### 設定介面 UI 設計
- **理由**：仿照 Spectra 介面風格，在設定面板底端新增獨立的 `settings-section`。
- **組建**：版號顯示標籤、檢查更新按鈕 (Progress Spinner)、更新紀錄連結。

### 使用 GitHub Actions 實作 CI/CD
- **理由**：自動化編譯可確保環境一致性，避免開發者本地環境造成的 Build 差異。
- **觸發規則**：當推送包含 `v*` 格式的 Tag 時自動啟動。

## Risks / Trade-offs

- **[Risk] 代碼簽章 (Code Signing)** → **[Mitigation]**：目前若無購買 Windows 證書，使用者下載更新時可能會看到 SmartScreen 警告。暫時以說明引導使用者點擊「仍要執行」或後續協助申請證書。
- **[Risk] GitHub Token 安全性** → **[Mitigation]**：打包用的 `GH_TOKEN` 必須存放在 GitHub Secrets 中，不可寫死於代碼或 CI 設定檔中。
- **[Risk] 下載路徑衝突** → **[Mitigation]**：`electron-updater` 會使用使用者電腦的快取目錄，需確保 App 名稱在 `package.json` 中唯一，避免被系統清理工具有誤判。
