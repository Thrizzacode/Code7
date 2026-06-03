## 1. merge-executor 步驟重構（可重用單元）

- [x] 1.1 [P] 把 merge-executor 步驟抽成回傳 Promise 的可重用單元：抽出 preMergeValidate(targetWcPath)、runMerge(sourceUrl, targetWcPath, revisions)、resolveConflictsInteractive(conflicts, paths)、promptCommit(paths, revisions, { mandatory })，並讓單段 startMerge 改以這些單元組合且行為不變（svn-merge-helper/src/renderer/js/merge-executor.js）。驗證：未勾選 chain 時手動執行 branches→qat，dirty WC 確認、落後 HEAD 確認、衝突解決、commit 四條路徑與現況一致。
- [x] 1.2 promptCommit 支援鏈式所需的必要 commit：傳入 { mandatory: true } 時移除/停用「稍後再說」並回傳 { committed, revision }，無變更時回傳 committed:false 不產生空 commit。對應需求 Require a confirmed commit at each stage。驗證：以 mandatory 呼叫時對話框無「稍後再說」按鈕、確認後回傳新 commit revision；模擬無變更時不產生 commit。

## 2. branch-selector 路徑解析與鏈式 UI 入口

- [x] 2.1 [P] 抽出 BranchSelector.resolvePath(env, version) 純函式回傳 { repoUrl, wcPath }，重用既有 pathTemplates 解析規則（svn-merge-helper/src/renderer/js/branch-selector.js）。驗證：對 qat/vB 與 stg/vC 呼叫回傳正確 repoUrl 與 wcPath（DevTools console 斷言）。
- [x] 2.2 綁定鏈式合併 UI 入口：勾選框與 stg 版本下拉 的互動行為——勾選「🔗 一路合併到 STG」時載入並顯示 stg 版本（沿用 getEnvVersions(..., 'stg')），並依來源=branches、目標=qat、已選 stg 版本判斷啟用條件。對應需求 Initiate a chained merge across environments。驗證：勾選後出現 stg 版本下拉；條件不符時顯示提示且維持單段行為。

## 3. UI 標記與協調器骨架

- [x] 3.1 [P] 在 index.html action bar 新增「🔗 一路合併到 STG」勾選框與 stg 版本下拉，並以 <script> 引入 chained-merge.js（置於 merge-executor.js 之後）（svn-merge-helper/src/renderer/index.html）。驗證：頁面載入後可見勾選框；DevTools 確認 window.ChainedMerge 物件存在。
- [x] 3.2 以獨立協調器狀態機編排，而非擴充 startMerge：新增 chained-merge.js 的 ChainedMerge.run(stages) 與 haltAt(stageIndex) 骨架，擁有跨階段流程控制（svn-merge-helper/src/renderer/js/chained-merge.js）。驗證：以兩段假 stages 呼叫，能依序呼叫 MergeExecutor 步驟，並在中止時停止後續站（DevTools 手動驗證）。

## 4. 階段編排與 revision 接力

- [x] 4.1 Sequence stages branches → qat → stg：協調器依序執行 stage1（branches→qat）與 stage2（qat→stg），每站先跑 preMergeValidate，驗證被取消即 halt 不啟動後續站。對應需求 Sequence stages branches → qat → stg。驗證：無衝突情境下兩站依序 merge+commit；pre-merge 取消時停止後續站。
- [x] 4.2 跨階段 revision 接力，第二段跳過 RevisionPicker：stage1 使用 RevisionPicker 選取的 revisions，stage2 以 stage1 commit 產生的新 revision 透過 svn merge -c 帶入、不經 RevisionPicker。對應需求 Relay the committed revision to the next stage。驗證：以 svn log 確認 stg 那筆的來源 revision 等於 qat commit 的 revision（如 r5001），而非 branches 原始號 r1234/r1236。
- [x] 4.3 MergeExecutor.startMerge 分派單段與鏈式：勾選且條件成立時組出 stages 交給 ChainedMerge.run，否則走原單段流程（svn-merge-helper/src/renderer/js/merge-executor.js）。對應需求 Initiate a chained merge across environments 的「Chained mode disabled」情境。驗證：勾選跑鏈式、未勾跑單段且行為與現況一致。

## 5. 暫停、續跑、中斷與前置檢查

- [x] 5.1 Pause on conflicts and auto-resume：任一站衝突時暫停於既有衝突解決流程，全部解完後自動續行至該站 commit 並進入下一站。對應需求 Pause on conflicts and auto-resume。驗證：stage1 製造衝突，解完並確認 commit 後自動進入 stage2，無需手動重選 source/target 或重挑 revision。
- [x] 5.2 commit 每站必要且需使用者確認；中斷停在當站、保留已完成站：以 promptCommit({ mandatory: true }) 在每站停下確認；關閉衝突視窗（未解完）或取消 commit 即 haltAt 並保留已完成站、提示可續。對應需求 Halt at current stage on interruption, preserving completed stages。驗證：stage1 commit 後於 stage2 取消，qat 那筆 commit 保留、stg WC 未被動到、顯示停在 qat→stg 可續。
- [x] 5.3 Require the STG working copy before starting：啟動前檢查 stg/vC 本地 WC 是否存在，缺少時阻擋鏈式並引導既有 syncToLocal 同步後重試。對應需求 Require the STG working copy before starting。驗證：未同步 stg WC 時啟動鏈式被阻擋並提示先同步。
- [x] 5.4 全鏈完成後 refresh revisions：整條鏈完成（showChainComplete 顯示提示）時，呼叫 `RevisionPicker.loadRevisions()` 重新載入 revision 清單，確保 UI 反映最新的 qat/stg 狀態。（svn-merge-helper/src/renderer/js/chained-merge.js）驗證：以 npm start 實機跑完無衝突全鏈後，RevisionPicker 清單自動刷新，顯示 stg 最新的 commit revision，無需手動按重新整理。

## 6. 初始化與端對端驗證

- [x] 6.1 在 app.js 初始化序列呼叫 ChainedMerge.init()，綁定勾選框與 stg 版本下拉事件（svn-merge-helper/src/renderer/js/app.js）。驗證：應用啟動後勾選框互動正常、無 console 例外。
- [x] 6.2 端對端驗證五情境：以 npm start 實機執行 (1) 單段回歸（未勾選 chain，dirty WC/落後 HEAD/衝突/commit 四條路徑與現況一致）、(2) 無衝突全鏈（以 svn log 驗證 qat、stg 各新增一筆 commit，且 stg 來源 revision 等於 qat commit revision 而非 branches 原始號；確認全鏈完成後 RevisionPicker 自動刷新）、(3) 衝突暫停→續跑（stage1 製造衝突，解完 + 確認 commit 後自動進入 stage2，無需手動重選）、(4) 中斷保留（stage1 commit 後於 stage2 取消，qat 那筆 commit 保留、stg 未被動到、提示可從 qat→stg 接續）、(5) stg WC 缺漏阻擋（確認提示出現且未啟動 merge）；並以 test-merge-tool.js 輔助驗證 svn-bridge 行為正確。
