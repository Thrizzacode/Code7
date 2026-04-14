## Context

目前應用程式的 UI 主要是針對開發流程中的合併（從 branches → qat → stg）進行設計的，提交（commit）作為合併最後的一個附加動作。但是開發者常常需要直接在當前工作區分階段地管理與提交自己新增或修改的程式碼。現有的全域操作並沒有涵蓋獨立提交的情境，且底層 SVN 指令尚未支援精細的選取檔案（包含對於未追蹤檔案的處理）。因此需要打造一個獨立的 Commit 面板，並具備勾選提交機制。

## Goals / Non-Goals

**Goals:**

- 建立一個獨立的 Commit 頁面，UI 概念借鏡 TortoiseSVN。
- 在頁面中能夠調用並顯示 `svn status` 結果（包含被修改、刪除與新增加的 Unversioned 狀態）。
- 前端能支援使用者的過濾操作（例如切換是否顯示 Unversioned 的檔案）。
- 底層 SVN 更新：對 `commit` 指令增加支援傳遞特定檔案清單的能力；針對 Unversioned 的目標檔案自動先發送 `svn add` 以確保存入庫中。

**Non-Goals:**

- 此變更不涉及合併 (merge) 系列的功能。
- 不實作差異檢視 (Diffing) 或行級距 (Line-by-line) 的程式碼檢閱機制，只限制於選擇欲提交之檔案。

## Decisions

- **UI 雙頁面切換機制**：將主畫面 `<div id="main-screen">` 中原本的內容用 `<div id="merge-view">` 及 `<div id="commit-view">` 進行包裝，透過設定樣式 `display` 來達到頁面切換。這比使用前端 Routing 框架更簡單輕量。
- **後端狀態解析 (SVN Bridge)**：由於需要支援 `svn commit fileA fileB`，在呼叫底層時，要確保路徑能處理空白與特殊字元（使用陣列傳給 execFile）。此外針對 Unversioned 檔案，需要分兩階段：先擷取名單並執行 `svn add`，隨後再執行 `svn commit` 目標名單。
- **資料儲存**：針對檔案清單的呈現，會在前端引入類似 `CommitManager` 的控制模組負責抓取資料並渲染，不改動既有的 `merge-executor.js` 來避免邏輯交叉污染。

## Risks / Trade-offs

- 大量未追蹤檔案：若工作區有大量的建置產物或 npm packages 且尚未被 `svn:ignore` 例外化，可能會使 `svn status` 取回的資料過多而拖慢 UI。 → 僅在開啟 Commit 畫面時拉取狀態，並考慮在前端以「隱藏忽略項目」處理，依賴使用者既有的 `.svnignore` 設置作為主要防線。
