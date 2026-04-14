## Context

開發團隊目前是在專案中提供 `.bat` 檔來輔助本機環境切換 IIS 目標版本 (`hosts` 替換加上 `applicationHost.config` 替換)。但這些檔案修改必須具備系統管理員 (Administrator) 權限，目前開發者須額外手動啟動這些 cmd 檔。我們希望在 Code7 中的 `Settings` 操作介面整合這些功能，不改變 App 平常啟動只需普通使用者權限的現狀。

## Goals / Non-Goals

**Goals:**
- 在 Electron 的 renderer 端透過 UI 發起 IIS 版本切換。
- 由 Main 處理程序針對寫入特定的 `System32` 目錄路徑檔案，發起 UAC (提權) 操作。
- 複製成功或失敗應能夠被攔截，並正確回傳給 UI 顯示結果。

**Non-Goals:**
- 不重新打包 Electron 並要求預設強制管理員執行（避免引發拖曳問題與不必要的權限過大）。
- 不實作重新啟動 IIS 服務 (`iisreset`)，重點僅在於替換設定檔。

## Decisions

### 1. Execute PowerShell with Verbs RunAs for UAC

**Rationale:** 我們需要在不提高主程式權限的情況下，將兩個複製指令一併提權執行。最不透過第三方 npm 依賴的方式就是直接透過 `Start-Process powershell -Verb RunAs` 來啟動獨立的新 PowerShell 程序，並且加入 `-WindowStyle Hidden` 以及透過 `Wait` 與轉向紀錄來確認。
更簡單的方式是我們將需要複製的兩段指令包裹在一段腳本字串中並交由 `child_process.execFile` 去背景叫用 PowerShell 彈窗。

**Alternative Considered:**
- 使用 `sudo-prompt` npm module: 雖然封裝完整，但會增加專案依賴。我們偏好使用原生內建命令。
- 要求使用者 Administrator 執行: 會導致 UI drag&drop 問題且擾民。

### 2. Pass Output back via Try-Catch

**Rationale:** PowerShell 的 UAC 行為如果使用者點選「拒絕」，它會以 Error level 或 Exception 在 `child_process` 內反映，我們可以捕獲這個拒絕行為（或是路徑不存在的行為）並回傳給 UI Toast。

## Risks / Trade-offs

- **Risk:** 每次切換都要彈出一次 UAC 視窗。
- **Mitigation:** 與使用者溝通並同意，這是安全與方便折衷後的最好做法。

- **Risk:** 目錄 `SettingFiles` 如果不在目前的 `process.cwd()` 底下會找不到。
- **Mitigation:** PowerShell 的工作目錄需要設定為當下 Electron 執行目錄，或絕對路徑，確保 `SettingFiles` 參考正確。
