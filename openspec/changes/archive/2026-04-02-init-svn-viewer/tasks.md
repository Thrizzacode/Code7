## 1. 專案初始化與基礎建設

- [x] 1.1 初始化 Electron 專案結構（package.json、main.js、preload.js、index.html），建立 Electron 程序架構（Main/Preload/Renderer 三層），前端框架選擇：純 HTML/CSS/JS（不引入 React/Vue）
- [x] 1.2 [P] 安裝核心依賴：`electron`、`electron-builder`、`fast-xml-parser`
- [x] 1.3 [P] 建立開發環境腳本（`npm run dev` 啟動 Electron 開發模式，支援 hot-reload renderer）

## 2. SVN CLI 橋接層（svn-cli-bridge）

- [x] 2.1 實作 `SvnBridge` 模組基礎架構（SVN CLI 橋接策略）：SVN command execution wrapper — 使用 `child_process.execFile` 執行指令，配合 `--xml` 輸出與 `fast-xml-parser` 解析，統一 timeout 機制（預設 30 秒，log 60 秒）
- [x] 2.2 實作 `SvnBridge.log(path, options)` — 執行 `svn log --xml --limit N`，解析為 `LogEntry[]`（revision、author、date、message）
- [x] 2.3 [P] 實作 `SvnBridge.info(path)` — 執行 `svn info --xml`，解析為 `RepoInfo`（url、repositoryRoot、revision、lastChangedRevision）
- [x] 2.4 [P] 實作 `SvnBridge.status(path)` — 執行 `svn status --xml`，解析為 `StatusEntry[]`（path、itemStatus、propsStatus）
- [x] 2.5 實作 `SvnBridge.merge(sourceUrl, targetWcPath, revisions)` — 執行 `svn merge -c {revisions}`，回傳 `MergeResult`
- [x] 2.6 實作 `SvnBridge.commit(path, message)` — 執行 `svn commit -m`，回傳 `CommitResult`（含 revision number）
- [x] 2.7 實作 SVN CLI availability check — 啟動時執行 `svn --version`，失敗時顯示阻塞式錯誤畫面與 Retry 按鈕
- [x] 2.8 實作 Error handling and reporting — 區分 authentication failure、network error、generic SVN error，提供 Copy Error 功能

## 3. IPC 通訊層

- [x] 3.1 定義 IPC channel 介面：在 main process 註冊各 SvnBridge 方法的 `ipcMain.handle` handler
- [x] 3.2 實作 preload script：透過 `contextBridge.exposeInMainWorld` 暴露 `window.svnApi` 物件給 renderer

## 4. 專案設定管理（project-config）

- [x] 4.1 實作 Project configuration storage 與設定檔儲存 — 讀取/寫入 `%APPDATA%/svn-merge-helper/config.json`，包含 projects 陣列與 merge tool 路徑
- [x] 4.2 實作 Default path templates — branches:`branches/{version}`、qat:`trunk/05-Code-{version}`、stg:`trunk/05-Code-Stage-{version}`，支援每個專案 override
- [x] 4.3 實作 External merge tool path configuration（衝突處理策略的工具端設定）— 從 Windows Registry 自動偵測 TortoiseMerge 安裝路徑，失敗時允許手動設定
- [x] 4.4 實作設定頁面 UI — 新增/編輯/刪除專案表單，驗證 Working Copy 路徑是否存在，merge tool 路徑設定區塊
- [x] 4.5 實作首次啟動引導 — 無設定檔時顯示 setup 畫面，說明專案目錄結構與合併流程（branches→qat→stg），要求至少新增一個專案

## 5. 分支選擇器 UI（branch-selector）

- [x] 5.1 實作主畫面版面配置 — 頂部 Project selector 下拉選單，中間左右雙面板（Source 與 Target），中間方向指示箭頭（→）
- [x] 5.2 實作 Source and target environment selection — 各面板包含「環境」下拉（branches/qat/stg）與「版本」子選單，實作路徑推導邏輯，選擇後自動推導並顯示完整 SVN 路徑
- [x] 5.3 實作 Merge flow validation — 驗證 branches→qat→stg 方向，反向操作時顯示警告但允許確認後繼續
- [x] 5.4 實作 Project selector — 切換專案時重置分支選擇器，從專案設定載入版本列表；單一專案時自動選取

## 6. Revision 挑選器 UI（revision-picker）

- [x] 6.1 實作 Revision list display — 來源/目標選定後觸發 `svn log` 查詢，以表格方式顯示 revision number、author、date、message（截斷 120 字元），支援 loading 狀態
- [x] 6.2 實作 Load more revisions — 列表底部「載入更多」按鈕，使用 `--revision` 範圍參數分頁載入下一批 100 筆
- [x] 6.3 實作 Revision multi-selection — 每行加入 checkbox，支援 Select All / Deselect All，顯示已選數量與 revision 號碼摘要
- [x] 6.4 實作 Revision filtering — 文字篩選輸入框，支援依 revision number、author、commit message 過濾（case-insensitive），保留已選但被篩掉的 revision

## 7. 合併執行器（merge-executor）

- [x] 7.1 實作 Pre-merge working copy validation — merge 前執行 `svn status` 檢查 working copy 是否乾淨，有未提交修改時顯示警告與檔案列表，由使用者確認是否繼續
- [x] 7.2 實作 Execute merge with selected revisions — 執行 `svn merge -c {revisions}`，成功時顯示已合併檔案摘要
- [x] 7.3 實作 Conflict resolution via external tool — 偵測衝突檔案列表，提供「使用外部工具解決」按鈕啟動 TortoiseMerge，監控外部程序結束後重新檢查衝突狀態，自動執行 `svn resolve --accept working`
- [x] 7.4 實作 Post-merge commit — 合併成功/衝突解決後彈出 commit 對話框，預填 "Merge r{revisions} from {source} to {target}"，支援編輯訊息，執行 `svn commit` 並顯示結果 revision number，提供「稍後再說」選項

## 8. 應用程式外觀與體驗

- [x] 8.1 [P] 設計整體 CSS 樣式 — 深色主題、現代化字型、色彩系統（成功/警告/錯誤狀態色）
- [x] 8.2 [P] 實作 Loading 狀態與 Spinner 元件
- [x] 8.3 [P] 實作 Toast/Notification 提示元件（成功、錯誤、警告）
- [x] 8.4 [P] 實作 Modal 對話框元件（用於 commit message、衝突列表、確認操作）

## 9. 打包與發佈

- [x] 9.1 設定 `electron-builder` 打包配置 — 產出 Windows 安裝檔（.exe installer）
- [x] 9.2 建立 README.md — 包含安裝說明、系統需求、使用指南
