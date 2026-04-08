## Context

目前，SVN Merge Helper 的 BranchSelector 組件在選擇專案時，會讀取一次該專案底下的 `branches` 目錄作為版本清單。這導致來源和目標版本清單永遠一樣，無法反映 `qat` 或 `stg` 等環境在 `trunk` 下的實際結構。
此外，RevisionPicker 在呈現歷史 commit 時，無法分辨哪些 revision 已經合併到目標分支，導致使用者可能重複選取已合併的 revision。

為了解決這些問題，系統需要在不同的前段觸發點調用更精確的 SVN/Filesystem 指令。

## Goals / Non-Goals

**Goals:**
- 根據使用者選擇的環境（Source/Target Env），動態解析路徑模板並掃描對應目錄，取得正確的版本清單。
- 在選擇來源與目標分支後，載入 revision 列表時，同步透過 `svn mergeinfo` 取得已合併狀態。
- 確保 Renderer (UI) 不直接使用 Node.js 檔案系統與 child_process API，必須透過 IPC。

**Non-Goals:**
- 不改變現有路徑模板（Path Templates）的定義與儲存格式。
- 不自動執行「未合併 revision 的批次合併」，仍由使用者手動點選確認。

## Decisions

### 1. 解析路徑模板並動態掃描目錄

**決策**：在 Main Process 的 `ConfigManager` 新增 `getEnvVersions(wcRoot, pathTemplate)` 函數。
**理由**：路徑模板如 `trunk/05-Code-Stage-{version}`，我們需要提取出要掃描的目錄（`trunk`）以及前綴（`05-Code-Stage-`）。透過拆解 `{version}` 前的部分，我們可以得到目錄與前綴。掃描該目錄後，過濾出符合前綴的子目錄，並將前綴移除即得真正的版本號。
**替代方案考量**：在 Renderer 解析並要求 Main 讀取特定目錄。但這會暴露過多細節給前端，由 Main 封裝解析邏輯較符合架構。

### 2. 使用 SVN MergeInfo 判定合併狀態

**決策**：新增 `SvnBridge.mergeinfo(sourceUrl, targetWcPath)` 來執行 `svn mergeinfo --show-revs=merged <sourceUrl> <targetWcPath>`，將輸出解析為整數陣列。
**理由**：這是 SVN 原生且最可靠的判定方式，不需維護額外的狀態檔案。
**替代方案考量**：過濾掉已合入的 revision 不顯示。但不顯示會讓使用者疑惑「這個 revision 有沒有進來過」，使用 disabled 與反灰的方式體驗較佳。

## Risks / Trade-offs

- **Risk:** `svn mergeinfo` 執行可能需要數秒時間（尤其是大 package 或高延遲網路環境），導致載入 revisions 變慢。
  **Mitigation:** `svn log` 和 `svn mergeinfo` 以 `Promise.allSettled` 並行執行，減少整體等待時間，且 UI 需要確保在兩者皆完成前維持 Loading 狀態。

- **Risk:** 目錄沒有對應權限或不存在。
  **Mitigation:** `getEnvVersions` 在目錄不存在時應優雅捕捉錯誤，並回傳空陣列，避免應用程式崩潰。
