## 1. 後端 (Main Process)

- [x] 1.1 在 `src/main/main.js` 新增 IPC handler 接收切換 IIS 版本的請求。(Requirement: System escalates privileges to copy configuration)
- [x] 1.2 實作 Execute PowerShell with Verbs RunAs for UAC 來呼叫 PowerShell，執行 `hosts` 和 `applicationHost.config` 的檔案覆寫任務。
- [x] 1.3 實作 Pass Output back via Try-Catch 將 PowerShell 執行後的成功或失敗結果（或被拒絕授權）捕獲並回傳給前端。
- [x] 1.4 在 `preload.js` 中暴露切換版本的 API 函式給前端存取。
- [x] 1.5 新增 IPC handler `iis:get-current-version` 以偵測目前生效的 IIS 版本。(Requirement: System detects current IIS version)
- [x] 1.6 修正 PowerShell 提權指令的引號脫逸錯誤，改用 Base64 EncodedCommand 確保指令傳遞正確。

## 2. 前端 (Renderer)

- [x] 2.1 在 `src/renderer/index.html` 的 Settings panel 新增下拉選單或文字輸入框介面與按鈕。 (Requirement: User can switch IIS version from Settings)
- [x] 2.2 在 `src/renderer/index.html` 的「IIS 版本設定」區塊新增顯示「當前環境版本」的區域。
- [x] 2.3 在 `src/renderer/js/commit-manager.js` (或獨立 UI Controller) 加入前端監聽與綁定邏輯，取得選取的版本號並呼叫 API。
- [x] 2.4 加入操作後的 Toast 成功與失敗提示反饋邏輯。
- [x] 2.5 實作進入設定頁面及切換成功後自動更新當前環境版本顯示的邏輯。
- [x] 2.6 優化版本下拉選單，新增預設 Placeholder 選項且不預選第一個版本。
- [x] 2.7 確保 SettingFiles 路徑持久化儲存，並在每次開啟設定時正確恢復。
