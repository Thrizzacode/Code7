## Why

在 Standalone Commit 頁面中，使用者可能會遇到不想提交或誤改的檔案。目前介面上缺乏直接還原 (Revert) 變更的功能，需要使用者切換到外部工具或命令列進行還原，造成操作流程中斷。加入還原功能可提升操作便利性與安全性。

## What Changes

- 在 Commit 列表的變更檔案右側操作區塊，加入「還原變更 (Revert)」單檔操作按鈕。
- 加入「還原已選取 (Revert Selected)」批次操作按鈕，支援選取多個檔案一併還原。
- 點擊還原按鈕時，必定跳出確認對話框（Confirm）防呆，警告使用者未提交的變更將會遺失。
- 底層 SVN Bridge 擴充對應的 `revert` 方法。
- **優化通知系統**：擴充 `Toast` 元件功能，支援根據標題手動關閉通知，確保長時任務結束後 UI 清潔。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-commit`: 擴充提交頁面的操作，新增單檔與批次還原變更的能力，包含 UI 互動與底層 API 支援。

## Impact

- 前端介面與邏輯：`src/renderer/js/commit-manager.js`
- 通訊與通知組件：`src/renderer/js/toast.js`
- 後端 SVN 封裝：`src/main/svn-bridge.js`
- IPC 通訊介面：`src/preload/preload.js`, `src/main/main.js`