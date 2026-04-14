## Why

目前如果要切換 IIS 版本分支，開發者必須手動在系統中點擊 `SetSettingFiles.bat` 與 `switch_iis_branch_version.bat` 單獨設定，且無法在工具內直接看到執行反饋。將該功能整合至 Code7 本身的設定對話框，可以大幅簡化測試環境的切換體驗，讓開發操作不中斷。

## What Changes

- 在設定 (Settings) 對話框新增「IIS 版本設定」區塊。
- 提供選擇（下拉或文字輸入）來變更目前要套用的版本號。
- 透過背景 PowerShell (`Start-Process -Verb RunAs`) 執行 `hosts` 與 `applicationHost.config` 的提權覆寫工作。
- 發送成功或失敗的 Toast 提示告知結果。

## Capabilities

### New Capabilities

- `iis-version-switcher`: 控制 IIS 環境版本的選擇與提權套用機制

### Modified Capabilities
(none)

## Impact

- Affected specs: `iis-version-switcher`
- Affected code: `src/main/main.js` (或類似的 IPC 通訊檔), `src/preload/preload.js`, `src/renderer/index.html`, `src/renderer/js/commit-manager.js` (Settings UI controller)
