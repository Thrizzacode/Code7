## Context

Merge 頁面目前的合併流程集中在 `merge-executor.js` 的 `MergeExecutor.startMerge()`：它把「pre-merge 驗證 → 執行 merge → 偵測衝突 → 解衝突 → 提示 commit」串在單一方法內，解衝突與 commit 都透過 `Modal` 的 callback 完成，外部無法依序 await，也拿不到 commit 後的新 revision。

分支環境與路徑由 `branch-selector.js` 管理：固定流程順序為 `_flowOrder: ['branches', 'qat', 'stg']`，路徑由 `pathTemplates[env].replace('{version}', version)` 搭配 `repoUrl` / `workingCopyRoot` 解析（內嵌於 `onSelectionChange`）。來源 revision 由 `revision-picker.js` 的 `RevisionPicker.getSelectedRevisions()` 提供。commit 後的新 revision 已可由 `_executeCommit` 的 `result.revision` 取得。

本變更要在不新增 IPC channel 的前提下，於 renderer 端加入一個跨階段的協調器，串接既有步驟並完成 revision 接力。

## Goals / Non-Goals

**Goals:**

- 讓使用者一次設定 `branches/vA → qat/vB → stg/vC`，自動接力完成兩段合併。
- 第二段（qat → stg）自動以第一段 commit 的新 revision 為來源，正確處理跨階段 revision 身分改變。
- 流程僅在「衝突」與「commit 確認」兩處暫停；其餘自動銜接，不需手動重選分支或重挑 revision。
- 中斷時停在當站、保留已完成站，狀態清楚可續。
- 既有單段合併行為完全不變（回歸基準）。

**Non-Goals:**

- 不做全自動無人值守合併：衝突必須人工用 TortoiseMerge 解、commit 必須使用者確認。
- 不自動回滾已完成的站：中斷時已 commit 的 qat 不會被還原。
- 不支援自訂中間環境或跳站（僅固定 branches → qat → stg；單站合併走原流程）。
- 不新增任何 IPC channel 或 main 程序變更；不改動 SVN bridge 行為。
- 第二段不經 RevisionPicker，不提供在第二段手動挑選 revision 的能力。

## Decisions

### 以獨立協調器狀態機編排，而非擴充 startMerge

新增 `src/renderer/js/chained-merge.js`，提供 `ChainedMerge` 物件擁有跨階段的流程控制；`MergeExecutor.startMerge()` 僅判斷單段 vs 鏈式並分派。理由：把多階段狀態機塞進既有 `startMerge` 會讓單段邏輯難以維護，且協調器擁有「revision 接力 + 中斷停在當站」是有真實職責的薄 seam（刪除它，連續合併能力即消失）。

替代方案：在 `startMerge` 內以旗標遞迴。否決，因為衝突/commit 的 Modal callback 會讓控制流糾纏、難以在站與站之間清楚切換與中止。

### 把 merge-executor 步驟抽成回傳 Promise 的可重用單元

將 `startMerge` 內的階段拆成可被逐站 await 的方法：`preMergeValidate(targetWcPath)`、`runMerge(sourceUrl, targetWcPath, revisions)`、`resolveConflictsInteractive(conflicts, paths)`、`promptCommit(paths, revisions, { mandatory })`。原 `startMerge` 改以這些單元組合，行為不變。理由：協調器需要依序等待每一步並取得結果（特別是 commit 的新 revision），現有 callback 形式無法滿足。

替代方案：在協調器內複製一份 merge/commit 邏輯。否決，會造成雙份維護與行為漂移。

### 跨階段 revision 接力，第二段跳過 RevisionPicker

第一段來源 revision 取自 `RevisionPicker.getSelectedRevisions()`；第二段來源 revision 為第一段 `promptCommit` 回傳的新 revision，協調器直接以 `svn merge -c <newRev> <qatUrl> <stgWcPath>` 帶入，不經 RevisionPicker。理由：第一段 commit 進 qat 後產生全新 revision，branches 的原始 revision 號在 qat repo 不存在，必須改用 qat 的 commit revision。

### commit 每站必要且需使用者確認；中斷停在當站、保留已完成站

鏈式呼叫 `promptCommit` 時帶 `{ mandatory: true }`：停用/移除「稍後再說」，並停下來顯示 commit 訊息對話框讓使用者檢視/編輯後確認。任一暫停點被中止（關閉衝突視窗未解完、或 commit 按取消）→ 協調器 `haltAt(stageIndex)` 停止，已 commit 的站維持不變、後續站不啟動，並提示可之後從該站接續。理由：commit 是 qat → stg 接力的前置條件，不能跳過；commit 不可逆，停下來確認較安全；中斷不回滾以保留已完成成果。

### 鏈式合併 UI 入口：勾選框與 stg 版本下拉

