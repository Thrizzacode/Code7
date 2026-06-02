## 1. 依賴安裝

- [x] 1.1 在 `svn-merge-helper/package.json` 的 `dependencies` 中新增 `@google/genai`，使 `ai-service.js` 能夠 `require('@google/genai')` 成功（決策：使用 @google/genai 官方 SDK）。驗證：於 `svn-merge-helper/` 執行 `npm install` 後，`node -e "require('@google/genai')"` 不拋出錯誤。

## 2. 後端模組實作（可並行）

- [x] 2.1 [P] 在 `svn-merge-helper/src/main/svn-bridge.js` 新增 `diff(filePaths)` 方法，使其對傳入的絕對路徑陣列執行 `svn diff <files...>`，並回傳 `{ success: true, diff: string }` 或 `{ success: false, error: string }`。空陣列傳入時不執行任何 SVN 命令，直接回傳 `{ success: true, diff: "" }`。diff 超過 8000 字元時截斷並附加 `\n[... diff 已截斷，僅顯示前 8000 字元 ...]`（決策：svn diff 只針對選取的已版本控制檔案執行；diff 截斷上限 8000 字元）（Requirement: SVN diff command for specified files）。驗證：以一個已修改的 SVN 檔案路徑呼叫，確認回傳物件含非空 `diff` 字串；以空陣列呼叫，確認回傳 `{ success: true, diff: "" }`。

- [x] 2.2 [P] 在 `svn-merge-helper/src/main/config-manager.js` 的 `createDefaultConfig()` 函式中新增 `aiApiKey: ''` 與 `aiCommitPrompt: DEFAULT_COMMIT_PROMPT`，並在 `load()` 的正規化邏輯中加入這兩個欄位的預設值處理，同時匯出 `DEFAULT_COMMIT_PROMPT` 常數（決策：API Key 以明文存放於 config.json）（Requirement: AI configuration fields in config schema）。驗證：刪除 `%APPDATA%\Code7\config.json` 後啟動應用程式，確認讀取到的 config 物件含 `aiApiKey: ""` 與 `aiCommitPrompt`（等於 DEFAULT_COMMIT_PROMPT 文字）。

- [x] 2.3 [P] 建立 `svn-merge-helper/src/main/ai-service.js`，匯出 `generateCommitMessage(apiKey, promptTemplate, entries, diffText)` 函式，使用 `@google/genai` 的 `GoogleGenAI` 類別（`new GoogleGenAI({ apiKey })`）搭配 `gemini-2.5-flash` 模型，呼叫 `ai.models.generateContent({ model, contents })` 並從 `response.text` 取得結果，回傳 `{ success: true, message: string }` 或 `{ success: false, error: 'API_KEY_MISSING' | 'EMPTY_RESPONSE' | string }`（決策：使用 @google/genai 官方 SDK）（Requirement: AI commit message generation via Gemini API）。驗證：以空字串 apiKey 呼叫，確認回傳 `{ success: false, error: 'API_KEY_MISSING' }`；以有效 API Key 與模擬 entries/diffText 呼叫，確認回傳 `{ success: true, message: <非空字串> }`。

## 3. IPC 橋接層

- [x] 3.1 在 `svn-merge-helper/src/main/main.js` 的 `registerIpcHandlers()` 中 `require` `ai-service.js` 並註冊 `ai:generate-commit-message` 處理器（參數：`entries`）：從 config 讀取 `aiApiKey` 與 `aiCommitPrompt`，過濾 unversioned 檔案後呼叫 `SvnBridge.diff()`，再呼叫 `AiService.generateCommitMessage()`，最終回傳結果（決策：AI 服務模組放在 main process，透過 IPC 呼叫）（Requirement: AI generation button availability）。驗證：啟動應用程式後，透過 DevTools 執行 `window.svnApi.generateCommitMessage([])` 不拋出 IPC 未定義錯誤；以有效 entries 呼叫時能收到 AI 回應或明確錯誤碼。

