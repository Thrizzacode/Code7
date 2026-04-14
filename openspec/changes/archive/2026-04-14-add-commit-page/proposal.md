## Why

目前系統的 Commit 功能僅為合併後的自動附加操作，無法針對一般狀態下的單獨工作區進行變更提交，且後端原本的 `svn commit` 指令無法指定檔案清單，導致使用者不能過濾不必要的修改（例如只提交幾個特定檔案、不包含其他的更動）。
為支援更細緻的改版作業或緊急修復修訂，我們需要實作一個獨立的 Commit 頁面，具備類似 TortoiseSVN 的勾選介面，讓使用者可以檢查工作區所有的變動（包含新檔案，Unversioned Files），自行選擇後提交。另外，我們也需要確保整體介面的順暢度，並修復雙頁面切換機制所帶來的版面配置、狀態留存與 JS 執行優先級等進階 UX 與資料流問題。

## What Changes

1. **獨立的雙頁面操作機制**：在 Top Bar 加入「Merge」與「Commit」的全域導覽功能，允許使用者切換原有的分支合併首頁，或即將新增的 Commit 面板。
2. **全新 Commit UI**：
   - 頂部顯示當前的專案與分支位置。
   - 提供 Commit Message 輸入框。
   - 下方表格列出 `svn status` 解析後的變更清單，包含檔案狀態與勾選框供多選。
   - 支援顯示或隱藏未追蹤 (Unversioned) 的檔案。
3. **後端 SVN 橋接器強化**：
   - 強化 `svn:status` 以能夠解析與提取未版本控制、已修改、新增、刪除等所有狀態。
   - 修改 `svn:commit` 命令使其接受目標檔案清單。若清單中存在 Unversioned 的檔案，程式需自動對這些檔案補發 `svn add` 命令再進行提交。
4. **UX 優化與架構修復**：
   - 確保雙視圖 (Merge / Commit) 的 Flexbox 佈局捲軸正常運作 (`min-height: 0` 修正)。
   - 解決移除冗餘介面元素後，專案切換時的 JavaScript Null Reference 錯誤。
   - 修復 JavaScript 變數作用域與非同步初始化時機點的競態條件。
   - 儲存導覽列的狀態至 localStorage，確保頁面重整後能保留之前的標籤頁。
   - 將表格整列設置為可點擊以切換選取、完善各項空白狀態（Empty States）的文字顯示過濾邏輯。

## Capabilities

### New Capabilities

- `standalone-commit`: 使用者可於獨立介面上查看與勾選特定的本地端變更檔案，並進行手動提交作業，包含管理未追蹤 (Unversioned) 檔案的新增。

### Modified Capabilities

- `svn-cli-bridge`: 增強對 `svn status` 與 `svn commit` 的支援，使 commit 指令能接收特定檔案陣列，並確保能自動對 Unversioned 的目標檔案進行 `svn add` 處理。

## Impact

- Affected specs: `standalone-commit`, `svn-cli-bridge`
- Affected code: 
  - `src/renderer/index.html`
  - `src/renderer/styles/main.css`
  - `src/renderer/js/app.js`
  - `src/renderer/js/commit-manager.js` (可能的新增功能模組)
  - `src/main/svn-bridge.js`
  - `src/main/main.js`
