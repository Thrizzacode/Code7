## Context

這是一個全新的 Electron 桌面應用程式專案，目標是簡化公司內部 SVN 多專案的 Merge 流程。目前開發人員使用 TortoiseSVN 進行 branches → qat → stg 的合併操作，過程中需要手動在複雜的目錄結構中定位來源與目標路徑，操作極為繁瑣。

使用者環境為 Windows，電腦已安裝 SVN CLI 與 TortoiseSVN。應用程式需要作為獨立桌面工具運行，不需要後端服務。

### 專案目錄結構

```
SVN Root/
├── Fz_Company/
│   ├── branches/
│   │   ├── 1.9.0/
│   │   └── 1.10.0/
│   └── trunk/
│       ├── 05-Code-1.9.0          ← qat
│       └── 05-Code-Stage-1.9.0   ← stg
├── Fz_Game_K3/
│   ├── branches/...
│   └── trunk/...
├── Fz_Platform/
│   ├── branches/...
│   └── trunk/...
└── ... (更多專案)
```

### 合併流程

```
branches/1.9.0  →  trunk/05-Code-1.9.0 (qat)  →  trunk/05-Code-Stage-1.9.0 (stg)
```

使用者的操作為：在來源分支 commit 後，選擇特定的 revision，使用 `svn merge --revision-range` 合併到目標分支，然後 commit 目標分支。

## Goals / Non-Goals

**Goals:**

- 提供一個直覺的雙面板介面，左右分別代表來源與目標，讓合併方向一目了然
- 自動推導 SVN 路徑，使用者只需選擇「專案」和「環境」（branches/qat/stg）
- 提供 Revision 列表的篩選與多選功能
- 執行合併後能即時回饋結果（成功/衝突），並引導後續動作
- 整個操作流程控制在 3 步以內完成（選分支 → 選 revision → 執行 merge）

**Non-Goals:**

- 不實作內建的 diff/merge 衝突解決編輯器
- 不建立本地端 SVN 歷史快取機制
- 不支援 checkout、update、switch 等一般 SVN 操作
- 不處理多人同時操作同一 working copy 的情境

## Decisions

### Electron 程序架構

採用 Electron 的標準三層架構：

| 層級 | 職責 | 說明 |
|------|------|------|
| Main Process | SVN CLI 執行、檔案系統操作 | 所有 `child_process.execFile` 呼叫僅在此層執行 |
| Preload Script | IPC 橋接 | 透過 `contextBridge.exposeInMainWorld` 暴露安全的 API |
| Renderer Process | UI 渲染與互動 | 純前端邏輯，透過 preload 暴露的 API 與 main process 通訊 |

**替代方案**：考慮過直接在 renderer 中使用 `node-integration: true`，但這會帶來安全風險，且不符合 Electron 最佳實踐。

### 前端框架選擇：純 HTML/CSS/JS

Renderer 端使用原生 HTML + CSS + JavaScript，不引入 React/Vue 等框架。

**理由**：
- 此應用的 UI 複雜度有限（主要是下拉選單、列表、按鈕、對話框），原生 DOM API 足以應對
- 減少依賴與打包體積
- 降低學習與維護成本

**替代方案**：考慮過 Vue.js（使用者日常使用的框架），但 MVP 階段的 UI 複雜度不足以需要框架。如未來功能擴展，可再引入。

### SVN CLI 橋接策略

封裝一個 `SvnBridge` 模組，統一處理所有 SVN 命令呼叫：

```
SvnBridge
├── exec(command, args): Promise<string>   // 基礎執行
├── log(path, options): Promise<LogEntry[]>  // svn log --xml
├── merge(source, target, revisions): Promise<MergeResult>
├── commit(path, message): Promise<CommitResult>
├── info(path): Promise<RepoInfo>
└── status(path): Promise<StatusEntry[]>   // svn status --xml
```

**關鍵設計決策**：
- 所有查詢類指令使用 `--xml` 輸出並以 `fast-xml-parser` 解析，避免純文字解析的脆弱性
- 使用 `child_process.execFile`（非 `exec`），避免 shell injection 風險
- 每個指令設定合理的 timeout（預設 30 秒，log 查詢 60 秒）
- `svn log` 查詢預設限制 100 筆（`--limit 100`），支援分頁載入更多

### 路徑推導邏輯

使用者選擇「專案」+「環境」後，系統根據設定檔中的規則自動推導 SVN 路徑：

```javascript
// 路徑推導規則（儲存於設定檔）
{
  "projects": [
    {
      "name": "Fz_Company",
      "workingCopyRoot": "D:/svn/Fz_Company",
      "repoUrl": "svn://server/Fz_Company",
      "versions": ["1.9.0", "1.10.0"],
      "pathTemplates": {
        "branches": "branches/{version}",
        "qat": "trunk/05-Code-{version}",
        "stg": "trunk/05-Code-Stage-{version}"
      }
    }
  ]
}
```

**替代方案**：考慮過自動掃描 SVN 目錄來偵測結構，但各專案的命名規則高度一致，透過設定檔定義模板更可靠且可控。

### 衝突處理策略

Merge 後透過 `svn status --xml` 檢查是否有衝突檔案（status = "conflicted"）：

1. **無衝突**：顯示成功訊息，提示使用者是否立即 Commit
2. **有衝突**：
   - 列出所有衝突檔案
   - 提供「使用外部工具解決」按鈕，呼叫 `TortoiseMerge.exe` 或系統關聯的 merge tool
   - 在使用者解決衝突後，提供「標記已解決」按鈕（執行 `svn resolve --accept working`）
   - 全部衝突解決後，再提示 Commit

### 設定檔儲存

應用程式設定儲存於使用者的 AppData 目錄下（`%APPDATA%/svn-merge-helper/config.json`），使用 Electron 的 `app.getPath('userData')` 取得路徑。

設定內容包含：
- 各專案的 Working Copy 路徑與 Repository URL
- 版本號列表
- 路徑模板規則
- 外部 Merge 工具的執行路徑

## Risks / Trade-offs

- **[SVN CLI 未安裝或不在 PATH]** → 應用程式啟動時檢查 `svn --version`，若失敗則顯示引導畫面提示使用者安裝或設定 PATH
- **[大量 Revision 查詢效能]** → 使用 `--limit` 控制初始載入量，提供「載入更多」按鈕進行分頁
- **[路徑模板不適用於特殊專案]** → 設定檔支援每個專案獨立定義路徑模板，必要時允許手動輸入路徑覆寫
- **[Merge 期間 Working Copy 被外部修改]** → Merge 前檢查 `svn status` 確認 Working Copy 是乾淨的，若有未提交的修改則警告使用者
- **[TortoiseMerge 路徑不固定]** → 先嘗試從 Registry 取得 TortoiseSVN 安裝路徑，若失敗則允許使用者在設定中手動指定
