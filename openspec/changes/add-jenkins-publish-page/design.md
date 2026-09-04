## Context

Code7 目前有「合併」與「提交」兩個主頁面，由 src/renderer/js/app.js 的 ViewSwitcher 以 nav-merge-view / nav-commit-view 按鈕切換，並將 #merge-view / #commit-view 容器的 display 在 flex 與 none 間切換，最後選擇的頁面記在 localStorage 的 code7-last-view。

主程序既有的外部 API 封裝樣板是 src/main/ai-service.js：純函式、回傳 { success, error } 或 { success, ...data }，由 main.js 以 ipcMain.handle 包裝，preload.js 透過 contextBridge 曝露為 window.svnApi.*。使用者設定由 src/main/config-manager.js 的 createDefaultConfig() 定義欄位、load() 逐欄位補預設值，settings.js 提供設定面板 UI。

團隊的 Jenkins 位於 http://192.168.51.85:8080（HTTP 明碼、需登入）。發布相關 job 集中在名為「方舟_Main_主任務」的 view 下（如「發布方舟」「發布方舟Plus」「構建_方舟站點」「重啟IIS」），job 會隨團隊需要增刪。部分 job 為帶參數建置，參數型別涵蓋 Choice、String、Text（多行）、Boolean，且每個參數帶一段 HTML description 說明文字。

## Goals / Non-Goals

**Goals:**

- 在 app 內新增「發布」頁面，列出設定 view 底下的所有 job（動態，不寫死）。
- 選 job 後依其參數定義動態產生表單，送出即觸發 Jenkins 帶參數建置。
- 觸發後於頁面內輪詢建置狀態（排隊中 → 建置中 → 成功／失敗），可展開 console log。
- Jenkins 連線資訊（Base URL、使用者、API Token、View 名稱）由設定面板輸入並存於 config.json。
- 所有 Jenkins HTTP 溝通集中在主程序單一模組，錯誤形狀與 ai-service.js 一致。

**Non-Goals:**

- 不解析參數 description 內的自由文字對照表，僅原樣顯示 HTML。
- 不支援多組 Jenkins server 或多個 view。
- 不支援在 app 內管理（建立／編輯／刪除）job 或參數。
- 不支援 HTTPS 憑證驗證流程、SSO、OAuth；僅 basic auth + crumb。
- 不加密 API Token（沿用 aiApiKey 明碼慣例）。
- 不做批次觸發、排程、取消建置。

## Decisions

### 決策一：Jenkins 溝通集中於主程序 jenkins-service.js，使用 Node 內建 fetch

所有對 Jenkins 的 HTTP 請求（列 job、取參數、觸發建置、查 queue、查 build、取 console）都放在 src/main/jenkins-service.js，匯出純函式。渲染層一律透過 IPC 呼叫，不直接發網路請求。

理由：

- 渲染層直接 fetch 跨網域會受 CORS 阻擋，且會把 API Token 暴露在渲染程序。
- 主程序的 Electron 內建 Node 已有全域 fetch，無需新增 axios 之類依賴，符合專案精簡依賴的慣例。
- 與既有 ai-service.js 的分層一致，維護心智負擔低。

替代方案：在渲染層用 fetch 搭配主程序設 webRequest 改 header —— 被否決，Token 外洩風險且違反既有分層。

### 決策二：認證採 basic auth（使用者加 API Token），寫入 Authorization header

每個請求帶 Authorization: Basic base64(user:token)。API Token 由使用者在 Jenkins 個人設定頁產生後貼進 Code7 設定面板。

理由：Jenkins 原生支援以 API Token 走 basic auth 呼叫 REST API，不需要維護 session cookie；比抓登入頁 CSRF 再送帳密穩定。

替代方案：帳號密碼登入取得 cookie —— 被否決，需處理 session 逾期與登入頁改版。

### 決策三：以 crumb 通過 CSRF 保護，僅 POST 請求需要

觸發建置前先 GET /crumbIssuer/api/json 取得 crumbRequestField 與 crumb，於 POST /job/<job>/buildWithParameters 帶上該 header。crumb 在單次 triggerBuild 呼叫內即時取得，不跨呼叫快取。GET 類請求（列 job、取參數、查狀態）不需 crumb。

理由：Jenkins 預設開啟 CSRF 保護，POST 無 crumb 會回 403。即時取得可避免 crumb 過期問題，成本僅多一次輕量請求。

替代方案：程序啟動時取一次並快取 —— 被否決，crumb 會隨 session 失效，且發布動作不頻繁。

### 決策四：Job 清單來源為 view API，每次進入頁面重新抓取

