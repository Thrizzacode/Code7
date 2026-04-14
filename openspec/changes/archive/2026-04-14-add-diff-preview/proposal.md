## Why

在獨立的 Commit 頁面中，當使用者面對大量或複雜的本地檔案變更時，需要能夠快速預覽差異內容（Diff）與直接查看新增檔案，以確保要提交的邏輯完全正確。

## What Changes

- 在 Commit 列表新增「操作」欄位（獨立 Icon 按鈕）與支援此表格列的雙擊事件。
- 依據檔案 SVN 狀態提供不同行為：
  - **修改 (modified), 衝突 (conflicted), 刪除 (deleted)**：可喚起 SVN 的內部 Diff 工具 (如 WinMerge)，透過 `TortoiseProc.exe /command:diff`。
  - **未追蹤 (unversioned), 新增 (added)**：可喚起系統預設程式開啟該檔案，藉由 Electron `shell.openPath`。
- 取消舊的「點擊整列任意處皆觸發 Checkbox」機制，將勾選行為移交給專屬的 Checkbox 元素，以避免雙重觸發與 UX 混亂。

## Capabilities

### New Capabilities

- `file-preview`: 支援本機檔案的預覽與檔案間差異比對 (Diff) 指令綁定。

### Modified Capabilities

- `standalone-commit`: 擴充原有的 Commit 頁面檔案清單，增加狀態按鈕與雙擊事件。

## Impact

- Affected specs: `file-preview`, `standalone-commit`
- Affected code:
  - `src/main/main.js`（新增 IPC endpoints `tool:open-diff`、`tool:open-file`）
  - `src/preload/preload.js`（暴露新的 API）
  - `src/renderer/index.html`（增加操作欄位）
  - `src/renderer/js/commit-manager.js`（重構渲染與點擊邏輯）
