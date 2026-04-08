## Why

版本下拉選單目前只讀取 `branches/` 目錄，來源與目標共用同一份清單，導致 qat/stg 環境無法顯示正確版本；且 Revision 列表缺乏已合併標記，使用者無法得知哪些 revision 已 merge，存在重複 merge 的風險。

## What Changes

- 版本清單由「選專案時讀取一次」改為「選環境時動態載入」，根據路徑模板（`branches/{version}`、`trunk/05-Code-{version}` 等）解析出對應目錄與名稱前綴，掃描 Working Copy 本地目錄以取得版本清單（並新增過濾邏輯防範環境前綴衝突）。
- 新增 `svn mergeinfo --show-revs=eligible` 呼叫：當來源與目標都選定後，查詢目標路徑**還可以合併 (eligible)** 的 revision 集合（藉此完美對齊 TortoiseSVN 之自然血緣/祖先邏輯），在 Revision 表格中將不在 eligible 名單內的項目以反灰 + disabled checkbox 標示。
- 強化 `svn mergeinfo` 端點的輸出範圍解析器，支援多種 SVN 輸出正規化（過濾 `r`、`*`、解析連續區間 `-` 等）。

## Capabilities

### New Capabilities

- `env-version-detection`：根據路徑模板動態掃描對應環境子目錄，返回該環境的可用版本清單。
- `merge-status-detection`：呼叫 `svn mergeinfo` 查詢目標 WC 路徑已合入的 revision 集合，供 UI 標記已合併狀態。

### Modified Capabilities

（無規格層級的行為變更）

## Impact

- `src/main/config-manager.js`：新增 `getEnvVersions(wcRoot, pathTemplate)` 方法，替代原 `getProjectVersions(wcRoot)`。
- `src/main/main.js`：更新 IPC handler 由 `config:get-project-versions` → `config:get-env-versions`，並新增 `svn:mergeinfo` handler。
- `src/main/svn-bridge.js`：新增 `mergeinfo(sourceUrl, targetWcPath)` 方法。
- `src/preload/preload.js`：暴露 `getEnvVersions` 與 `getMergeInfo` 給 renderer。
- `src/renderer/js/branch-selector.js`：將版本載入改為在選擇環境時觸發，傳入對應路徑模板。
- `src/renderer/js/revision-picker.js`：載入 revisions 後同步呼叫 mergeinfo，Render 時標記已合併列。
