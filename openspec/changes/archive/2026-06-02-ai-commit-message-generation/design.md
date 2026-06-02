## Context

Code7 是一個 Electron 桌面應用程式，採用三層架構：main process（Node.js）、preload（IPC 橋接）、renderer（原生 JS）。目前提交頁面（CommitManager）只支援手動輸入 commit message。

本次變更新增 Gemini AI 生成功能，在 main process 新增 `ai-service.js` 模組負責 API 呼叫，透過現有 IPC 機制暴露給 renderer。API Key 與提示詞存放在現有的 config.json（`%APPDATA%\Code7\config.json`）。

## Goals / Non-Goals

**Goals:**

- 使用者可在設定頁面填入個人 Gemini API Key 並自訂提示詞
- 提交頁面依據使用者選取的檔案（file list + svn diff 內容）呼叫 Gemini 生成 commit message
- 提供完整的 edge case 處理（無 API Key、API 錯誤、unversioned 檔案、diff 過大、空回傳）

**Non-Goals:**

- 不支援 OpenAI 或其他 AI 提供商（本次僅 Gemini）
- 不加密儲存 API Key（與 mergeToolPath 同等級的本地設定）
- 不在 main process 以外快取 API Key（每次 IPC 呼叫時從 config 讀取）
- 不提供 AI 生成歷史紀錄

## Decisions

### AI 服務模組放在 main process，透過 IPC 呼叫

main process 是唯一能安全存取 config（含 API Key）並發出 HTTP 請求的位置。若在 renderer 直接呼叫 Gemini API，API Key 會暴露在 DevTools。

**替代方案考慮：** 在 renderer 端直接 fetch — 排除，原因是 API Key 暴露風險。

### 使用 @google/genai 官方 SDK

官方新版 SDK（`@google/genai`）取代已棄用的 `@google/generative-ai`，在 Node.js 環境運作良好，提供型別安全與錯誤封裝。使用 `gemini-2.5-flash` 模型，速度快且成本低，適合生成短文字訊息。

初始化方式：`new GoogleGenAI({ apiKey })`，呼叫方式：`ai.models.generateContent({ model, contents })`，回傳值透過 `response.text` 取得。

**替代方案考慮：** 使用 fetch 直接呼叫 REST API — 排除，SDK 提供更完整的錯誤處理與重試邏輯。

### svn diff 只針對選取的已版本控制檔案執行

`svn diff` 無法對 unversioned 檔案執行，且對已刪除檔案也可能失敗。在 IPC handler 中於呼叫 diff 前過濾 unversioned 檔案，避免整個操作失敗。若過濾後無可 diff 檔案，diff 欄位傳空字串，AI 僅根據檔案清單生成。

**替代方案考慮：** 讓 SvnBridge.diff() 內部處理過濾 — 排除，過濾邏輯應在 IPC handler 集中處理，SvnBridge 保持職責單一。

### Diff 截斷上限 8000 字元

Gemini 2.5 Flash token 上限充足，但過長的 diff 增加延遲與費用。8000 字元約等於 200-300 行代碼的差異，足以讓 AI 理解變更意圖。截斷時在結尾附加提示說明文字已截斷。

### API Key 以明文存放於 config.json

與現有的 `mergeToolPath`、`iisSettingFilesPath` 一致，不引入新的加密機制。config.json 存放於使用者個人的 `%APPDATA%` 目錄，屬可接受的安全等級。

## Implementation Contract

**IPC 通道**

新增 IPC channel `ai:generate-commit-message`：
- 輸入：`entries` — 陣列，每項為 `{ path: string, itemStatus: string }`（僅限使用者選取的檔案）
- 流程：main process 讀取 config → 過濾 unversioned → 呼叫 `SvnBridge.diff()` → 呼叫 `AiService.generateCommitMessage()`
- 輸出成功：`{ success: true, message: string }`
- 輸出失敗：`{ success: false, error: 'API_KEY_MISSING' | 'EMPTY_RESPONSE' | string }`

**SvnBridge.diff(filePaths)**

- 輸入：`filePaths` — string[]，已版本控制的絕對路徑陣列
- 執行：`svn diff <file1> <file2> ...`（execFile）
- 成功：`{ success: true, diff: string }`（超過 8000 字元時截斷，末尾附加 `\n[... diff 已截斷，僅顯示前 8000 字元 ...]`）
- 失敗：`{ success: false, error: string }`

**Config 欄位**

`config.json` 新增：
- `aiApiKey: string`（預設值 `''`）
- `aiCommitPrompt: string`（預設值為 `DEFAULT_COMMIT_PROMPT` 常數）

`config-manager.js` 匯出 `DEFAULT_COMMIT_PROMPT` 常數，供 main.js IPC handler 傳遞預設值給 renderer 的「恢復預設」按鈕用。

**特殊錯誤碼**

- `API_KEY_MISSING`：`aiApiKey` 為空字串時由 AiService 回傳，renderer 顯示引導至設定的警告 Toast
- `EMPTY_RESPONSE`：Gemini 回傳空白或純空白字串時由 AiService 回傳，renderer 提示調整提示詞

**UI 行為合約**

- `#btn-ai-generate`：初始為 `disabled`，與 `#btn-standalone-commit` 同步，當 `selectedFiles.size > 0` 時啟用
- 生成中：按鈕 disabled，文字改為「生成中...」，避免重複觸發
- 生成完成（成功）：`#standalone-commit-message` 填入生成文字，呼叫 `_updateSelectionSummary()` 更新提交按鈕狀態
- 生成完成（失敗）：顯示 Toast，按鈕恢復為「✨ AI 生成」

**接受標準**

1. 選取 1 個以上已修改檔案後，點擊「✨ AI 生成」，`#standalone-commit-message` 在 10 秒內被填入非空白文字
2. 未設定 API Key 時點擊，顯示引導至設定的警告 Toast（不崩潰）
3. 選取全為 unversioned 的檔案，AI 仍能生成（diff 為空，根據檔案清單生成）
4. 在設定頁面點擊「恢復預設提示詞」，`#ai-commit-prompt` textarea 回復為 `DEFAULT_COMMIT_PROMPT` 的文字內容

**範圍邊界**

- 本次只新增 `ai:generate-commit-message` 一個 IPC channel，不修改任何現有 channel
- `CommitManager.executeCommit()` 不做任何變更（AI 生成只是填入 textarea，提交流程不變）
- `SvnBridge.diff()` 為新方法，不更動現有方法

## Risks / Trade-offs

- [Risk] Gemini API 延遲可能超過 10 秒 → Mitigation：按鈕顯示「生成中...」並 disabled，避免使用者誤以為無回應；無全局 timeout，依賴 SDK 預設
- [Risk] API Key 以明文存放 → Mitigation：已知且接受，與現有 config 欄位一致；本工具僅限內部使用
- [Risk] 大型 repo 的 diff 可能包含敏感代碼 → Mitigation：diff 截斷 8000 字元，且使用者自行決定是否使用 AI 功能
