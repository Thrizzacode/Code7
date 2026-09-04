## 1. SVN bridge：dry-run 預覽與遞迴 revert

- [x] 1.1 在 svn-bridge.js 實作 `mergePreview(sourceUrl, targetWcPath, revisions)`，滿足 **Dry-run merge preview**：組出 `merge -c <rev> ... --dry-run <sourceUrl> <targetWcPath>`，解析 stdout 行首狀態碼為 `{ updated, added, deleted, conflicted, raw }`，失敗回傳 `{ success:false, error }` 不 throw。驗證：對已知會產生新增/更新/衝突的 revision 手動呼叫，回傳分類與 `svn merge --dry-run` 手動輸出逐行一致，且執行後 `svn status` 為空。
- [x] 1.2 依「rollback 以 svn revert -R 加未追蹤殘留檔清除」，讓 svn-bridge.js 的 `revert` 接受 `{ recursive }` 選項（或新增 `revertRecursive(wcPath)`），滿足 **Recursive working-copy revert**：`recursive:true` 執行 `svn revert -R`，未帶選項時維持 `svn revert <path>` 舊行為。驗證：對含衝突與新增檔的 working copy 呼叫遞迴版，conflicted 標記與 `.mine`/`.r<N>` 檔消失；不帶選項時參數與舊版相同（既有 standalone-commit revert 流程手動回歸）。
- [x] 1.3 依「rollback 以 svn revert -R 加未追蹤殘留檔清除」，新增 rollback 輔助函式：遞迴 revert 後跑 `svn status`，刪除「狀態為 unversioned 且出現在傳入 added 清單」的檔案，回傳 `{ success, reverted, removed, failedRemovals }`。驗證：建構 added=[a,b]、另有無關 unversioned 檔 notes.txt 的情境，執行後 a、b 從磁碟消失、notes.txt 保留（對應 spec Example）。

## 2. IPC 與 preload 串接

- [x] 2.1 在 main.js 註冊 `svn:merge-preview` handler 轉呼 `mergePreview`，並讓 `svn:revert` handler 接收並傳遞 `{ recursive }` 參數。驗證：從 DevTools console 呼叫 `window.svnApi.mergePreview(...)` 得到 `{ success:true, preview }`；`window.svnApi.revert(path,{recursive:true})` 實際執行 `-R`。
- [x] 2.2 [P] 在 preload.js 暴露 `mergePreview(sourceUrl, targetWcPath, revisions)`，並將 `revert` 簽名改為 `revert(targetPath, options)` 把 `options` 傳入 invoke（不傳時向下相容）。驗證：`window.svnApi` 上兩個方法存在且型別正確，既有呼叫端未傳 options 仍運作。

## 3. showMergePreview 設定

- [x] 3.1 依「新增 showMergePreview 設定」，在 config-manager.js 的預設設定加入 `showMergePreview: true`，確保舊 config.json 缺此鍵時回退為 true。驗證：刪除 config.json 後啟動，讀取設定得到 `showMergePreview === true`。
- [x] 3.2 [P] 依「新增 showMergePreview 設定」，在 settings.js 與 index.html 的合併相關區塊加入「合併前顯示預覽」checkbox，變更即寫回 config.json。驗證：切換後重啟 App，checkbox 狀態保留；關閉時 merge-executor 讀到 false。

## 4. 單段合併：預覽關卡

- [x] 4.1 依「以 svn merge --dry-run 產生合併預覽」與「預覽對話框作為 _startSingleMerge 的前置關卡」，在 merge-executor.js 新增 `previewAndConfirm(paths, revisions)`：讀 `showMergePreview`，為 false 時直接回傳可繼續；為 true 時呼叫 `mergePreview`，用 Modal 顯示「N 更新 / N 新增 / N 刪除 / N 預期衝突」摘要加可捲動清單，按鈕「確認執行合併」/「取消」。回傳是否繼續，並攜帶 preview 結果。驗證：對應 spec 場景「Preview dialog shown and confirmed」「Preview dialog cancelled」——確認後進入 runMerge，取消後 `svn status` 為空。
- [x] 4.2 依「預覽對話框作為 _startSingleMerge 的前置關卡」，處理 dry-run 失敗分支：`mergePreview` 回傳失敗時 Modal 顯示錯誤與「略過預覽直接合併 / 取消」兩個選項。驗證：對應 spec 場景「Dry-run preview command fails」——以錯誤 sourceUrl 觸發，取消時 working copy 不變。
- [x] 4.3 依 **Execute merge with selected revisions**，把 `previewAndConfirm` 接進 `_startSingleMerge`：`preMergeValidate` 之後、`runMerge` 之前呼叫；並讓 `runMerge` 回傳物件帶上 `preview`，供後續 rollback 使用。驗證：完整跑一次「選 revision → 合併 → 預覽 → 確認 → 成功 commit」與「設定關閉時無預覽」兩條路徑。