在 action bar（`btn-merge` 旁）新增勾選框「🔗 一路合併到 STG」，勾選後顯示 stg 目標版本下拉，沿用 `BranchSelector` 既有的版本載入路徑（`getEnvVersions(..., 'stg')`）。啟用條件：來源為 `branches`、目標為 `qat`、且已選 stg 版本；不符時維持單段行為並提示。理由：重用既有 branch 面板與版本載入，最小侵入；三個版本一開始全選好符合「不逐站詢問」的決策。同時抽出 `BranchSelector.resolvePath(env, version)` 純函式供協調器解析第二段 `qat → stg` 路徑。

## Implementation Contract

**行為（使用者可觀察）：**

- 在 Merge 頁面，當來源=branches、目標=qat 時，勾選「🔗 一路合併到 STG」並選定 stg 版本後，按「執行合併」會依序完成 branches → qat → stg 兩段合併。
- 無衝突時：第一段 merge → 跳出 commit 確認框 → 確認後取得新 revision r_N → 第二段自動以 `-c r_N` 合進 stg → 跳出 commit 確認框 → 確認後取得 r_M → 顯示「全鏈完成」提示。
- 有衝突時：流程暫停於衝突解決視窗（TortoiseMerge），全部解完後自動續行至該站 commit 確認，再進入下一站；使用者全程不需手動重選 source/target 或重挑 revision。
- 未勾選時：「執行合併」維持與現況完全一致的單段行為。

**介面 / 資料形狀（renderer 內部 JS API，無 IPC 變更）：**

- `ChainedMerge.run(stages)`，其中 `stages` 為兩個元素的陣列：
  - `stages[0] = { sourceUrl, targetWcPath, paths, revisions: <第一段手選 revisions> }`
  - `stages[1] = { sourceUrl: <qatUrl>, targetWcPath: <stgWcPath>, paths, revisions: null }`（revision 由上一站 commit 結果帶入）
- `MergeExecutor` 新增/抽出：
  - `async preMergeValidate(targetWcPath) -> boolean`（true=可繼續、false=中止）
  - `async runMerge(sourceUrl, targetWcPath, revisions) -> { success: boolean, conflicts: Array, error?: object }`
  - `async resolveConflictsInteractive(conflicts, paths) -> boolean`（true=全部解決、false=使用者放棄）
  - `async promptCommit(paths, revisions, { mandatory }) -> { committed: boolean, revision: number|null }`
- `BranchSelector.resolvePath(env, version) -> { repoUrl, wcPath }`
- `window.svnApi.*` 沿用既有：merge、commit、status、resolve、info、log、getMergeInfo（不新增 channel）。

**失敗模式：**

- 任一站 `preMergeValidate` 回 false、`runMerge` 失敗、`resolveConflictsInteractive` 回 false、或 `promptCommit` 回 `committed:false` → 協調器 `haltAt` 停止後續站；已 commit 的站不回滾；以 toast/modal 顯示停在哪一站與原因。
- stg 目標 WC 不存在本地 → 啟動前阻擋或引導使用者用既有 `syncToLocal` 同步後再開始。
- 某一站 merge 成功但無實際變更（無可合併內容）→ 略過該站 commit 並提示，不產生空 commit。
- commit 因 out-of-date 失敗 → 沿用 `_executeCommit` 既有錯誤處理（提示外部 svn update），鏈在當站停止。

**驗收標準：**

1. 單段回歸：未勾 chain 時 branches→qat 的 merge / 解衝突 / commit（含 dirty WC、落後 HEAD 對話框）與現況一致。
2. 無衝突全鏈：以 `svn log` 驗證 qat、stg 各新增一筆 commit，且 stg 那筆的來源 revision 等於 qat commit 的 revision（非 branches 原始號）。
3. 衝突暫停→續跑：第一段製造衝突，流程暫停於 TortoiseMerge；解完 + 確認 commit 後自動進入第二段。
4. 中斷保留：第一段 commit 後於第二段中止，qat 那筆 commit 保留、stg 未被動到、提示可從 qat→stg 接續。

**範圍邊界：**

- 範圍內：renderer 端協調器、merge-executor 步驟重構、branch-selector 路徑解析與 chain UI、app.js 初始化、index.html script 引入。
- 範圍外：main 程序與 svn-bridge.js 改動、新增 IPC、自訂/跳站流程、自動回滾、第二段手動挑 revision。

## Risks / Trade-offs

- [重構 `startMerge` 可能改變單段行為] → 以驗收標準 1 作為回歸基準，重構後逐項比對 dirty WC / 落後 HEAD / 衝突 / commit 四種路徑。
- [第二段以單一 commit revision 合併，若第一段 commit 含非預期變更會一併帶入 stg] → commit 確認框讓使用者在進入第二段前檢視；中斷機制允許停在 qat 站。
- [stg WC 缺漏導致第二段失敗] → 啟動前檢查並引導 `syncToLocal`。
- [長流程中 Modal/Toast 狀態殘留] → 協調器在站與站交界清理暫存 toast，沿用既有移除 `.removing` 機制。
- [跨站流程被中斷後使用者誤以為全部失敗] → `haltAt` 明確顯示「已完成 X 站、停在 Y 站」訊息，避免誤解為回滾。
