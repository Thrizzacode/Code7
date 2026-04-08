## Why

目前公司使用 TortoiseSVN 進行多專案（Fz_Company、Fz_Game_K3、Fz_Platform 等）的版本合併工作。由於每個專案的結構高度巢狀（branches/版本號、trunk/05-Code-版本號、trunk/05-Code-Stage-版本號），開發人員在執行 branches → qat → stg 的合併流程時，需要在 TortoiseSVN 中進行大量重複且容易出錯的手動步驟：手動定位正確的來源與目標路徑、選擇 Revision Range、勾選 Specific Revision，最後再額外操作 Commit。

這些繁瑣的操作嚴重降低了開發效率，也增加了因人為疏忽而合併到錯誤分支的風險。需要一個客製化的桌面工具來簡化這整個流程。

## What Changes

- 建立一個全新的 Electron 桌面應用程式（SVN Merge Helper）
- 提供直覺的來源/目標分支選擇介面（左右下拉選單：branches、qat、stg）
- 提供 Revision 列表瀏覽與多選功能，讓使用者可以精確挑選要合併的 Commit
- 透過呼叫本機 `svn` CLI（搭配 `--xml` 參數）進行即時查詢與合併操作
- Merge 完成後提示使用者是否直接 Commit
- 當發生衝突時，偵測並引導使用者透過外部工具（如 TortoiseMerge）解決

## Non-Goals

- **不做內建 3-way diff/merge 編輯器**：衝突解決交由外部工具（TortoiseMerge）處理
- **不做本地快取/資料庫同步**：MVP 階段採用即時查詢 `svn` CLI，不建立本地端歷史快取
- **不做完整的 SVN 客戶端功能**：不涵蓋 checkout、update、switch 等一般 SVN 操作，專注於 Merge 流程
- **不做多人協作功能**：此工具為單機使用的個人效率工具

## Capabilities

### New Capabilities

- `project-config`: 專案設定管理 — 設定本機 Working Copy 路徑與 SVN Repository URL 的對應關係，以及各專案的分支結構
- `branch-selector`: 分支選擇器 — 透過下拉選單直覺選擇來源與目標環境（branches/版本號、qat、stg），自動推導出對應的 SVN 路徑
- `revision-picker`: Revision 挑選器 — 瀏覽指定分支的 Commit 歷史，支援多選 Revision 以進行 Cherry-pick Merge
- `merge-executor`: 合併執行器 — 呼叫 `svn merge` 執行合併操作，偵測衝突並引導使用者透過外部工具解決，完成後提示 Commit
- `svn-cli-bridge`: SVN CLI 橋接層 — 封裝所有 `svn` 命令列呼叫（log、merge、commit、info、status），統一使用 `--xml` 輸出並解析結果

### Modified Capabilities

（無 — 此為全新專案）

## Impact

- 新增專案結構：Electron 主程序（main process）、渲染程序（renderer process）、preload scripts
- 新增依賴：`electron`、`electron-builder`（打包）、XML 解析器（如 `fast-xml-parser`）
- 系統需求：使用者電腦需安裝 SVN CLI（`svn` 指令需可用）
- 影響範圍：全新專案，不影響現有程式碼
