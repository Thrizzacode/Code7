---
id: svn-log-history
---
# svn-log-history

<!-- [ADDED] -->

## Purpose

本規範定義了 SVN 歷史紀錄查看 (Show Log) 的交互行為與系統要求。

## Requirements

### Requirement: Log View Modal

系統應提供一個獨立的彈窗介面，用於顯示特定檔案或路徑的 SVN 歷史紀錄。

#### Scenario: View Project Root Logs
- **WHEN** 使用者從專案主選單或 Commit 頁面點擊「顯示 Log (Show Log)」
- **THEN** 系統應調用 `svn:log` API 獲取專案根路徑的最近 100 筆紀錄
- **AND** 系統應顯示包含 Revision、Author、Date 與 Message 的列表。

#### Scenario: View Single File Logs
- **WHEN** 使用者在 Commit 檔案列表點擊單一檔案旁的 `🔍 (Show Log)` 按鈕
- **THEN** 系統應僅抓取並顯示該特定檔案的歷史紀錄。

### Requirement: Search and Filtering

Log 查看介面應提供本地過濾能力。

#### Scenario: Filter by keywords
- **WHEN** 使用者在搜尋框輸入作者名稱、版本號或訊息關鍵字
- **THEN** 系統應即時過濾目前已載入的 Log 列表，僅顯示符合條件的項目。

### Requirement: Detailed Revision Info (Lazy Loading)

為了效能考量，系統應按需載入受影響路徑。

#### Scenario: Click Log Entry to Show Details
- **WHEN** 使用者在列表中點擊一筆 LogEntry
- **THEN** 系統應發送包含 `-v` 參數的請求獲取該版本的詳細資訊
- **AND** 系統應在 Modal 的詳細資訊區域顯示完整的提交訊息 (Commit Message) 與受影響的路徑清單。

### Requirement: Review Changes (Log Diff)

系統應允許使用者快速對比版本間的代碼差異。

#### Scenario: Double Click Path to Diff
- **WHEN** 使用者在「異動路徑」清單中雙擊一個項目
- **THEN** 系統應拼接該檔案的完整儲存庫 URL
- **AND** 系統應啟動外部 Diff 工具，對比該版本 (REV) 與前一版本 (REV-1) 的差異。

### Requirement: Layout and Interaction

#### Scenario: Balanced Vertical Layout
- **WHEN** 開啟 Log Modal
- **THEN** 系統應以 1:1 的比例上下分配列表區與詳細資訊區，確保資訊可視度。
- **AND** 當滑鼠懸停在異動路徑上時，游標應顯示為 `pointer`，且雙擊時不應觸發文字選取藍底。

<!-- @trace
source: add-svn-log-view
updated: 2026-04-17
files:
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/styles/main.css
-->
