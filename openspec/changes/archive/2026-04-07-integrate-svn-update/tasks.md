## 1. 核心邏輯開發 (Backend)

- [x] 1.1 在 `svn-bridge.js` 中新增 `update` 方法，擴展 `SVN command execution wrapper` 功能。
- [x] 1.2 在 `main.js` 註冊 IPC 管道，實作 `IPC 進度回饋機制` 以支援 `svn:update` 與 `svn:update-batch` 指令。
- [x] 1.3 實作批次更新的序列化邏輯，並整合 `批次更新的名單管理方式`（包含所有子專案名單）。

## 2. 使用者介面開發 (Frontend)

- [x] 2.1 修改 `index.html` 的頂部欄，根據 `UI 選項放置位置` 增加同步更新按鈕選單。
- [x] 2.2 在 `app.js` 實作對 `Update Current Project` 選項的事件處理與 API 呼叫。
- [x] 2.3 在 `app.js` 實作對 `Update All Projects` 選項的事件處理，並監聽進度通知。
- [x] 2.4 在渲染進程實作 `Update Status Feedback` 視覺反饋，顯示更新進度與最終結果。
- [x] 2.5 增加視覺進度條 (Progress Bar) 支援，區分單一 (Indeterminate) 與批次 (Determinate) 模式。
- [x] 2.6 在設定頁面實作專案「同步」開關，支援自定義批次更新清單。

## 3. 功能驗證

- [x] 3.1 測試單一專案更新功能，確保成功與失敗的 Scenario 均能正確顯示。
- [x] 3.2 測試批次更新功能，確認所有選中的子專案均能依序更新。
- [x] 3.3 驗證「同步」勾選框功能，確保取消勾選的專案在批次更新中被正確跳過且配置已持久化。
