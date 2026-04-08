## Why

目前使用者需要逐筆手動輸入每個專案的名稱、Working Copy 路徑、SVN Repository URL 以及可用的版本，這對於擁有多數目專案（例如以 `Fz_` 為前綴的大量相關專案）的環境極不友善且容易出錯。提供一鍵匯入整個工作目錄並自動解析相關資訊的功能，將大幅減少設定阻力，達到真正的開箱即用體驗。

## What Changes

- 將「新增專案」的表單改為「匯入工作目錄 (Import Workspace)」。
- 自動掃描使用者選擇的工作目錄（利用系統資料夾選擇對話框），抓出底下所有符合條件（例如以 `Fz_` 開頭）的子目錄作為專案。
- 針對這些掃描到的專案目錄，背景執行 `svn info --xml` 自動擷取並綁定其 Repository URL。
- 自動掃描並讀取每個專案底下的 `branches` 資料夾，以動態獲取該專案獨自的版本清單（如 `1.5.0`, `1.6.0` 等），取代原本全域或手動建立版本清單的方式。
- 使用者未來不再需要手寫專案細節，且分支選單會即時反映本地端的資料夾狀態。

## Non-Goals (optional)


## Capabilities

### New Capabilities

- `import-workspace`: 掃描指定目錄下之專案資料夾、自動執行 svn info 取回遠端資訊及讀取 branches 目錄進行版本偵測的全自動匯入器。

### Modified Capabilities

- `project-config`: 捨棄原本的手動設定介面，改用與 `import-workspace` 連動的一鍵載入，同時在設定檔中取消靜態維護 `versions` 陣列（將改為動態由分支選擇器讀取）。

## Impact

- `src/renderer/index.html`：移除或簡化手動新增的表單欄位，新增「匯入目錄」按鈕。
- `src/renderer/js/settings.js`：更換 UI 的操作邏輯，觸發主程序的打開對話框與專案掃描機制。
- `src/main/main.js`：新增 `dialog:open-directory` 等檔案對話框的 IPC handle。
- `src/main/config-manager.js`：實作資料夾掃描、版本號過濾、以及執行 `svn info` 的自動化邏輯，更新儲存的狀態設定格式。
