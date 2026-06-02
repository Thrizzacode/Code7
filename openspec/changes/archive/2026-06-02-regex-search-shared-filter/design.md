## Context

`log-manager.js` 的歷史 dialog 搜尋（`filter()`）僅使用 `.includes()` 純文字比對。`revision-picker.js` 的 `_getVisibleRevisions()` 已實作 regex 支援（try-catch + Toast fallback），但兩者是獨立程式碼。本次變更提取共用函式，並讓 log-manager 獲得相同的搜尋能力。

不涉及 Electron 主程序或 IPC channel，純粹是渲染層（renderer）的重構與強化。

## Goals / Non-Goals

**Goals:**

- 在 `utils.js` 新增 `Utils.filterByRegex(entries, filterText, fields)` 共用篩選函式
- `log-manager.js` 改用 `Utils.filterByRegex`，使歷史搜尋支援 regex
- `revision-picker.js` 改用 `Utils.filterByRegex`，移除重複邏輯

**Non-Goals:**

- 不把 RevisionPicker 或 LogManager 重構為共用 UI 元件（兩者 UI 狀態差異太大）
- 不修改搜尋欄位集合（仍為 revision、author、message 三個欄位）
- 不改變 revision-picker 的任何現有行為

## Decisions

### `Utils.filterByRegex` 的函式簽名

**決策**：`Utils.filterByRegex(entries, filterText, fields)` — 接受 entries 陣列、搜尋文字、欄位名稱陣列，回傳篩選後的陣列。

**理由**：fields 陣列讓函式不與具體物件結構耦合，未來若有第三個模組需要搜尋不同欄位也能重用。相較於硬編碼欄位，彈性代價極低（一個額外參數）。

**替代方案**：硬編碼 revision/author/message — 被否決，因為綁定了特定資料結構，複用性差。

### regex 失效時的 fallback 行為

**決策**：沿用 revision-picker 的現有模式：regex 無效時退回純文字 `.includes()` 搜尋，並透過 `Toast.error()` 通知使用者一次（去重複防止連續觸發）。

**理由**：行為與現有 revision-picker 完全一致，使用者體驗無縫。

## Implementation Contract

### `Utils.filterByRegex(entries, filterText, fields)`

- **所在檔案**：`svn-merge-helper/src/renderer/js/utils.js`，新增為 `Utils` 物件的方法
- **輸入**：
  - `entries`：物件陣列（每個 entry 包含若干欄位）
  - `filterText`：使用者輸入的搜尋文字（string）
  - `fields`：要搜尋的欄位名稱陣列（string[]）
- **回傳**：符合條件的 entries 子陣列
- **行為**：
  1. `filterText` 為空字串或 falsy → 回傳原 entries 陣列（不篩選）
  2. 嘗試 `new RegExp(filterText, 'i')`
  3. 成功 → 用 `regex.test(String(entry[field]))` 對 fields 做 OR 比對
  4. 失敗（catch） → 退回純文字 `.toLowerCase().includes(filterText.toLowerCase())`，呼叫 `Toast.error('語法異常', '不合法的正規表達式，已退回純文字搜尋。')` 一次（用 `_invalidRegexToastShown` flag 去重）

**注意**：Toast 的去重 flag 需存放在 `Utils.filterByRegex` 的 module-level 變數，而非掛在各呼叫端。

### `log-manager.js` 的 `filter()` 改動

- `filter(keyword)` 改為：`this._filteredEntries = Utils.filterByRegex(this._logEntries, keyword, ['revision', 'author', 'message'])`
- 空字串時 `Utils.filterByRegex` 自動回傳全部，不需特例處理

### `revision-picker.js` 的 `_getVisibleRevisions()` 改動

- 移除 lines 224-250 的 inline regex 邏輯
- 改為：`return Utils.filterByRegex(this._allRevisions, this._filterText, ['revision', 'author', 'message'])`
- 移除 `this._invalidRegexToastShown` property（Toast 去重改由 `Utils.filterByRegex` 管理）

### 驗收條件

1. 在歷史 dialog 的搜尋框輸入 `^123` → 僅顯示版本號以 123 開頭的紀錄
2. 在歷史 dialog 輸入 `(invalid` → 顯示 Toast 錯誤並退回純文字搜尋
3. 在 merge 頁面的 revisions 搜尋框操作 → 行為與修改前完全相同
4. 搜尋框清空 → 顯示全部紀錄

## Risks / Trade-offs

- [Risk] Toast 去重 flag 從 revision-picker 的 instance 層移至 Utils 的 module 層，若同時有兩個搜尋框顯示不合法 regex，只有第一個會觸發 Toast。→ 目前 UI 設計中兩個元件不會同時出現，可接受。