- [x] 3.2 在 `svn-merge-helper/src/preload/preload.js` 的 `contextBridge.exposeInMainWorld('svnApi', {...})` 物件中新增 `generateCommitMessage: (entries) => ipcRenderer.invoke('ai:generate-commit-message', entries)` 方法（Requirement: AI commit message generation via Gemini API）。驗證：在 renderer DevTools 中 `typeof window.svnApi.generateCommitMessage === 'function'` 為 true。

## 4. 前端 HTML 結構（可並行）

- [x] 4.1 [P] 在 `svn-merge-helper/src/renderer/index.html` 的 commit message textarea（`#standalone-commit-message`）下方新增「✨ AI 生成」按鈕（id：`btn-ai-generate`），初始狀態為 `disabled`，使其在頁面載入時可被 CommitManager 找到並綁定（Requirement: AI-powered commit message generation button）。驗證：啟動應用程式並切換至 Commit tab，確認按鈕顯示且初始為 disabled 狀態。

- [x] 4.2 [P] 在 `svn-merge-helper/src/renderer/index.html` 的 Settings overlay 中新增「AI 訊息生成」區塊，包含 `#ai-api-key`（type password）、`#btn-save-ai-key`、`#ai-commit-prompt`（textarea）、`#btn-reset-ai-prompt`、`#btn-save-ai-prompt` 共 5 個元素（Requirement: AI settings configuration）。驗證：開啟 Settings panel，確認 AI 訊息生成區塊可見且包含上述所有元素。

## 5. 渲染層 JS 接線（可並行）

- [x] 5.1 [P] 在 `svn-merge-helper/src/renderer/js/commit-manager.js` 的 `_bindEvents()` 中綁定 `#btn-ai-generate` 點擊事件，並在 `_updateSelectionSummary()` 中同步更新其 `disabled` 狀態（`count === 0` 時 disabled）。新增 `generateMessageWithAI()` 方法：呼叫 `window.svnApi.generateCommitMessage(entries)`，成功時填入 `#standalone-commit-message` 並呼叫 `_updateSelectionSummary()`，失敗時依錯誤碼顯示對應 Toast（`API_KEY_MISSING` → 引導至設定的 warning；`EMPTY_RESPONSE` → 提示調整提示詞；其他 → error toast），生成期間按鈕顯示「生成中...」且 disabled（Requirement: AI commit message generation via Gemini API、AI generation button availability）。驗證：選取 1 個已修改檔案後按鈕啟用；點擊按鈕後顯示「生成中...」；API key 未設定時顯示 warning toast；成功生成後 textarea 填入非空字串。

- [x] 5.2 [P] 在 `svn-merge-helper/src/renderer/js/settings.js` 的 `init()` 中呼叫 `initAiSettings()` 方法，綁定 `#btn-save-ai-key`（儲存 `aiApiKey`）、`#btn-save-ai-prompt`（儲存 `aiCommitPrompt`）、`#btn-reset-ai-prompt`（還原 `DEFAULT_COMMIT_PROMPT` 並儲存）的點擊事件，各自在成功後顯示 success toast。在 `open()` 中從 `this._config` 填入 `#ai-api-key` 與 `#ai-commit-prompt` 的初始值（Requirement: AI settings configuration、Reset prompt to team default）。驗證：開啟 Settings → AI 區塊顯示已儲存的 API Key（masked）與提示詞；儲存後重開 Settings 確認值持久化；點擊「恢復預設提示詞」確認 textarea 回復為 DEFAULT_COMMIT_PROMPT 文字。

## 6. 整合驗證

- [x] 6.1 執行完整 happy path 驗證：設定有效 Gemini API Key → 切至 Commit tab → 選取 1 個以上已修改的 SVN 檔案 → 點擊「✨ AI 生成」→ 確認 10 秒內 `#standalone-commit-message` 被填入非空白繁體中文提交訊息（Requirement: Successful message generation with versioned files selected）。

