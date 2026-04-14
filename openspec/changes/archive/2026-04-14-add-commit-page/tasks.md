## 1. SVN CLI Bridge 擴充

- [x] 1.1 修改 `SvnBridge.status` 方法，使其能正確解析並回傳修改、新增、未追蹤 (Unversioned) 與刪除等狀態。(implements Requirement: SVN Command Execution Wrapper)
- [x] 1.2 修改 `SvnBridge.commit` 簽章，使其能接收並處理 `filesArray` 參數，組裝為對特定檔案清單的提交指令。
- [x] 1.3 於 `SvnBridge.commit` 內部實作對 `filesArray` 中 Unversioned 狀態檔案的自動過濾，並先對這些檔案執行 `svn add` 命令。

## 2. 介面架構切換 (UI Routing)

- [x] 2.1 在 `index.html` 的 Top Bar 左側新增全局「合併 (Merge)」與「提交 (Commit)」的切換導覽按鈕。(implements Requirement: Standalone Commit Interface)
- [x] 2.2 將現有的合併面板包裝於 `<div id="merge-view">` 內，並新增空的 `<div id="commit-view">`。
- [x] 2.3 於 `app.js` 或負責 UI 的控制模組實作點擊切換 View（透過 display: block/none 控制）的邏輯。

## 3. Standalone Commit 頁面實作

- [x] 3.1 在 `<div id="commit-view">` 內建立「當前專案/分支名稱」顯示區塊，以及佔用較多空間的 Commit Message `textarea`。
- [x] 3.2 於 `commit-view` 下半部建立變更清單表格，包含 Checkbox 列、狀態標籤（例如 M/A/D/?）以及檔案路徑。
- [x] 3.3 新增一個「顯示未追蹤檔案 (Show Unversioned files)」的 checkbox 控制元。
- [x] 3.4 建立 `commit-manager.js` 模組，負責載入 `svnApi.status` 的結果並動態渲染至清單表格中。
- [x] 3.5 於 `commit-manager.js` 中實作「顯示/隱藏」未追蹤檔案的過濾邏輯。
- [x] 3.6 實作勾選檔案的收集功能，結合提交訊息一併發送給 `svnApi.commit`，並在提交成功後重整清單。

## 4. UX 優化與架構修復

- [x] 4.1 修復專案切換時因缺少 `commit-path` 元件而引發的 JavaScript 報錯。
- [x] 4.2 修正 CSS 中的重複 `display` 屬性宣告，避免在 Merge 視圖中洩漏出 Commit 介面。
- [x] 4.3 修正整體 Flexbox 捲動邏輯，替容器加上 `min-height: 0` 使內部的變更表格與歷史紀錄正確出現捲軸。
- [x] 4.4 加入導覽列按鈕的 `.active` 狀態與跳轉樣式更動，讓使用者更容易識別目前開啟的視圖。
- [x] 4.5 導入 `localStorage` 機制，在切換視圖後能保留狀態，重新整理不再會迷失在預設頁面。
- [x] 4.6 實作 Commit 表格中點擊整列（Row Click Selection）即可選取/取消選取的貼心操作。
- [x] 4.7 修復因元件與變數作用域變動引發的 `ReferenceError` 與非同步初始化延遲掃描問題。
- [x] 4.8 優化提交清單的 Empty States 條件，若隱藏未追蹤檔案後列數為 0，應顯示「無變更」而非「請先選擇環境與版本」。
