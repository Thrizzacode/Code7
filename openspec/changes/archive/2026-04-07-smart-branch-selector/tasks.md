## 1. 實作環境版號解析邏輯

- [x] [P] 1.1 實作「1. 解析路徑模板並動態掃描目錄」與「Dynamic Environment Version Loading」：在 `config-manager.js` 實作 `getEnvVersions(wcRoot, pathTemplate)`，解析目錄與名稱前綴，並透過 `fs.readdirSync` 掃描回傳實際版本。
- [x] [P] 1.2 IPC 銜接以滿足「Independent Version Lists」：在 `main.js` 建立 `config:get-env-versions` IPC handler（取代舊有的 `config:get-project-versions`），並在 `preload.js` 暴露對應方法。

## 2. 實作 MergeInfo 查詢邏輯

- [x] [P] 2.1 實作「2. 使用 SVN MergeInfo 判定合併狀態」核心：在 `svn-bridge.js` 新增 `mergeinfo(sourceUrl, targetWcPath)`，背後調用 `svn mergeinfo --show-revs=merged` 並提取整數版本號。
- [x] [P] 2.2 IPC 銜接以滿足「Merge Status Query」：在 `main.js` 新增 `svn:mergeinfo` IPC handler，並在 `preload.js` 暴露給前端使用。

## 3. UI 整合

- [x] 3.1 完成「Independent Version Lists」前端呈現：修改 `branch-selector.js`，當切換 Source/Target 的「環境 (env)」時，獨立呼叫 `getEnvVersions` 動態載入專屬的版本列表，不再讓兩側共用同一次掃描結果。
- [x] 3.2 實作「Merge Status Query」前端等待與呼叫：修改 `revision-picker.js`，在 `loadRevisions` 的同時並行發起 `mergeinfo` 請求，並將收到的合併版號存入區域狀態。
- [x] 3.3 完成「Mark Merged Revisions」：更新 `revision-picker.js` 的 `render` 方法，若項目之版本號已在合併清單內，則讓其行 (`tr`) 與勾選框 (`checkbox`) 設為被禁用並套用反灰 CSS，防止使用者選取。

## 4. Bug Fixes & Refinements (Ingest)

- [x] 4.1 修復 `qat` 環境誤掃 `Stage` 前綴問題：更新 `ConfigManager.getEnvVersions()` 以過濾長度更長的環境前綴，確保專案分支列表準確無誤。
- [x] 4.2 修復 SVN 範圍合併解析器：更新 `svn-bridge.js`，移除非數字字元 (`r`, `*`)，精準備份如 `r8171-8174` 等複雜的範圍輸出。
- [x] 4.3 切換為 Eligible 邏輯：由 `--show-revs=merged` 更換為 `--show-revs=eligible`，使自然血緣繼承（Ancestry）也能完美對齊 TortoiseSVN 的反灰判定邏輯。
- [x] 4.4 加入例外保護機制：修復當 `execSvn` 失敗導致全畫面元件誤判反灰的重大問題，只有在取得 SVN 結果成功時才啟動反灰機制。
