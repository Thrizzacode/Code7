## Why

`MergeExecutor` 在執行合併前只檢查未提交的變更，未驗證目標 Working Copy 是否與伺服器版本同步。若本地版本落後 HEAD，merge 可能成功但後續 commit 會失敗，導致使用者必須手動處理中斷的作業流程。

## What Changes

- `MergeExecutor.startMerge()`：在執行 `svn merge` 之前新增 update 檢查，比對本地 revision 與 HEAD revision，若落後則透過 Modal 讓使用者確認是否繼續
- `MergeExecutor._executeCommit()`：在執行 `svn commit` 之前新增 proactive update 檢查（與 `CommitManager.executeCommit()` 一致的邏輯），而非僅依賴 commit 失敗後的 regex 錯誤比對

## Non-Goals

- 不實作自動執行 `svn update`（本工具設計上不修改使用者工作區，update 由使用者在外部執行）
- 不處理合併完成到使用者點擊 Commit 之間的時間差風險（低頻情境，暫不在此 change 範圍內）
- update check 失敗（如網路中斷）不阻擋操作，維持 non-blocking 行為

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `merge-executor`：新增 merge 前與 commit 前的 WC update 狀態驗證需求

## Impact

- Affected specs: merge-executor
- Affected code:
  - Modified: svn-merge-helper/src/renderer/js/merge-executor.js

