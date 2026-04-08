## Why

目前使用者在進行合併作業前，通常需要手動執行外部的 `update-all.bat` 腳本來更新多個 SVN 子專案。這導致工作流程中斷，且缺乏直覺的進度回饋。將主動更新功能整合進 Code7 桌面應用程式，可以提供一站式的開發體驗，並透過 UI 即時顯示更新進度與狀態。

## What Changes

- **UI 增強**：在頂部欄（Top Bar）導覽區增加「同步更新」功能按鈕 (🔄)。
- **單一更新**：提供「更新當前專案」功能，顯示 **Indeterminate 進度條** 提示後台正在執行。
- **批次更新**：支援一鍵更新所有專案。更新清單改為從配置動態抓取，並提供 **實體進度條** 與數值提示（如 `3/11`）。
- **自定義更新範圍**：在設定頁面的專案管理清單中，為每個專案新增「同步」勾選框 (`isBatchEnabled`)，允許使用者決定執行批次更新時要包含或排除哪些目錄。
- **IPC 擴展**：註冊 `svn:update` 與 `svn:update-batch` IPC 管道，支援非同步更新與進度回報。

## Non-Goals (optional)

- 不會自動執行合併後的 commit。
- 不會處理複雜的伺服器端衝突解決邏輯（僅執行 update，若有衝突則提示使用者）。

## Capabilities

### New Capabilities

- `svn-update-integration`: 提供單一與批次更新的 UI 觸發入口與狀態管理。
- `svn-batch-management`: 批次更新的動態過濾機制與設定持久化。

### Modified Capabilities

- `svn-cli-bridge`: 擴例底層 SVN 命令橋接器，新增 `update` 與 `updateBatch` 的執行與解析邏輯。

## Impact

- **Affected code**: 
    - `src/main/svn-bridge.js`: 新增 `update` 封裝。
    - `src/main/main.js`: 註冊 IPC 監聽與批次循回執行。
    - `src/renderer/index.html`: 進度條 CSS 與同步按鈕 HTML。
    - `src/renderer/js/app.js`: `SyncController` 實作視覺進度邏輯。
    - `src/renderer/js/settings.js`: 改進專案列表，支援 `isBatchEnabled` 勾選開關。
- **Dependencies**: 需要本機環境已安裝 `svn` CLI 指令。
