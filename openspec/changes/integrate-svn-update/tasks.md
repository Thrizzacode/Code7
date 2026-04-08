## 1. 後端基礎設施 (Backend & IPC)

- [x] 1.1 **核心指令與 SvnBridge 擴充**: 在 `svn-bridge.js` 中新增 `ensureLocalPath(wcPath)` 方法，實作 Selective Update (`svn update --set-depth infinity`)。
- [x] 1.2 在 `main.js` 中註冊 `svn:ensure-local-path` IPC 處理程序。

## 2. UI 結構與樣式佈局 (HTML/CSS)

- [x] 2.1 修改 `index.html`，在來源與目標路徑預覽區塊中新增同步按鈕容器。
- [x] 2.2 在 `main.css` 中添加同步按鈕及其載入中 (loading) 的專屬樣式，確保符合專案主題。

## 3. UI 互動與橋接 (Interaction logic)

- [x] 3.1 修改 `branch-selector.js` 的 `onSelectionChange`，根據版本的 `presentLocally` 狀態切換同步按鈕的顯示。
- [x] 3.2 實作同步按鈕的點擊監聽器，調用 IPC 方法執行同步作業並處理 UI 狀態反饋。
- [x] 3.3 同步完成後觸發狀態重新確認，並透過 Toast 顯示進度告知使用者。

## 4. 驗證與測試 (Verification)

- [x] 4.1 模擬選取僅存於遠端的版本，驗證按鈕是否正確出現並發揮作用。
- [x] 4.2 執行同步操作，確認本地目錄已確實建立且 Merge 操作不再報錯 `E155010`。
