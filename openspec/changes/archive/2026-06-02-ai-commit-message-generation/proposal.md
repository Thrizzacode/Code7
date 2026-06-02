## Why

開發人員在進行 SVN 提交時，手動撰寫具意義的 commit message 費時且品質不穩定。透過串接 AI API，可以根據選取檔案的變更差異自動生成符合團隊規範的提交訊息，提升開發效率與訊息一致性。初期使用 Gemini，後因台灣地區受 Gemini API 地理限制（FAILED_PRECONDITION），擴充支援 Groq 作為備選 AI 提供者，並改為預設選項。

## What Changes

- 提交頁面（commit tab）新增「✨ AI 生成」按鈕，僅在有選取檔案時啟用
- 點擊按鈕後，系統對選取的已版本控制檔案執行 `svn diff`，連同檔案清單送給 AI 提供者生成訊息
- 生成的訊息自動填入 commit message 欄位，使用者可自行修改後提交
- 設定頁面新增「AI 訊息生成」區塊，包含：
  - AI 提供者下拉選單（Groq 預設、Google Gemini 備選）
  - 對應提供者的 API Key 輸入欄位（切換時互斥顯示）
  - 可自訂提示詞與「恢復預設提示詞」按鈕
- 預設提示詞遵循 Conventional Commits 規範（`<type>: <subject>` 格式）
- Config schema 擴充 `aiApiKey`、`aiGroqApiKey`、`aiProvider`、`aiCommitPrompt` 四個欄位
- SVN CLI 橋接層新增 `diff()` 方法，支援對多個指定檔案執行差異比對
- `ai-service.js` 依 `provider` 參數分派至 Gemini（`@google/genai`）或 Groq（`groq-sdk`）

## Capabilities

### New Capabilities

- `ai-commit-message-generation`: 透過可選 AI 提供者（Groq / Gemini）根據選取檔案的 diff 與狀態，自動生成 SVN commit message 的完整功能，包含主程序 AI 服務模組、IPC 通道、與渲染層的按鈕互動邏輯

### Modified Capabilities

- `standalone-commit`: 提交介面新增 AI 生成按鈕，以及對應的啟用/停用規則（需有選取檔案）
- `project-config`: Config schema 擴充 `aiApiKey`、`aiGroqApiKey`、`aiProvider`（預設 `'groq'`）、`aiCommitPrompt` 四個欄位，並提供遵循 Conventional Commits 的預設提示詞常數
- `svn-cli-bridge`: 新增 `diff(filePaths)` 方法，對指定已版本控制的檔案執行 `svn diff`，回傳差異文字（超出 8000 字元自動截斷）

## Impact

- Affected specs: `ai-commit-message-generation`（新增）、`standalone-commit`（修改）、`project-config`（修改）、`svn-cli-bridge`（修改）
- Affected code:
  - New: `svn-merge-helper/src/main/ai-service.js`
  - Modified: `svn-merge-helper/package.json`（新增 `@google/genai`、`groq-sdk`）、`svn-merge-helper/src/main/svn-bridge.js`、`svn-merge-helper/src/main/config-manager.js`、`svn-merge-helper/src/main/main.js`、`svn-merge-helper/src/preload/preload.js`、`svn-merge-helper/src/renderer/index.html`、`svn-merge-helper/src/renderer/js/commit-manager.js`、`svn-merge-helper/src/renderer/js/settings.js`
