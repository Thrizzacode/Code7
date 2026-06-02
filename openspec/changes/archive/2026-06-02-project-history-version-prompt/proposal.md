## Why

點擊「專案歷史」按鈕時，若尚未選擇版本（`wcPath` 為空），系統目前靜默返回（`return`），用戶看不到任何回饋，不清楚是按鈕無效還是發生錯誤。

## What Changes

- 「專案歷史」按鈕點擊時，若 `wcPath` 為空，改為顯示 `Toast.warning()` 提示訊息，告知用戶需先選擇版本
- 靜默 `return` 改為有意義的用戶回饋

## Non-Goals

- 不變更 `LogManager.show()` 本身的行為
- 不新增 IPC channel（純渲染層修改）
- 不改變版本選擇的 UI 或流程

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `svn-log-history`：「專案歷史」按鈕觸發條件新增：未選版本時須顯示 warning toast，而非靜默失敗

## Impact

- Affected specs: `svn-log-history`（修改觸發前置條件要求）
- Affected code:
  - Modified: `svn-merge-helper/src/renderer/js/commit-manager.js`
