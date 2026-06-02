## 1. merge 前的 update 檢查（Pre-merge working copy validation）

- [x] 1.1 實作「Pre-merge working copy validation」的 update 狀態檢查（merge 前的 update 檢查插入位置）：在 `MergeExecutor.startMerge()`（`svn-merge-helper/src/renderer/js/merge-executor.js`）的 Step 1 uncommitted changes 檢查之後、Step 2 merge 執行之前，同時呼叫 `svnApi.info(targetWcPath)` 與 `svnApi.info(targetWcPath, { revision: 'HEAD' })`；若 `localRev < headRev` 則透過 `Modal.confirm()` 顯示本地 revision 與 HEAD revision 的差距（標題「工作目錄版本落後」），按鈕為「仍要繼續合併」（`btn-danger`）；若使用者取消則 `return` 中止流程；check 失敗（任一 `info` 呼叫拋出例外）靜默跳過，不阻擋合併。驗收：在落後 HEAD 的 WC 上點擊「合併」，確認出現 update 警告 Modal；在最新 WC 上點擊「合併」，確認無 Modal 直接進行合併。

## 2. commit 前的 update 檢查（Post-merge commit）

- [x] 2.1 實作「Post-merge commit」的 proactive update 狀態檢查（commit 前的 update 檢查策略）：在 `MergeExecutor._executeCommit()`（`svn-merge-helper/src/renderer/js/merge-executor.js`）呼叫 `svnApi.commit()` 之前，以 `Promise.all` 同時取得本地與 HEAD revision 並比對；若落後則透過 `Modal.confirm()` 顯示（複用 Modal.confirm() 顯示 UX 模式，與 `CommitManager.executeCommit()` 一致），按鈕文字為「仍要提交」（`btn-danger`）；若使用者取消則 `return` 中止 commit 但保留 WC 中的 merge 結果；保留現有的 commit 失敗 regex 比對（`/out of date|needs to be updated/i`）作為最後防線；check 失敗時靜默跳過。驗收：完成 merge 後在落後 HEAD 的 WC 點擊「提交 (Commit)」，確認出現 update 警告 Modal；最新 WC 點擊提交不出現 Modal。

