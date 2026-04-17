## 1. 後端 (Main Process)

- [x] [P] 1.1 在 `src/main/svn-bridge.js` 中新增 `revert` 方法，用於對指定路徑執行 SVN revert 指令。
- [x] [P] 1.2 在 `src/main/main.js` 中加入 `svn:revert` 的 IPC 綁定，並在 `src/preload/preload.js` 中透過 contextBridge 暴露給前端。

## 2. 前端 (Renderer Process)

- [x] 2.1 更新 `src/renderer/js/commit-manager.js` 以滿足「Revert single file change」。在檔案列表列中加入還原按鈕，處理點擊事件並跳出確認視窗，呼叫還原 API 並重新整理列表。
- [x] 2.2 更新 `src/renderer/js/commit-manager.js` 以滿足「Revert multiple selected files」。加入批次還原按鈕，處理選取檔案的還原邏輯並跳出確認視窗，呼叫還原 API 並重新整理列表。
- [x] 2.3 優化還原確認 UI，將原生 `confirm()` 替換為專案共用的 `Modal` 元件，並支援自定義按鈕樣式與多行文字顯示。
- [x] 2.4 實作強健的路徑縮減與轉換工具 `_getRelativePath`，統一全介面顯示為相對路徑，並解決 Windows 路徑斜線方向不一致的問題。
- [x] 2.5 優化 Toast 通知內容，統一改為「XX作業已完成」語法，並配合顯示相對路徑。

## 3. 外部組件優化與除錯 (Renderer Process)

- [x] 3.1 擴充 `src/renderer/js/toast.js`，新增 `removeByTitle` 方法以支援手動清除特定通知。
- [x] 3.2 修正 `src/renderer/js/commit-manager.js` 中呼叫過時的 `Toast.remove` 導致的 `TypeError`。