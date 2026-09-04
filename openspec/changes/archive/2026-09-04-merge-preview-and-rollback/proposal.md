## Why

目前執行合併前無法預知會改到哪些檔案、會不會衝突，只能「合下去才知道」。一旦產生衝突或 merge 指令中途失敗，working copy 已被部分修改，使用者若在衝突解決對話框按「稍後再說」或直接關閉，系統不會還原任何東西，必須自行到 TortoiseSVN 手動 revert，並清掉 `.mine` / `.r<N>` 等衝突殘留檔。這讓合併作業風險高、退場成本大。

## What Changes

- **合併預覽（dry-run）**：在單段合併與鏈式合併每一站真正執行前，先跑一次 `svn merge --dry-run`，解析輸出後以對話框顯示預期異動摘要（更新 / 新增 / 刪除 / 預期衝突的檔案數與清單），使用者確認後才實際合併，或直接取消。
- **合併失敗／中止自動回退**：當 merge 指令回傳錯誤、或使用者在衝突解決對話框未解完就中止時，提供「放棄本次合併並還原」動作，對「本次尚未提交」的目標 working copy 執行 `svn revert -R` 並清除合併產生的未追蹤殘留檔，使其回到合併前的乾淨狀態。
- **鏈式合併整合**：鏈式合併在某一站 `_haltAt` 時，若該站合併尚未提交，於中止對話框提供還原「當前未提交站」的選項；已提交的站一律保留、不回退（維持現有「never rolls back committed stages」承諾）。
- **新增 IPC**：`svn:merge-preview`（dry-run 合併）。`svn:revert` 既有 handler 擴充為支援遞迴還原（`-R`）。
- **Settings**：新增「合併前顯示預覽」開關（預設開啟），關閉時維持舊行為直接合併。

## Non-Goals (optional)

- 不做「部分還原」——回退一律針對整個目標 working copy，不提供逐檔挑選還原。
- 不回退任何已 `svn commit` 的變更（含鏈式合併已完成的站）。
- 不自動解決衝突、不改動現有 TortoiseMerge 外部工具解衝突流程。
- dry-run 對樹狀衝突（tree conflict）的預測不保證完全準確，僅呈現 SVN 回報的結果，不額外推算。
- 不新增 WhatsApp／Slack 等外部通知（另案）。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `merge-executor`: 單段合併流程在前置驗證通過後、執行合併前，新增 dry-run 預覽確認步驟；merge 失敗或衝突解決中止時，新增「放棄並還原」動作，對未提交的 working copy 執行遞迴 revert 與殘留檔清除。
- `chained-merge`: 於 `_haltAt` 中止流程時，若當前站合併尚未提交，提供還原當前站的選項；已提交的站不受影響。
- `svn-cli-bridge`: 新增 dry-run 合併方法（`svn merge --dry-run`，不寫入 working copy），並讓還原方法支援遞迴模式（`svn revert -R`）。

## Impact

- Affected specs: `merge-executor`、`chained-merge`、`svn-cli-bridge`
- Affected code:
  - New: 無新增檔案（皆為既有模組擴充）
  - Modified:
    - svn-merge-helper/src/main/svn-bridge.js（新增 dry-run 合併方法、revert 支援 `-R`、清除合併未追蹤殘留檔）
    - svn-merge-helper/src/main/main.js（註冊 `svn:merge-preview` IPC handler、`svn:revert` 傳遞遞迴參數）
    - svn-merge-helper/src/preload/preload.js（暴露 `mergePreview`、`revert` 增加遞迴選項）
    - svn-merge-helper/src/renderer/js/merge-executor.js（`_startSingleMerge` 插入預覽步驟；新增 rollback 步驟與衝突對話框的「放棄並還原」按鈕）
    - svn-merge-helper/src/renderer/js/chained-merge.js（`run` / `_haltAt` 整合當前未提交站的還原選項）
    - svn-merge-helper/src/renderer/js/settings.js（新增「合併前顯示預覽」開關）
    - svn-merge-helper/src/renderer/index.html（預覽對話框內容、設定項）
    - svn-merge-helper/src/main/config-manager.js（新增 `showMergePreview` 設定預設值）
  - Removed: 無
- IPC channel：新增 `svn:merge-preview`；`svn:revert` 參數擴充（新增遞迴旗標，向下相容）
