## Why

目前 Merge 頁面一次只能做「單段」合併（例如 `branches/v1.2 → qat/v1.2`）。要把同一批變更再推到 stg，使用者必須手動把下拉選單改成 `qat → stg`、重新挑 revision、再按一次 Merge。需求是讓使用者一次設定、自動接力，把手動操作縮到只剩「解衝突」與「確認 commit」，一路完成 branches → qat → stg。

核心難點是 **revision 身分在每一站會改變**：第一段把 `branches` 的 r1234, r1236 合進 qat 並 commit 後，會產生全新的 revision（例如 r5001）；第二段要合進 stg 的來源是 r5001（qat 那筆 commit），而不是 r1234/r1236（那些號碼在 qat repo 不存在）。因此不能只是把現有 merge 包進迴圈跑兩次。

## What Changes

- 在 Merge 頁面的 action bar 新增「🔗 一路合併到 STG」勾選框，勾選後出現 stg 目標版本下拉，讓使用者一開始就把 `branches/vA → qat/vB → stg/vC` 三個版本全部選好。
- 新增一個 renderer 端「鏈式合併協調器」狀態機，依序編排既有的 merge / 解衝突 / commit 步驟，並把上一站 commit 產生的新 revision 接力餵給下一站。
- 第一段（branches → qat）的來源 revision 沿用使用者在 RevisionPicker 手選的那批；第二段（qat → stg）由協調器以第一段 commit 的新 revision 帶入（`svn merge -c <newRev>`），**跳過 RevisionPicker**。
- 每一站的 commit 為**必要步驟**（不能像現在按「稍後再說」跳過），且會停下來跳出 commit 訊息對話框讓使用者檢視/編輯再確認，**不**靜默自動 commit。
- 流程只在兩種點暫停等使用者：**衝突**（人工用 TortoiseMerge 解）與 **commit 確認**；其餘自動銜接，使用者不需重選 source/target 或重挑 revision。
- 中斷時（關掉衝突視窗或在 commit 對話框按取消）鏈停止並**停在當站、保留已完成站**（已 commit 的 qat 維持不變、stg 未被動到），並提示可之後從 qat → stg 接續，不回滾。
- 重構 `merge-executor`，把「pre-merge 驗證 → merge → 解衝突 → commit」抽成可被協調器逐站 await、回傳 Promise 的步驟；單段合併行為維持不變。
- **不需要新增 IPC channel**：merge / commit / status / resolve / info 的 `window.svnApi.*` 皆已存在，本功能為 renderer 端的流程編排。

## Non-Goals (optional)

(本變更會建立 design.md，Non-Goals 記於 design.md 的 Goals/Non-Goals 段落。)

## Capabilities

### New Capabilities

- `chained-merge`: branches → qat → stg 連續合併的協調器狀態機，含跨階段 revision 接力、衝突/commit 暫停點、中斷停在當站，以及啟動鏈式合併的 UI 入口（勾選框 + stg 目標版本選擇）。

### Modified Capabilities

(none)

## Impact

- 受影響的 specs：新增 `chained-merge`
- 受影響的程式碼（路徑相對於專案根目錄）：
  - 新增：
    - svn-merge-helper/src/renderer/js/chained-merge.js（協調器狀態機）
  - 修改：
    - svn-merge-helper/src/renderer/js/merge-executor.js（抽出回傳 Promise 的可重用步驟；startMerge 判斷單段 vs 鏈式）
    - svn-merge-helper/src/renderer/js/branch-selector.js（抽出 resolvePath(env, version)；綁定 chain 勾選框與 stg 版本載入）
    - svn-merge-helper/src/renderer/index.html（action bar 新增 chain 勾選框與 stg 版本下拉；引入 chained-merge.js）
    - svn-merge-helper/src/renderer/js/app.js（初始化 ChainedMerge）
  - 移除：（無）
- IPC：不新增 channel，沿用既有 window.svnApi.*（merge / commit / status / resolve / info）。