GET /view/<viewName>/api/json?tree=jobs[name,url,color]，回傳結果直接渲染，不做本地快取。使用者可手動按「重新整理」再抓一次。

理由：job 會被團隊增刪，寫死或快取會產生與 Jenkins 不一致的清單。view API 一次回傳整個 view 的 job，符合「所有 job」需求。

替代方案：GET /api/json?tree=jobs[...] 取全站 job —— 被否決，會混入其他團隊的 job，雜訊過多。

### 決策五：依 parameterDefinitions 型別動態產生表單控件

GET /job/<job>/api/json?tree=property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]。依 type 對應：

| Jenkins type | 控件 | 值來源 |
| --- | --- | --- |
| ChoiceParameterDefinition | select | choices 陣列 |
| BooleanParameterDefinition | checkbox | defaultParameterValue.value |
| StringParameterDefinition | input type=text | defaultParameterValue.value |
| TextParameterDefinition | textarea | defaultParameterValue.value |
| 其他未知 type | input type=text 加註「未支援型別，以文字送出」 | 空字串 |

每個參數的 description 以 innerHTML 呈現於控件上方（Jenkins 本身也是輸出 HTML）。若 job 無參數（property 無 parameterDefinitions），直接顯示「此 job 無參數，將直接觸發建置」並改呼叫 /job/<job>/build。

理由：涵蓋截圖中出現的所有型別；未知型別以文字保底避免整頁壞掉。

### 決策六：建置狀態輪詢分三階段，由渲染層以固定間隔驅動

送出後：

1. triggerBuild 回傳 POST response 的 Location header（queue item URL）。
2. 渲染層每 3 秒呼叫 jenkins:queue-status，主程序 GET <queueUrl>api/json，直到出現 executable.number（拿到 build number）或 cancelled 為真。
3. 拿到 build number 後，每 3 秒呼叫 jenkins:build-status，主程序 GET /job/<job>/<n>/api/json?tree=building,result,duration,timestamp，直到 building 為 false。
4. 全程可展開 console：jenkins:console 呼叫 GET /job/<job>/<n>/logText/progressiveText?start=<offset>，用回應的 X-Text-Size 當下次 start，X-More-Data 為 false 時停止。

輪詢間隔 3 秒為常數。頁面切走或觸發新建置時清除既有 interval。

理由：Jenkins 無 webhook 回推到桌面 app 的機制，輪詢是唯一選項。3 秒兼顧即時性與伺服器負載。progressiveText 是 Jenkins 官方的漸進式 log 端點，避免每次抓整份。

替代方案：主程序用 setInterval 主動推 IPC event —— 可行但被否決，渲染層驅動較容易隨頁面生命週期管理。

### 決策七：Jenkins 設定存於 config.json，設定面板新增獨立區塊

config-manager.js 的 createDefaultConfig() 與 load() 新增四個欄位：

- jenkinsBaseUrl（預設空字串）
- jenkinsUser（預設空字串）
- jenkinsToken（預設空字串）
- jenkinsViewName（預設 "方舟_Main_主任務"）

settings.js 在設定面板新增「Jenkins 發布」區塊，四個輸入欄位，比照現有 aiApiKey 的讀寫方式（load 時填入、save 時寫回 config 物件）。

理由：與現有設定機制一致；預設 view 名稱填團隊目前實際使用的值，降低初次設定成本。

### 決策八：統一錯誤形狀與錯誤碼常數

所有 jenkins-service.js 匯出函式回傳 { success: true, ... } 或 { success: false, error: <code 或 message> }。定義錯誤碼常數：CONFIG_MISSING（未設定 Base URL／使用者／Token）、AUTH_FAILED（401／403）、NOT_FOUND（404，job 或 view 不存在）、NETWORK_ERROR（連線失敗／逾時）、CRUMB_FAILED（取 crumb 失敗）。渲染層依錯誤碼顯示對應的中文 toast。

理由：對齊 ai-service.js 的 API_KEY_MISSING / EMPTY_RESPONSE 風格，讓渲染層能穩定分支處理。

## Implementation Contract

### IPC channel（main.js 註冊，preload.js 曝露為 window.svnApi 之下）

| Channel | 參數 | 回傳 |
| --- | --- | --- |
| jenkins:list-jobs | （無） | { success, jobs: [{ name, url, color }] } 或 { success:false, error } |
| jenkins:get-params | jobName | { success, hasParams, params: [{ name, type, description, defaultValue, choices }] } |
| jenkins:trigger | jobName, params | { success, queueUrl } 或 { success:false, error } |
| jenkins:queue-status | queueUrl | { success, state: queued 或 running 或 cancelled, buildNumber? } |
| jenkins:build-status | jobName, buildNumber | { success, building, result: SUCCESS 或 FAILURE 或 ABORTED 或 null, durationMs, timestamp } |
| jenkins:console | jobName, buildNumber, start | { success, text, nextStart, hasMore } |

