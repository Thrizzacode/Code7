## Why

目前使用者更新應用程式需要手動到 GitHub 下載安裝檔並重新執行安裝程序，這不僅步驟繁瑣，也容易導致使用者長期停留在舊版本，無法即時獲得安全性修正與新功能。實作自動更新功能可自動化此流程，提升維護效率與使用者體驗。

## What Changes

- **主進程整合**：引入 `electron-updater` 模組，實作自動/手動檢查更新、下載進度監控及重啟安裝邏輯。
- **UI 介面新增**：在設定面板中新增「App 更新」區塊，顯示當前版號、檢查更新按鈕及下載進度條。
- **IPC 通訊強化**：建立主進程與渲染進程間的更新狀態通訊同步。
- **自動化發佈流程**：新增 `.github/workflows/release.yml`，實現基於 Git Tag 的自動化編譯與 GitHub Release 上傳。

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
    - 需要配置 GitHub Secrets (`GH_TOKEN`) 以供 Actions 運作。
