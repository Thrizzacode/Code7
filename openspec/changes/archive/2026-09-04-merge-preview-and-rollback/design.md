## Context

合併作業目前的流程（`merge-executor.js` 的 `_startSingleMerge`）：前置驗證 → `svn merge -c <rev...>` → `svn status` 撈衝突 → 逐檔用 TortoiseMerge 解 → commit。`svn merge` 不帶 `--accept`，衝突走 postpone：檔案被標記 conflicted、產生 `.mine` / `.r<N>` 殘留檔，merge 指令仍回傳成功。

兩個缺口：

1. **沒有事前預覽**：使用者無法在動手前得知會改哪些檔、會不會撞衝突。
2. **中止不還原**：衝突解決對話框按「稍後再說」或關閉（`resolveConflictsInteractive` resolve(false)），流程停止但 working copy 已被部分修改，且 `_showMergeError` 後也一樣。使用者要自行到 TortoiseSVN 手動清。

鏈式合併（`chained-merge.js`）在 `_haltAt` 已明確承諾「已提交的站永不回退」，這個設計必須維持；只針對「當前尚未提交的站」提供還原。

既有可複用資產：`svn-bridge.js` 已有 `revert(targetPath)`（執行 `svn revert <paths>`，非遞迴）、`merge()`；`preload.js` 已暴露 `revert`；`main.js` 已有 `svn:revert` handler。`config-manager.js` 管理 `config.json` 預設值。`Modal` / `Toast` 為既有 UI 機制。

## Goals / Non-Goals

**Goals:**

- 單段合併與鏈式合併每一站，實際 `svn merge` 前先跑 `--dry-run` 並以對話框呈現預期異動摘要，使用者確認後才執行。
- merge 失敗或衝突未解完就中止時，提供單一動作把「未提交的目標 working copy」還原到合併前乾淨狀態（含清除合併產生的未追蹤殘留檔）。
- 鏈式合併中止時，只還原「當前未提交站」，已提交站保持不變。
- 預覽可由 Settings 開關關閉，關閉時行為與現況完全一致。

**Non-Goals:**

- 逐檔挑選還原、還原已 commit 的變更。
- 改動 TortoiseMerge 解衝突流程本身。
- 對 tree conflict 做額外推算（僅原樣呈現 SVN dry-run 輸出）。
- 自動化通知（另案）。

## Decisions

### 以 svn merge --dry-run 產生合併預覽

在 `svn-bridge.js` 新增 `mergePreview(sourceUrl, targetWcPath, revisions)`，參數與 `merge()` 相同，額外加入 `--dry-run`。SVN 在 `--dry-run` 下會輸出與實際合併相同格式的動作行（`U ` / `A ` / `D ` / `C ` / `   C ` 樹狀衝突等），但不寫入 working copy。以行首狀態碼解析為 `{ updated: string[], added: string[], deleted: string[], conflicted: string[], raw: string }`。

替代方案：`svn mergeinfo --show-revs=eligible` 只能列可合併的 revision，無法列會改哪些檔，且已用於 revision picker；不足以做預覽。故採 dry-run。

### 預覽對話框作為 _startSingleMerge 的前置關卡

在 `_startSingleMerge` 中 `preMergeValidate` 通過後、`runMerge` 之前插入 `previewAndConfirm(paths, revisions)`。若 Settings 的 `showMergePreview` 為 false 則整步跳過。對話框顯示摘要（`N 更新 / N 新增 / N 刪除 / N 預期衝突`）與可捲動完整清單，按鈕「確認執行合併」／「取消」。取消即 return，working copy 未被觸碰。dry-run 本身失敗（權限、網路）時，顯示錯誤並詢問「略過預覽直接合併／取消」。

### rollback 以 svn revert -R 加未追蹤殘留檔清除

在 `svn-bridge.js` 新增 `revertRecursive(wcPath)`（或讓既有 `revert` 接受 `{ recursive: true }` 選項），執行 `svn revert -R <wcPath>`。`svn revert` 會移除文字衝突的 `.mine` / `.r<N>` 檔並取消 conflicted 標記，但 merge 新增（狀態 `A`）的檔案會被降級為 unversioned 並「留在磁碟上」。因此 revert 後再跑一次 `svn status`，把狀態為 `unversioned` 且在 dry-run 預覽 `added` 清單中的檔案刪除，避免殘留。刪除僅限預覽已知的新增檔，不碰其他 unversioned 檔（使用者本來就有的）。

替代方案：`svn merge --record-only` 反向記錄——複雜且不還原檔案內容，排除。直接刪整個 wc 重 checkout——太慢且破壞 sparse 設定，排除。

### 衝突對話框與失敗對話框新增「放棄並還原」

`resolveConflictsInteractive` 的按鈕列（未解完時目前只有「關閉」）新增「放棄合併並還原」；`_showMergeError` 的按鈕列新增同一動作。點擊後二次確認 → 呼叫 rollback → 成功則 Toast 告知已還原、`resolveConflictsInteractive` resolve(false) 讓外層流程正常結束。rollback 需要 dry-run 預覽結果來決定要刪哪些新增檔，故把預覽結果透過 `runMerge` 回傳物件或 `MergeContext` 傳遞到衝突流程。

