## Context

在先前的 `add-commit-page` 實作中，我們建立了一個 standalone 的 commit 特效與檔案清單。然而，目前使用者無法在送交前預覽這些檔案所變動的程式碼，此為開發與 Code Review 過程中的極大痛點。

## Goals / Non-Goals

**Goals:**
- 提供兩種檔案的預覽功能：SVN 差異比對 (Diff) 與 本地純文字檢視 (Open)。
- 在前端 Commit 表格中實作安全不衝突的點擊事件模型。

**Non-Goals:**
- 我們不會在 Electron 應用程式內部打造一個全新的 Diff 檢視器，而是將其委派給作業系統層級已經組態好的外部應用程式。

## Decisions

### Use TortoiseProc for Diffing SVN Files
與其手動解析組態與尋找 WinMerge 的執行檔路徑，我們選擇直接生成 `TortoiseProc.exe /command:diff /path:"<path>"` 指令。這能受惠於 TortoiseSVN 非常完整的工具鏈，自動讀取使用者自己的 Diff Tool 設定檔，並且容許比對衝突檔案而不需要我們重新開發。

### Use Electron shell for Unversioned Files
對於尚未加入版本庫 (Unversioned/Added) 的檔案，使用 SVN Diff 會引發錯誤或表現不如預期（只有右邊沒有左邊）。我們透過 Electron 的 `shell.openPath` 直接把檔案交回該電腦對應副檔名的預設編譯器/編輯器開啟。

### Decouple Row Click from Checkboxes
為支援雙擊，必須將先前實作的「點擊該列任意處切換勾選」的功能移除。避免雙擊行為時，勾選框跳躍閃爍造成 UX 爭議。

## Risks / Trade-offs

- **[Risk]** 在非 Windows 環境或是沒有安裝 TortoiseSVN 的環境下 `TortoiseProc.exe` 會失效。
  - **Mitigation**: 本程式主要就綁定 SVN 工作流程並為特定團隊使用，已知全數開發者都配置了 TortoiseSVN，若出現錯誤會以 Catch Exception 包裝錯誤訊息反饋。
