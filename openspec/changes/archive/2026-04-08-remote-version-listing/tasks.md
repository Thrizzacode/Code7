# Implementation Tasks: Remote SVN Discovery

## 1. SVN 橋接器增補 (Main Process: SvnBridge)

- [x] 1.1 在 `SvnBridge` 中實作 `Execute svn list` 方法，呼叫 `svn list --xml`。
- [x] 1.2 實作 `Remote subdirectory listing` 邏輯，從 XML 返回 `kind="dir"` 的項目。
- [x] 1.3 整合 `Timeout handling for remote listing`，確保遠端查詢在 10 秒內超時。

## 2. 版本偵測邏輯升級 (Main Process: ConfigManager)

- [x] 2.1 修改 `ConfigManager.getEnvVersions` 以實作 `Dynamic Environment Version Loading` 的混合模式。
- [x] 2.2 在 `Main Process: ConfigManager` 中處理遠端與本地數據的合併與去重。
- [x] 2.3 為每個版本標記 `presentLocally` 狀態位。

## 3. UI 介面整合 (Renderer Process: BranchSelector)

- [x] 3.1 更新 `Renderer Process: BranchSelector` 以處理包含 `presentLocally` 狀態的版本清單。
- [x] 3.2 確保 `Dynamic Environment Version Loading` 不會再回推至靜態項目（移除固定 Fallback）。
- [x] 3.3 實作 `Selection of a non-local version` 邏輯，當選取非本地版本時顯示「⚠ 本地尚未檢出」警告。
- [x] 3.4 優化 `Data Flow`，在環境切換查詢時顯示載入狀態（Loading）。

## 4. 驗證與測試

- [x] 4.1 驗證空目錄情境下能正確顯示遠端路徑。
- [x] 4.2 驗證斷網情境下能正常 Fallback 至本地偵測。
- [x] 4.3 驗證選取非本地版本後，路徑預覽與警告狀態正確顯示。
