## 1. 實作版本未選取的防護與提示

- [x] 1.1 在 `svn-merge-helper/src/renderer/js/commit-manager.js` 的「專案歷史」按鈕 click handler（`_bindEvents` 內 `btn-show-project-log` 事件）中，將原本靜默 `return` 改為呼叫 `Toast.warning('尚未選擇版本', '請先在上方選擇版本後再查看專案歷史')`，並在 Toast 顯示後 `return`，使 Log View Modal 不開啟。**驗證**：手動啟動 App，在 Commit 頁面未選版本時點擊「專案歷史」，應看到 warning toast 且 modal 不彈出；選擇版本後再點擊，modal 正常開啟（對應 spec：Log View Modal — Version Not Selected、View Project Root Logs）。
