## Context

目前系統在 Commit 頁面僅能查看本地變更，缺乏查看 SVN 歷史紀錄 (Show Log) 的功能。為了提升開發效率，需要整合一個類 TortoiseSVN 的紀錄查看介面。

## Goals / Non-Goals

**Goals:**
- 提供一個功能豐富的 Log 彈窗。
- 支援按路徑（專案或單檔）過濾紀錄。
- 提供記憶體內的 Log 篩選功能（搜尋）。
- 實作延遲加載機制，點擊紀錄後才獲取異動路徑詳情。

**Non-Goals:**
- 不支援跨專案的 Log 查詢。
- 初期不支援分頁滾動自動加載（僅提供「加載下 100 筆」按鈕）。
- 不支援複雜的圖形分支視圖。

## Decisions

- **UI 組件化**：實作一個 `LogManager` 類組件負責渲染與狀態管理，並使用現有的 CSS 變數確保主題一致性。
- **後端 API 複用**：利用現有的 `SvnBridge.log`，但需補齊對 `args` 的解析邏輯，使其支援傳遞 `-v` 或特定版本 `-r`。
- **數據快取**：在 Modal 生命週期內，將獲取到的 LogEntries 存在陣列中，以便搜尋功能可以即時過濾 DOM 元素，而無需與後端通訊。
- **延遲加載 (Lazy Loading)**：點擊 Revision 列表項目後，發送 `svn:log` 請求並帶上 `${revision}` 與 `verbose: true`，抓取該版本的詳細資訊。
- **視覺佈局優化**：日誌彈窗採用 `flex-direction: column` 並以 `flex: 1` 平均分配高度，解決窄屏下詳細資訊區塊被擠壓的風險。
- **差異檢視整合**：透過拼接 `repositoryRoot` 與路徑字串生成完整 URL，利用 `TortoiseProc.exe` 透過 `/startrev` 與 `/endrev` 顯示版本間差異。

## Risks / Trade-offs

- **XML 解析壓力**：巨量 Log 可能導致前端解析 XML 效能下降。解決方案：固定抓取筆數 (limit 100)。
- **路徑格式**：確保在不同作業系統下呈現的路徑統一為 `/`。
