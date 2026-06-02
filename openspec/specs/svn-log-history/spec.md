---
id: svn-log-history
---
# svn-log-history

<!-- [ADDED] -->

## Purpose

本規範定義了 SVN 歷史紀錄查看 (Show Log) 的交互行為與系統要求。

## Requirements

### Requirement: Log View Modal

The system SHALL provide a standalone modal interface for displaying SVN log history for a specific file or path.

#### Scenario: View Project Root Logs
- **WHEN** the user clicks "專案歷史" from the Commit page AND a commit version (wcPath) has been selected
- **THEN** the system SHALL call the `svn:log` API to fetch the latest 100 entries for the project root path
- **AND** the system SHALL display a list with Revision, Author, Date, and Message

#### Scenario: View Project Root Logs - Version Not Selected
- **WHEN** the user clicks "專案歷史" from the Commit page AND no commit version (wcPath) has been selected
- **THEN** the system SHALL display a Toast warning with title "尚未選擇版本", message "請先在上方選擇版本後再查看專案歷史"
- **AND** the log modal SHALL NOT open

#### Scenario: View Single File Logs
- **WHEN** the user clicks the `🔍 (Show Log)` button next to a single file in the Commit file list
- **THEN** the system SHALL fetch and display only the history for that specific file

##### Example: version selection guard
| State | User Action | Expected Behavior |
|-------|-------------|-------------------|
| wcPath = "" (not selected) | Click "專案歷史" | Toast warning shown, modal stays closed |
| wcPath = "D:\repo\branches\feature" | Click "專案歷史" | Log modal opens with project root logs |


<!-- @trace
source: project-history-version-prompt
updated: 2026-06-02
code:
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/confluence.html
  - svn-merge-helper/src/renderer/index.html
-->

---
### Requirement: Search and Filtering

The log view interface SHALL provide local filtering with regular expression support.

#### Scenario: Filter by keywords (plain text)
- **WHEN** the user types an author name, revision number, or message keyword in the search box
- **THEN** the system SHALL immediately filter the currently loaded log list and display only matching entries

#### Scenario: Filter by regular expression
- **WHEN** the user types a valid regular expression in the search box
- **THEN** the system SHALL apply the regex (case-insensitive) against the revision number, author, and message fields
- **AND** only matching entries SHALL be displayed

##### Example: regex patterns
| Input | Expected Behavior |
|-------|------------------|
| `^123` | Shows entries where revision starts with "123" |
| `john\|jane` | Shows entries authored by john or jane |
| `fix.*bug` | Shows entries whose message contains "fix" followed by "bug" |
| `` | Shows all entries (empty input) |

#### Scenario: Invalid regular expression fallback
- **WHEN** the user types an invalid regular expression (e.g., `(unclosed`)
- **THEN** the system SHALL display a Toast error: title "語法異常", message "不合法的正規表達式，已退回純文字搜尋。"
- **AND** the system SHALL fall back to plain text substring matching
- **AND** the Toast SHALL appear only once per invalid input sequence (not on every keystroke)


<!-- @trace
source: regex-search-shared-filter
updated: 2026-06-02
code:
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/revision-picker.js
  - .spectra.yaml
-->

---
### Requirement: Detailed Revision Info (Lazy Loading)

為了效能考量，系統應按需載入受影響路徑。

#### Scenario: Click Log Entry to Show Details
- **WHEN** 使用者在列表中點擊一筆 LogEntry
- **THEN** 系統應發送包含 `-v` 參數的請求獲取該版本的詳細資訊
- **AND** 系統應在 Modal 的詳細資訊區域顯示完整的提交訊息 (Commit Message) 與受影響的路徑清單。

---
### Requirement: Review Changes (Log Diff)

系統應允許使用者快速對比版本間的代碼差異。

#### Scenario: Double Click Path to Diff
- **WHEN** 使用者在「異動路徑」清單中雙擊一個項目
- **THEN** 系統應拼接該檔案的完整儲存庫 URL
- **AND** 系統應啟動外部 Diff 工具，對比該版本 (REV) 與前一版本 (REV-1) 的差異。

---
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