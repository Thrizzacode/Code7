# Design: Integrate SVN Selective Update

## Context
當前的 SVN Merge Helper 雖具備遠端版本偵測功能，但因為本地工作副本通常採用稀疏檢出 (Sparse Checkout)，導致許多分支或標籤目錄在本地實際上並不存在。當使用者嘗試對這些路徑執行 `merge` 或 `mergeinfo` 時，會觸發 `svn: E155010` 錯誤。

## Goals / Non-Goals

**Goals:**
- 提供一種直觀的方式，讓使用者能一鍵將缺失的遠端目錄「拉取」至本地。
- 在 UI 上明確區分已準備好（本地已存在）與待同步（僅在遠端）的版本。
- 確保同步過程中，使用者能看到流暢的進度反饋。

**Non-Goals:**
- 不會自動執行全量 `svn update`，僅針對選定的子目錄進行 Selective Update。
- 不提供自動合併衝突解決功能（維持現狀）。

## Decisions

### 1. 核心指令：Selective Update
我們將使用 `svn update --set-depth infinity <path>`。這個指令的優點在於它能精確地擴展稀疏檢出的深度，僅拉取使用者需要的特定版本目錄，而不會拖慢整個專案的同步速度。

### 2. UI 互動
- **按鈕置放**: 在 `BranchSelector` 的 `source-path` 與 `target-path` 右側新增一個 `Sync` 按鈕。
- **觸發條件**: 僅當版本物件的 `presentLocally` 為 `false` 時顯示。
- **回饋機制**: 點擊後顯示 Loading 狀態，並透過 Toast 告知使用者同步進度。

### 3. SvnBridge 擴充
在 `SvnBridge` 模組中新增 `ensureLocalPath(wcPath)` 方法，負責執行上述指令並處理可能的錯誤（如網路超時）。

## Risks / Trade-offs

- **磁碟空間**: 非同步的 `infinity` 深度更新可能會佔用額外磁碟空間。
- **網路環境**: 在網路不穩定時，同步可能會耗時較長，需確保有適當的逾時處理。