- 無參數 job 時 hasParams 為 false、params 為空陣列；jenkins:trigger 對無參數 job 改打 /job/<job>/build。
- Job 名稱在組 URL 時以 encodeURIComponent 編碼（中文 job 名）。

### config.json 新增欄位

jenkinsBaseUrl、jenkinsUser、jenkinsToken、jenkinsViewName，型別皆為 string，預設值見決策七。load() 對舊設定檔缺欄位時補預設值，不得拋錯。

### UI 行為

- 主導覽列新增「發布」按鈕（id 為 nav-publish-view），ViewSwitcher 納入 publish-view，localStorage 的 code7-last-view 可記為 publish-view。
- 進入頁面時：未設定 jenkinsBaseUrl／jenkinsUser／jenkinsToken 任一 → 顯示提示與「前往設定」按鈕，不發請求。
- 設定完整 → 自動呼叫 jenkins:list-jobs，以清單（含 job 名稱、上次建置結果色塊）呈現，提供「重新整理」按鈕。
- 點 job → 呼叫 jenkins:get-params，動態產生表單；下方「觸發建置」按鈕。
- 觸發後 → 表單區下方出現進度區塊：目前階段（排隊中／建置中 #N／成功／失敗）、耗時、可展開的 console log 區。
- 錯誤 → 依錯誤碼以既有 toast 機制顯示中文訊息（CONFIG_MISSING → 「請先在設定填寫 Jenkins 連線資訊」等）。

### 驗收標準

- 設定填入正確的 Base URL／使用者／Token／View 後，進入發布頁能看到該 view 底下所有 job（與 Jenkins 網頁一致，數量相符）。
- 點「發布方舟」能看到 Version（下拉，選項與 Jenkins 一致）、TargetEnvironment（文字）、TargetCompanyIds（文字，帶預設值）、TargetTradingBackendId（多行）、各 Deploy 開頭的布林核取方塊，且每欄上方顯示其 description。
- 填妥參數並觸發後，進度區塊依序顯示「排隊中」→「建置中 #N」→ 終態（「成功」或「失敗」），與 Jenkins 建置歷史結果一致。
- 展開 console log 能看到與 Jenkins 該次建置 Console Output 相同的內容（可略有輪詢延遲）。
- Token 錯誤時顯示「Jenkins 認證失敗，請檢查使用者名稱與 API Token」，不觸發建置。
- 舊 config.json（無 jenkins 開頭欄位）載入後 app 正常啟動，發布頁顯示未設定提示。

### 範圍邊界

**In scope：** 上述 IPC、jenkins-service.js、publish-manager.js、#publish-view 標記與樣式、ViewSwitcher 擴充、config-manager.js 四欄位、settings.js Jenkins 區塊、preload.js 曝露。

**Out of scope：** 參數 description 解析、多 server／多 view、job 管理、建置取消、Token 加密、單元測試框架導入（專案目前無測試基建，以手動驗收為準）。

## Risks / Trade-offs

- [Jenkins 為 HTTP 明碼，API Token 於內網明文傳輸] → 屬團隊既有現狀；文件註明，不在本次處理。
- [輪詢固定 3 秒，長時間建置會產生數十次請求] → 請求皆為輕量 tree 查詢；頁面切走即停止輪詢，可接受。
- [未知參數型別以文字送出可能造成建置失敗] → UI 明確標註「未支援型別」，讓使用者知悉風險；涵蓋範圍已含截圖所有型別。
- [view 名稱含中文，URL 編碼或 Jenkins 設定差異可能導致 404] → 以 encodeURIComponent 編碼，並在 NOT_FOUND 錯誤訊息提示「找不到 View，請確認設定的 View 名稱」。
- [description 以 innerHTML 直接渲染，理論上有 XSS 風險] → 內容來源為團隊自建 Jenkins，信任邊界內；桌面 app 無 cookie 竊取面，風險極低。若日後要強化可導入 sanitizer。
- [Electron Node 版本若過低無全域 fetch] → 專案 electron 版本已遠高於對應門檻；建置時若失敗會立即發現。

## Open Questions

- Jenkins 是否對 API Token 也強制要求 crumb？（部分版本 API Token 可豁免）→ 實作時先一律帶 crumb，最保險；若取 crumb 失敗則退回不帶 crumb 重試一次 POST。
- 其他 job（如「發布方舟Plus」）的參數型別是否有截圖未涵蓋的（如 Extended Choice）→ 以決策五的「未知型別保底」處理，實測後再視情況補強。
