## Why

在開發過程中，開發者經常需要查看特定的檔案或整個專案的歷史變更紀錄，以便理解代碼演進或追蹤問題。目前系統缺乏整合的 SVN Log 查看介面，使用者必須切換至外部工具。在提交頁面直接整合 Log 查看功能，能顯著提升開發工作流的連貫性。

## What Changes

- **通訊層**：擴充 `SvnBridge.log` 與對應的 IPC `svn:log` 接口，支援 `-v (verbose)` 參數與單一 Revision 的詳細內容查詢。
- **UI 元件**：實作一個通用的 Log 查看彈窗 (Log Modal)，佈局仿照 TortoiseSVN，包含列表區、訊息區與異動檔案區。
- **功能邏輯**：
    - **單檔/專案支援**：在檔案列表加入 Log 圖示按鈕，並在視窗頂端加入專案級搜尋按鈕。
    - **搜尋與過濾**：支援針對已載入的 LogEntry 進行本地端的關鍵字篩選。
    - **延遲加載 (Option B)**：點擊列表中的版本號時，才去抓取該版本的詳細訊息與異動路徑，確保存取流暢。
    - **雙擊檢視差異 (Log Diff) [NEW]**：在異動路徑清單中支援雙擊項目，直接調用 TortoiseProc 對比該版本與前一版本的代碼改動。
- **UI/UX 優化**：
    - **佈局比例**：採用 1:1 上下堆疊比例，解決詳細資訊被擠壓的問題。
    - **操作感增強**：加入 cursor-pointer 手勢、停用雙擊時的文字選取效果，並將操作按鈕改為橫向排列。
- **通知優化**：在加載 Log 時提供適當的 UI 反饋（Loading 狀態）。

## Capabilities

### New Capabilities

- `svn-log-history`: 提供查看、搜尋與詳細查閱 SVN 提交紀錄的能力，支援單檔與路徑範圍。

### Modified Capabilities

- `standalone-commit`: 在提交介面整合 Log 查看的入口點。

## Impact

- 前端：`src/renderer/js/commit-manager.js`, `src/renderer/index.html`
- 組件：`src/renderer/js/modal.js` (可能需要優化)
- 後端：`src/main/svn-bridge.js`, `src/main/main.js`
- IPC：`src/preload/preload.js`
