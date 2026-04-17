# Design: add-revert-to-commit-page

本文檔描述「提交頁面加入還原功能」的詳細設計。

## 技術方案概覽

本功能橫跨後端指令封裝、IPC 通訊，以及前端 UI 的實作。

## 詳細設計

### 1. 後端 (Main Process)

#### SVN Bridge 擴充 (`svn-bridge.js`)
新增 `revert` 方法，調用 `svn revert` 指令。
- **輸入**: 單一字串或路徑陣列。
- **邏輯**: 使用 `execSvn` 執行指令，超時時間設為 60 秒。

#### IPC 處理 (`main.js`)
在主進程註冊 `iis:revert` (或是 `svn:revert`) 處理程序，負責調用橋接器方法並返回結果。

### 2. 前端 (Renderer Process)

#### Commit 管理員 (`commit-manager.js`)
- **UI 整合**: 在檔案清單渲染時 (`renderList`)，為具備 `modified/conflicted/deleted/added/missing` 狀態的檔案加入 `revert-btn`。
- **還原邏輯**: 
  - 點擊後顯示系統自定義的 `Modal.confirm()` 對話框，並使用 `btn-danger` 樣式提醒風險。
  - **路徑優化**: 實作 `_getRelativePath` 助手方法。
    - 統一將路徑轉換為正斜線 `/`。
    - 處理 Windows 系統的大小寫不敏感匹配與多種斜線方向相容性。
    - 全介面（列表、彈窗、通知）改為顯示相對路徑，確保畫面清爽。
  - 調用 `window.svnApi.revert()`。
  - 任務執行期間顯示「還原中...」的 Toast 通知。
- **批次還原**: `executeBatchRevert` 會一次性傳遞選取的路徑陣列給後端，並在成功後清除選取狀態與重新整理列表。

#### 通知系統擴充 (`toast.js`)
為解決長時任務通知無法手動關閉的問題，擴充 `Toast` 物件：
- `removeByTitle(title)`: 遍歷所有通知，根據標題字串比對並觸發動畫與移除動作。

## 邊界情況處理

- **路徑特殊字元**: 使用 `Utils.escapeHtml` 與路徑陣列傳遞，防止指令注入或解析錯誤。
- **非同步爭用**: 執行還原時會禁用 (Disable) 按鈕，防止使用者連點。
