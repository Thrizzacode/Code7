## Context

在目前的實作中，`ConfigManager` 依賴使用者於渲染層 UI 中逐筆填寫專案設定（包含專案名稱、目錄路徑、Repo URL、版本清單等），這在擁有十幾個模組專案的環境中顯得非常沒效率。透過系統原生的開檔對話框選擇包含多個工作目錄（Working Copy）的上層資料夾，並透過檔案系統與 SVN 指令自動掃描探測，能大幅縮減設定所需時間，同時保持資料正確性。

## Goals / Non-Goals

**Goals:**
- 提供一鍵匯入工作目錄的功能，由系統自動找出並設定所有 `Fz_` 相關專案。
- 以背景執行 `svn info --xml` 自動萃取 SVN Repository URL。
- 自動掃描專案的 `branches` 資料夾，以動態取得可用的版本號清單，移除手動輸入版本陣列的需求。

**Non-Goals:**
- 不打算實作 SVN Checkout 的自動化（本功能假設專案已經 Checkout 至本地端）。
- 不實作多個上層目錄的掃描，使用者僅能選擇單一父級目錄。

## Decisions

### 1. 統一交由 Main Process 負責目錄探勘與對話框處理
**原因：**
因為渲染器程序 (Renderer) 在 `contextIsolation: true` 環境下無法直接存取 `fs` 或呼叫 `dialog.showOpenDialog`。
**具體作法：**
在 `main.js` 新增一個 IPC handler `dialog:open-directory`，讓渲染器可以觸發「選擇資料夾」視窗。使用者選取路徑後，這個路徑直接交由 `ConfigManager` 的新方法 `scanAndImportWorkspace(parentDir)` 去執行掃描。

### 2. 基於 fs.readdir 進行 Fz 資料夾自動辨識
**原因：**
要找出專案目錄最快的方式是直接掃描其子目錄。
**具體作法：**
在 `scanAndImportWorkspace` 中，取得 `parentDir` 底下所有的檔案與目錄，過濾出 `isDirectory()` 且名稱以 `Fz_` 開頭的項目作為目標專案集合。針對這些專案，進一步檢查其底下是否具有 `.svn` 隱藏資料夾，做為它是 SVN Working Copy 的最終防呆確認。

### 3. 以 svn info 自動採集 Repository URL
**原因：**
避免手寫錯誤，直接透過 SVN CLI 讀取 Working Copy 連結。
**具體作法：**
對每一個辨識出的專案目錄呼叫原有的 `SvnBridge.info(path)` 工具，將解析出的 `url`（或 `repositoryRoot` 加上相對路徑計算）做為專案設定的 Repository URL。為避免阻塞或效能問題，可利用 `Promise.all`（搭配分批處理或直接併發取決於數量）來平行取得所有 Fz 專案的 `svn info`。

### 4. 動態掃描 branches 以取代靜態版本清單
**原因：**
過往專案設定中的 `versions` 陣列需要手動維護。現在改為在匯入階段及分支選擇時，自動掃描目錄。
**具體作法：**
對每一個專案目錄加上 `/branches` 執行 `fs.readdir`。過濾掉非目錄或隱藏檔，收集所有合法命名的版本目錄（例如 `1.5.0`, `1.6.0`）作為該專案的支援版本號清單，存入 `versions` 屬性中。

## Risks / Trade-offs

- [潛在風險] 大量並行發送 `svn info` 可能導致 SVN client 或磁碟 I/O 擁塞。
  → 緩解方法：大部分情況下 `Fz_` 專案數量不會超過百個，`svn info` 原則上執行非常快。若發生 timeout，可考慮限制併發數量。
- [潛在風險] 使用者選錯了不包含任何專案的資料夾。
  → 緩解方法：匯入結束後，將返回「共搜出 X 個專案」的通知，若是 0 個則發出警告。