### 鏈式合併只還原當前未提交站

`chained-merge.js` 的 `run()` 迴圈中，`runMerge` 之後、`promptCommit` 成功之前若 `_haltAt`，在中止對話框加「還原本站」按鈕，對 `stage.targetWcPath` 執行 rollback。`promptCommit` 已回傳且 `committed: true` 之後的站不提供還原。`_haltAt` 增加參數標示「當前站是否可還原」。已完成站清單（`completed`）永不出現還原選項。

### 新增 showMergePreview 設定

`config-manager.js` 預設值加 `showMergePreview: true`。`settings.js` 在合併相關區塊加一個 checkbox，寫回 `config.json`。`merge-executor.js` 透過既有 config 讀取 API 取得該值。

## Implementation Contract

**新增 IPC**

- `svn:merge-preview`：`invoke('svn:merge-preview', sourceUrl, targetWcPath, revisions)` → `{ success: true, preview: { updated: string[], added: string[], deleted: string[], conflicted: string[], raw: string } }` 或 `{ success: false, error }`。不修改 working copy。
- `svn:revert` 擴充：接受第二參數 `{ recursive?: boolean }`；`recursive: true` 時執行 `svn revert -R`。未帶參數時行為與現況相同（向下相容）。

**preload 介面**

- `window.svnApi.mergePreview(sourceUrl, targetWcPath, revisions)`。
- `window.svnApi.revert(targetPath, options?)`，`options.recursive` 傳遞至 IPC。

**svn-bridge 方法**

- `mergePreview(sourceUrl, targetWcPath, revisions)`：組 `['merge', '-c', ...revisions, '--dry-run', sourceUrl, targetWcPath]`，解析 stdout 動作行為分類陣列。
- `revert(targetPath, { recursive })` 或新增 `revertRecursive(wcPath)`：`recursive` 時加 `-R`。
- rollback 輔助：revert 後對照 `added` 清單刪除仍為 unversioned 的檔案；回傳 `{ success, reverted: string[], removed: string[] }`。

**行為**

- 單段合併：`showMergePreview` 為 true 時，合併前必出現預覽對話框；「取消」→ working copy 零變更、流程結束。「確認」→ 進入現有 `runMerge`。
- rollback：衝突未解完的對話框、merge 失敗對話框各有「放棄合併並還原」，二次確認後對未提交 working copy 執行 `svn revert -R` + 清除預覽已知新增檔，Toast 回報還原的檔案數，流程以「未提交」狀態結束。
- 鏈式合併：`_haltAt` 發生在當前站尚未提交時，中止對話框提供「還原本站」；已提交站不受影響，訊息維持現有「已提交階段保留」文字。

**失敗模式**

- dry-run 失敗：不阻斷，對話框提供「略過預覽直接合併／取消」。
- `svn revert -R` 失敗：Toast error 顯示 SVN 原始訊息，提示使用者手動於 TortoiseSVN 還原；不宣稱已還原。
- 新增檔刪除失敗（檔案鎖定等）：Toast warning 列出未能刪除的檔，revert 本身仍視為成功。

**驗收方式**

- 手動：來源選幾筆 revision → 按合併 → 出現預覽且清單與 `svn merge --dry-run` 手動執行結果一致 → 取消後 `svn status` 為空。
- 手動：製造衝突 → 衝突對話框按「放棄合併並還原」→ `svn status` 回到空、無 `.mine` / `.r<N>` 殘留、無多餘新增檔。
- 手動：鏈式合併 stage 1 提交成功、stage 2 製造衝突後放棄 → stage 1 的 qat commit 仍在、stg working copy 乾淨。
- Settings 關閉「合併前顯示預覽」→ 合併流程不出現預覽對話框，行為同舊版。

**Scope 邊界**

- 範圍內：`svn-bridge.js`、`main.js`、`preload.js`、`merge-executor.js`、`chained-merge.js`、`settings.js`、`config-manager.js`、`index.html` 的對應調整。
- 範圍外：獨立提交頁（`commit-manager.js`）、revision picker、任何 commit 後的還原、外部通知、tree conflict 的額外處理。

## Risks / Trade-offs

- [dry-run 與實際結果不一致（tree conflict、externals、binary）] → 對話框標註「預覽為 SVN 估算，實際以合併結果為準」；實際合併仍走既有衝突流程。
- [`svn revert -R` 誤刪使用者既有的 unversioned 檔] → 只刪除 dry-run `added` 清單中、且 revert 後仍為 unversioned 的檔；不做全域 unversioned 清除。
- [預覽多一次 network round-trip 拖慢合併] → dry-run 通常數秒內完成；提供 Settings 開關讓使用者可關閉。
- [rollback 需要把預覽結果傳到衝突流程，增加模組間耦合] → 透過 `runMerge` 回傳物件攜帶 `preview`，不新增全域狀態。
- [鏈式合併「當前站可還原」判斷錯誤，誤還原已提交站] → `_haltAt` 僅在 `promptCommit` 回傳 `committed: true` 之前的中止路徑帶入可還原旗標；已提交站在 `completed` 清單中，UI 不提供還原。
