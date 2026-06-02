## Why

`log-manager.js` 的歷史紀錄 dialog 僅支援純文字搜尋，但 `revision-picker.js` 的 revisions 搜尋早已支援正規表達式（regex）。兩者的篩選邏輯高度相似，卻各自實作，造成能力不一致且存在重複程式碼。

## What Changes

- 從 `revision-picker.js` 的 `_getVisibleRevisions()` 提取 regex 篩選邏輯，建立 `Utils.filterByRegex(entries, text, fields)` 共用工具函式
- `log-manager.js` 的 `filter()` 方法改為呼叫 `Utils.filterByRegex`，使歷史 dialog 的搜尋支援正規表達式
- `revision-picker.js` 的 `_getVisibleRevisions()` 也改為呼叫 `Utils.filterByRegex`，移除重複邏輯
- 兩處搜尋行為保持一致：regex 有效時使用 regex 搜尋，無效時退回純文字並顯示 Toast 提示

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `svn-log-history`：歷史紀錄 dialog 的搜尋 input 新增正規表達式支援，行為與 revision-picker 一致

## Impact

- 不需要新增 IPC channel（純渲染層變更）
- Affected specs: `svn-log-history`（搜尋行為的需求變更）
- Affected code:
  - Modified: `svn-merge-helper/src/renderer/js/utils.js`
  - Modified: `svn-merge-helper/src/renderer/js/log-manager.js`
  - Modified: `svn-merge-helper/src/renderer/js/revision-picker.js`
