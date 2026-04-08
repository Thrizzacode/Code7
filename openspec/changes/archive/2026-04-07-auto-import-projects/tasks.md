## 1. 原理架構擴展 (Main Process IPC)

- [x] 1.1 實作「1. 統一交由 Main Process 負責目錄探勘與對話框處理」：在 `main.js` 新增 `dialog:open-directory` 的 IPC handle，呼叫 `dialog.showOpenDialog` 供使用者選擇 Workspace parent 目錄。
- [x] 1.2 在 `config-manager.js` 建立 `scanAndImportWorkspace(parentDir)` 核心功能，作為執行 Workspace discovery。

## 2. 目錄自動辨識與解析

- [x] 2.1 實作「2. 基於 fs.readdir 進行 Fz 資料夾自動辨識」：在 `scanAndImportWorkspace` 使用檔案系統讀取 `parentDir`，過濾出目錄名稱為 `Fz_` 開頭且內含 `.svn` 隱藏資料夾的路徑，完成 Workspace discovery 功能。
- [x] 2.2 實作「3. 以 svn info 自動採集 Repository URL」：為發現的專案陣列，背後批次呼叫 `SvnBridge.info()`，解析並填充每個專案的 Automatic repository URL resolution 屬性。

## 3. 分支動態讀取實作

- [x] 3.1 實作「4. 動態掃描 branches 以取代靜態版本清單」：在 `ConfigManager` 中實作或更新取得版本列表的方法 `getProjectVersions(wcRoot)`，透過 `fs.readdirSync` 直接讀取專案底下的 `branches` 資料夾來實作 Dynamic branches detection，拋棄靜態設定。

## 4. 設定檔的寫入機制替換

- [x] 4.1 更新 `Project configuration storage` 與 `Saving imported workspaces`：讓 `scanAndImportWorkspace` 返回解析完成的專案陣列，將其整體覆寫 `config.projects`，並使用原有的 `ConfigManager.save()` 持久化。

## 5. UI 前段操作改造 (Renderer Process)

- [x] 5.1 移除 `index.html` 內的單筆「新增專案」相關輸入表單元素，並新增「匯入工作目錄」按鈕於畫面上方。
- [x] 5.2 重新設計 `settings.js` 中的設定畫面呈現方式，點擊匯入按鈕後呼叫 IPC `dialog:open-directory`，獲取路徑後執行後端掃描。
- [x] 5.3 實作掃描期間的 Loading 指示器防呆體驗。
- [x] 5.4 讓原先透過專案設定檔取得版本列表的分支下拉選單 (BranchSelector) 改呼叫全域的動態獲取方法，接上 Dynamic branches detection 流程以完成動態選單。
