## Context

`MergeExecutor`（`svn-merge-helper/src/renderer/js/merge-executor.js`）負責 SVN 合併作業的完整流程：pre-merge 驗證 → 執行 merge → 處理衝突 → commit。

目前 Step 1（pre-merge 驗證）只執行 `svn status` 檢查未提交的變更，但不驗證本地 Working Copy 的 revision 是否落後 SVN server 的 HEAD revision。若落後，`svn merge` 本身可能成功（SVN 允許在過期 WC 上執行 merge），但後續的 `svn commit` 必定失敗，並拋出 "out of date" 錯誤。

`_executeCommit()` 目前僅在 commit 失敗後用 regex（`/out of date|needs to be updated/i`）比對錯誤訊息，顯示簡單的 toast 提示，無法讓使用者在操作前做出決策。

對比：`CommitManager.executeCommit()`（`svn-merge-helper/src/renderer/js/commit-manager.js`）已實作 proactive update 檢查：同時呼叫 `svnApi.info(wcPath)` 與 `svnApi.info(wcPath, { revision: 'HEAD' })`，比對 `localRev < headRev`，若落後則透過 `Modal.confirm()` 讓使用者決定是否繼續。

## Goals / Non-Goals

**Goals:**

- 在 `startMerge()` 執行 merge 前，加入與 `CommitManager` 一致的 update 狀態檢查邏輯
- 在 `_executeCommit()` 執行 commit 前，加入 proactive update 狀態檢查，取代純 reactive 的錯誤比對
- 兩處 check 失敗（網路問題、`svn info` 逾時）皆為 non-blocking，不阻擋操作繼續

**Non-Goals:**

- 不自動執行 `svn update`
- 不處理合併完成到 commit 之間的時間差風險
- 不修改 `SvnBridge.info()` 的介面

## Decisions

### merge 前的 update 檢查插入位置

**決定**：插入在 `startMerge()` 的 Step 1（uncommitted changes 檢查）之後、Step 2（執行 merge）之前。

**理由**：未提交的變更是更嚴重的阻斷條件，應先處理；update 落後是次要警告，讓使用者知情後仍可自行決定繼續。若 check 失敗則靜默跳過（non-blocking）。

**備選方案**：放在 uncommitted changes 檢查之前 — 否決，因為若 WC 有未提交變更，update 狀態已無意義。

### commit 前的 update 檢查策略

**決定**：在 `_executeCommit()` 呼叫 `svnApi.commit()` 前加入 proactive check，保留現有的 reactive 錯誤訊息作為最後防線。

**理由**：Proactive check 讓使用者在操作前看到落後資訊，體驗優於事後錯誤；保留 reactive 處理則防止 proactive check 因 non-blocking 靜默跳過時漏掉真正的 commit 失敗。

**備選方案**：移除 reactive 錯誤處理 — 否決，因為 proactive check 是 non-blocking，若因網路問題跳過，reactive 處理仍能提供最低限度的使用者提示。

### 複用 Modal.confirm() 顯示 UX

**決定**：使用與 `CommitManager` 相同的 `Modal.confirm()` 模式，顯示 `localRev` 與 `headRev` 的差距，主要按鈕為危險動作（`btn-danger`）。

**理由**：一致的 UX 模式降低使用者學習成本；`btn-danger` 強調此操作有潛在風險。

## Implementation Contract

**行為（使用者視角）：**

1. 使用者點擊「合併」後，若目標 WC 的本地 revision 小於 HEAD revision，顯示 Modal：
   - 標題：`工作目錄版本落後`
   - 內容說明本地 revision（例如 `r100`）與 HEAD revision（例如 `r105`）的差距，建議先執行 Update
   - 按鈕：`仍要繼續合併`（`btn-danger`）/ 取消
   - 若使用者取消，整個合併流程中止
2. 使用者點擊「提交」後（merge 後的 commit dialog），執行 commit 前同樣進行 update 檢查：
   - 顯示相同格式的 Modal，按鈕文字為 `仍要提交`（`btn-danger`）
   - 若使用者取消，commit 中止但 merge 結果保留在 WC
3. 若 `svnApi.info()` 呼叫失敗（網路問題、逾時），update check 靜默跳過，流程繼續

**涉及的函式（不依賴行號）：**

- `MergeExecutor.startMerge()`：在 Step 1 uncommitted changes 檢查之後，Step 2 merge 執行之前插入 update check
- `MergeExecutor._executeCommit()`：在呼叫 `svnApi.commit()` 之前插入 update check；保留現有 commit 失敗後的 regex 錯誤比對

**失敗模式：**

- `svnApi.info()` 任一呼叫失敗 → catch 後靜默跳過，繼續後續步驟（non-blocking）
- 使用者在 Modal 選擇取消 → `return`，流程中止，無副作用

**驗收條件：**

- 手動測試：在落後 HEAD 的 WC 上點擊合併，應出現 update 警告 Modal
- 手動測試：在落後 HEAD 的 WC 上完成 merge 後點擊提交，應出現 update 警告 Modal
- 手動測試：WC 為最新狀態時，不應出現任何額外 Modal，流程與現在相同
- 手動測試：模擬 `svnApi.info()` 失敗（可暫時注入錯誤），確認流程不中斷

**範圍邊界：**

- 在範圍內：`merge-executor.js` 中的兩個函式
- 不在範圍內：`commit-manager.js`、`svn-bridge.js`、`preload.js`（`svnApi.info()` 介面不變）

## Risks / Trade-offs

- [風險] `svn info --revision HEAD` 在大型 repository 或慢速網路下可能增加使用者等待時間 → 兩個 `info` 呼叫以 `Promise.all()` 並行，最小化延遲
- [風險] Non-blocking 的設計使 check 失敗時使用者無感知，落後 WC 的 commit 仍可能失敗 → reactive 錯誤處理保留作為最後防線

