## Why

團隊發布站點時必須手動打開 Jenkins（`192.168.51.85:8080`）、切換到正確的 view、找到對應 job、逐一填寫帶參數建置的表單，再回到建置歷史輪詢結果。流程繁瑣且與 SVN 合併工作分屬兩個工具。把發布能力整合進 Code7，可讓使用者在合併完成後直接於同一應用內觸發並追蹤 Jenkins pipeline，減少切換成本與人為填錯參數的風險。

## What Changes

- 新增第三個主頁面「發布」，與現有「合併」「提交」並列於主導覽列。
- 頁面動態向 Jenkins 拉取指定 view 底下的**所有** job（不寫死清單，反映 Jenkins 上的新增／刪除）。
- 選定 job 後，動態拉取該 job 的參數定義，依參數型別產生對應表單控件：
  - Choice → 下拉選單（使用 `choices`）
  - Boolean → 核取方塊
  - String → 單行輸入
  - Text → 多行文字區
  - 每個參數的 `description` 以原樣 HTML 呈現（不解析其中的機器對照表等自由文字）
- 送出後呼叫 `buildWithParameters` 觸發建置，並在頁面內輪詢：queue item → build number → build 狀態（building / result），可展開檢視 console log。
- 新增 `jenkins-service.js`（主程序）封裝與 Jenkins 的所有 HTTP 溝通，回傳統一的 `{ success, error }` 形狀（比照 `ai-service.js`）。
- 新增一組 `jenkins:*` IPC channel 供渲染層呼叫。
- 設定面板新增「Jenkins」區塊，欄位：Base URL、使用者名稱、API Token、View 名稱；儲存於 `config.json`。

## Non-Goals

- 不解析參數 `description` 內的自由文字（機器／CompanyId 對照表），僅原樣顯示。
- 不支援在 app 內建立、編輯或刪除 Jenkins job 或參數定義。
- 不支援多組 Jenkins server；一次只設定一個 Base URL 與一個 View。
- 不做建置佇列的排程、批次觸發或取消建置。
- 不加密儲存 API Token（比照現有 `aiApiKey` 以明碼存於 `config.json`）。
- 不處理 Jenkins 以 HTTPS／SSO／OAuth 保護的情境；僅支援 basic auth（使用者 + API token）搭配 CSRF crumb。

## Capabilities

### New Capabilities

- `jenkins-publish`: 於應用內瀏覽 Jenkins view 的 job 清單、依 job 參數定義動態產生發布表單、觸發帶參數建置，並輪詢建置狀態與 console log。

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - New: `jenkins-publish`
- Affected code:
  - New:
    - `svn-merge-helper/src/main/jenkins-service.js` — Jenkins HTTP 溝通封裝
    - `svn-merge-helper/src/renderer/js/publish-manager.js` — 發布頁面邏輯與輪詢
  - Modified:
    - `svn-merge-helper/src/main/main.js` — 註冊 `jenkins:*` IPC handler
    - `svn-merge-helper/src/preload/preload.js` — 曝露 `jenkins:*` 給渲染層
    - `svn-merge-helper/src/main/config-manager.js` — 新增 `jenkinsBaseUrl`／`jenkinsUser`／`jenkinsToken`／`jenkinsViewName` 欄位與預設值
    - `svn-merge-helper/src/renderer/index.html` — 新增導覽按鈕與 `#publish-view` 容器
    - `svn-merge-helper/src/renderer/js/app.js` — 導覽切換納入 publish view
    - `svn-merge-helper/src/renderer/js/settings.js` — 設定面板新增 Jenkins 區塊
    - `svn-merge-helper/src/renderer/styles/main.css` — 發布頁面樣式
  - Removed: (none)
- Dependencies: 無新增第三方套件；使用 Node 內建 `fetch`（Electron 內建 Node ≥ 18）。
- IPC：新增 `jenkins:list-jobs`、`jenkins:get-params`、`jenkins:trigger`、`jenkins:queue-status`、`jenkins:build-status`、`jenkins:console`。
