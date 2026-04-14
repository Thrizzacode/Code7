## 1. 後端 (Main/IPC)

- [x] 1.1 在 `main.js` 中新增 `tool:open-diff` IPC 處理器，實作 Local SVN Diff Invocation 功能。(Design: Use TortoiseProc for Diffing SVN Files)
- [x] 1.2 在 `main.js` 中新增 `tool:open-file` IPC 處理器，實作 Local File Open Invocation 功能。(Design: Use Electron shell for Unversioned Files)
- [x] 1.3 在 `preload.js` 中透過 contextBridge 暴露 `openDiff` 與 `openFile` 方法給前端呼叫。

## 2. 前端 (UI/Controller)

- [x] 2.1 重構 `commit-manager.js` 的表格列渲染邏輯，加入預覽操作按鈕。(Requirement: Interactive File List Preview actions)
- [x] 2.2 重新綁定點擊事件，移除全域的 Checkbox 切換邏輯，並加入雙擊觸發預覽的事件。(Design: Decouple Row Click from Checkboxes)