- [x] 6.2 執行 edge case 驗證：(a) 清除 API Key 後點擊生成 → 應看到引導至設定的 warning toast；(b) 選取全為 unversioned 的檔案後點擊生成 → 應成功生成（無 diff，以檔案清單生成）；(c) 點擊「恢復預設提示詞」→ textarea 文字應回復為 DEFAULT_COMMIT_PROMPT 內容（Requirement: No API Key configured、Generation with only unversioned files selected、Diff content size limit）。

## 7. Groq 多 Provider 支援

- [x] 7.1 安裝 `groq-sdk` 並在 `package.json` 的 `dependencies` 新增，使 `ai-service.js` 能 `require('groq-sdk')` 成功。驗證：於 `svn-merge-helper/` 執行 `npm install` 後，`node -e "require('groq-sdk')"` 不拋出錯誤。

- [x] 7.2 重構 `svn-merge-helper/src/main/ai-service.js`，將 `generateCommitMessage` 函式簽章改為接受 `provider` 參數（第一個引數），依 `provider === 'groq'` 分派至 `_callGroq()`（使用 `groq-sdk`，model `llama-3.3-70b-versatile`）或 `_callGemini()`（維持原 `@google/genai` 邏輯）。兩者回傳相同結構 `{ success, message | error }`。驗證：以 `provider = 'groq'` 及有效 Groq API Key 呼叫，確認回傳 `{ success: true, message: <非空字串> }`。

- [x] 7.3 更新 `svn-merge-helper/src/main/config-manager.js`：在 `createDefaultConfig()` 與 `load()` 正規化邏輯中新增 `aiGroqApiKey: ''` 與 `aiProvider: 'groq'`（預設），確保舊 config.json 讀取時不遺失這兩個欄位。驗證：刪除 `%APPDATA%\Code7\config.json` 後啟動，確認 `config.aiProvider === 'groq'` 且 `config.aiGroqApiKey === ''`。

- [x] 7.4 更新 `svn-merge-helper/src/main/main.js` 的 `ai:generate-commit-message` IPC 處理器，依 `config.aiProvider` 決定使用 `config.aiApiKey`（Gemini）或 `config.aiGroqApiKey`（Groq），並將 `provider` 作為第一個引數傳入 `AiService.generateCommitMessage()`。驗證：選擇 Groq provider 並設定 API Key 後點擊 AI 生成，確認不再回傳 Gemini 的 `FAILED_PRECONDITION` 錯誤。

- [x] 7.5 更新 `svn-merge-helper/src/renderer/index.html` Settings overlay 的「AI 訊息生成」區塊：新增 `#ai-provider` 下拉選單（Groq 為第一選項），新增 `#ai-groq-key-group`（含 `#ai-groq-api-key` 與 `#btn-save-ai-groq-key`），原 Gemini key group 加上 `id="ai-gemini-key-group"`，兩組互斥顯示。驗證：開啟 Settings，確認下拉預設顯示 Groq，且只有 Groq API Key 欄位可見。

- [x] 7.6 更新 `svn-merge-helper/src/renderer/js/settings.js` 的 `initAiSettings()` 與 `open()`：(a) 綁定 `#ai-provider` `change` 事件，切換時更新 `this._config.aiProvider`、切換 key group 顯示、自動儲存；(b) 新增 `#btn-save-ai-groq-key` 點擊事件儲存 `aiGroqApiKey`；(c) `open()` 中填入 `#ai-provider`、`#ai-groq-api-key` 初始值並依 provider 控制 group 顯示。驗證：切換 provider 後重開 Settings，確認選擇與 key 值均持久化。

## 8. 預設提示詞更新

- [x] 8.1 將 `svn-merge-helper/src/main/config-manager.js` 的 `DEFAULT_COMMIT_PROMPT` 改為遵循 Conventional Commits 規範的提示詞，格式為 `<type>: <subject>`，列出 feat/fix/refactor/style/chore/docs/test/perf 等 type，要求繁體中文 subject、動詞開頭、不超過 50 字、只輸出 commit message 本身。同步更新 `settings.js` 的「恢復預設提示詞」按鈕 hardcoded 字串。驗證：點擊「恢復預設提示詞」後，textarea 顯示包含 `feat：新功能` 等條目的 Conventional Commits 格式提示詞。
