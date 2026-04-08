## Why

目前使用者更新應用程式需要手動到 GitHub 下載安裝檔並重新執行安裝程序，這不僅步驟繁瑣，也容易導致使用者長期停留在舊版本，無法即時獲得安全性修正與新功能。實作自動更新功能可自動化此流程，提升維護效率與使用者體驗。

## What Changes

- **主進程整合**：引入 `electron-updater` 模組，實作自動/手動檢查更新、下載進度監控及重啟安裝邏輯。
- **UI 介面新增**：在設定面板中新增「App 更新」區塊，顯示當前版號、檢查更新按鈕及下載進度條。
- **IPC 通訊強化**：建立主進程與渲染進程間的更新狀態通訊同步。
- **自動化發佈流程**：新增 `.github/workflows/release.yml`，實現基於 Git Tag 的自動化編譯與 GitHub Release 上傳。
- **CI/CD 環境優化**：
    - **決策**：在 `release.yml` 中設置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` 並升級 `setup-node` 至 `v4` (Node 22)。
    - **原因**：解決 GitHub 對 Node 20 的棄用警告，確保發佈工作流的長期穩定性與相容性。

## Non-Goals (optional)

- 不開發獨立的更新伺服器，完全依賴 GitHub Releases。
- 不實作差異更新 (Delta Update)，僅執行全量安裝包更新。

## Capabilities

### New Capabilities

- `app-update`: 負責處理應用程式版本的生命週期管理，包括檢查、背景下載及安裝。

### Modified Capabilities

(none)

## Impact

- **Affected code**:
    - `package.json` (依賴與 electron-builder 配置)
    - `src/main/main.js` (更新邏輯進入點)
    - `src/renderer/index.html` (更新 UI 結構)
    - `src/renderer/js/settings.js` (更新 UI 邏輯)
- **External Dependencies**:
    - `electron-updater`
- **Infrastructure**:
    - 需配置 GitHub Secrets (`GH_TOKEN`) 以供 Actions 運轉。
    - **GitHub Actions Runner**: 已優化相容性，強制使用 Node.js 24 執行 JS Actions 並採用 Node 22 作為編譯環境，以規避 Node 20 棄用告警。

## Specification

- **Environment**: The CI/CD pipeline must utilize Node.js 22 for build processes and Node.js 24 for executing JavaScript-based GitHub Actions.
- **Configuration**: Set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in the workflow environment variables to ensure compatibility with updated GitHub Actions runners.
