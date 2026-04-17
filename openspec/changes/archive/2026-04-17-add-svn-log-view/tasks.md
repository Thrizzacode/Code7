## 1. 後端與通訊層 (Main Process)

- [x] 1.1 更新 `src/main/svn-bridge.js` 中的 `log` 方法，使其支援解析傳遞的 `options`（如 `-r` 與 `-v`）。
- [x] 1.2 增強 `parseLogXml` 以支援解析 `<paths>` 節點，確保 verbose 模式下的路徑能被結構化處理。
- [x] 1.3 確保 `src/main/main.js` 的 `svn:log` IPC 處理器能正確傳遞參數。

## 2. 前端 Log 元件開發 (Renderer Process)

- [x] 2.1 建立 `src/renderer/js/log-manager.js` 並實作 `LogManager` 類。 <!-- @req Log View Modal -->
- [x] 2.2 實作 Log 列表渲染邏輯，支援分頁載入。 <!-- @req Log View Modal -->
- [x] 2.3 實作本地搜尋過濾功能。 <!-- @req Search and Filtering -->
- [x] 2.4 實作點擊列表後的詳細資訊載入邏輯 (Lazy Loading)。 <!-- @req Detailed Revision Info (Lazy Loading) -->
- [x] 2.5 在 `src/renderer/styles/main.css` 中加入專屬佈局佈樣式。 <!-- @req Layout and Interaction -->

## 3. UI 整合與測試 (UI Integration)

- [x] 3.1 在 `src/renderer/js/commit-manager.js` 的檔案清單中加入 `📜 (Show Log)` 按鈕。
- [x] 3.2 在 Commit 頁面介面右上方加入「查看專案歷史 (Project Log)」按鈕。
- [x] 3.3 測試單檔 Log 與全專案 Log 的開啟功能是否運作正常。
- [x] 3.4 驗證路徑顯示格式與 Modal 的主題配色是否一致。

## 4. 日誌功能擴充與優化 (Feature Expansion & Polish)

- [x] 4.1 擴充 `src/main/main.js` 的 `tool:open-diff` 以支援版本與路徑對比。 <!-- @req Review Changes (Log Diff) -->
- [x] 4.2 實作雙擊異動路徑項目觸發外部差異檢視工具。 <!-- @req Review Changes (Log Diff) -->
- [x] 4.3 優化日誌視窗為 1:1 上下堆疊佈局。 <!-- @req Layout and Interaction -->
- [x] 4.4 實作橫向按鈕排列、右側間距及游標互動效果。 <!-- @req Layout and Interaction -->