## 5. 單段合併：放棄並還原

- [x] 5.1 依「衝突對話框與失敗對話框新增「放棄並還原」」與 **Abandon and roll back an uncommitted merge**，在 merge-executor.js 新增 `abandonAndRollback(targetWcPath, previewAdded)`：二次確認 → 呼叫遞迴 revert + 新增檔清除輔助 → 成功 Toast 回報 reverted/removed 數，失敗 Toast error 並提示改用 TortoiseSVN、不宣稱已還原；additions 清除部分失敗時列出未刪檔但仍視 revert 成功。驗證：對應 spec 場景「Recursive revert fails」「Addition cleanup partially fails」。
- [x] 5.2 依 **Abandon and roll back an uncommitted merge**，在 `resolveConflictsInteractive` 未解完的按鈕列加入「放棄合併並還原」，點擊執行 `abandonAndRollback`（傳入 `runMerge` 帶回的 preview.added），完成後 `settle(false)` 讓外層流程正常結束。驗證：對應 spec 場景「Roll back from the conflict dialog」——製造衝突後放棄，`svn status` 為空、無 `.mine`/`.r<N>`、無多餘新增檔。
- [x] 5.3 依 **Abandon and roll back an uncommitted merge**，在 `_showMergeError` 的按鈕列加入「放棄合併並還原」動作。驗證：對應 spec 場景「Roll back after a merge command failure」——以會失敗的 merge 觸發錯誤對話框，執行還原後 working copy 乾淨。

## 6. 鏈式合併整合

- [x] 6.1 依 **Merge preview before each chained stage**，在 chained-merge.js 的 `run()` 迴圈中，每站 `runMerge` 前呼叫 `MergeExecutor.previewAndConfirm(stage.paths, revisions)`；使用者取消預覽時走 `_haltAt(i, ...)`，不修改該站 working copy。驗證：對應 spec 場景「Confirm preview for each stage」「Cancel a stage preview」——stage 2 取消預覽後 stage 1 commit 保留、stg working copy 未動。
- [x] 6.2 依「鏈式合併只還原當前未提交站」與 **Halt at current stage on interruption, preserving completed stages**，讓 `_haltAt` 接受「當前站是否可還原」旗標：僅在 `promptCommit` 回傳 `committed:true` 之前的中止路徑帶入 true；中止對話框在可還原時顯示「還原本站」按鈕，對 `stage.targetWcPath` 執行 `abandonAndRollback`。驗證：對應 spec 場景「Roll back the current uncommitted stage on halt」「No rollback offered for committed stages」。
- [x] 6.3 依 **Halt at current stage on interruption, preserving completed stages**，回歸既有「Cancel commit after stage 1」場景：stage 1 已提交、stage 2 中止時 completed 清單顯示為已保留且不出現任何還原按鈕。驗證：手動跑鏈式合併至 stage 2 conflict 後關閉對話框，確認 qat commit 仍在。

## 7. 驗證與收尾

- [x] 7.1 依 design「Implementation Contract」的驗收方式，逐條手動驗證四個情境（預覽一致性、衝突放棄還原、鏈式當前站還原、設定關閉回歸），記錄結果。驗證：四情境全數符合預期，無殘留檔。
- [x] 7.2 更新 svn-merge-helper/CHANGELOG.md，新增版本條目描述「合併預覽」與「合併失敗/中止自動回退」兩項功能。驗證：CHANGELOG 條目與 proposal 的 What Changes 內容一致。
