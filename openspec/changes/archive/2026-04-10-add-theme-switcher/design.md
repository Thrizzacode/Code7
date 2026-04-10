## Context

目前應用程式將主色系（accent color）寫死在 `main.css` 的 `:root` CSS 變數中，且預設背景為黑色，成功狀態色彩為祖母綠。為了讓使用者能進一步個人化介面，我們計畫加入 5 種預設的主題選項，它們會分別替換這套固定的主色。使用者希望透過上方導覽列的下拉選單即時切換主題，且不會遺失這些設定。

## Goals / Non-Goals

**Goals:**

- 實作五種特定主題：
  - PHYSICAM (紅色系)
  - TECHNOLOM (藍色系)
  - ESPRIM (綠色系)
  - PARADIGM (紫色系)
  - INAZUMA (金黃色系)
  - INAZUMA (金黃色系)
- 實作深色/淺色 (Dark/Light) 模式切換功能。
- 在現有的 Top Bar 實作自訂的下拉選單包含色塊預覽與名稱，並在一旁放置深/淺色切換按鈕。
- 主題與深淺色切換應能即時發生，透過 `data-theme` 與 `data-mode` 覆蓋 CSS 變數達到目的。
- 偏好應透過 `ConfigManager` 存入 `config.json` 加以持久化，其中畫面背景模式更應利用 `localStorage` 做早階級 (early stage) 快取。

**Non-Goals:**

- 不提供自訂色碼選擇器，僅支援前述五種預設主題。
- 不更動基礎字體或排版。

## Decisions

- **主題技術架構**：我們將在 `main.css` 內補充各主題屬性對應的區域，如 `[data-theme="physicam"]` 與 `[data-mode="light"]`。淺色模式會透過 `[data-mode="light"][data-theme="..."]` 做到確保每個主題在明、暗模式下皆有最合適的背景色。
- **配置持久層**：在 `ConfigManager.js` 的設定預設值內加上 `theme: 'physicam'` 與 `mode: 'dark'` 欄位，確保無論是舊用戶或是新匯入都能帶有正確的預設。為解決 `ConfigManager.load()` 非同步 IPC 造成的畫面閃爍問題，在 `ModeController` 實作 `localStorage` 初期載入策略 (`restoreEarly()`)。
- **選單組件**：在 `index.html` 的 `@top-bar` 區段內手刻一個帶有色票的 `.dropdown`，並用 JS 綁定監聽事件處理。

## Risks / Trade-offs

- CSS 檔案擴充：將這 5 種色版的設定直接放入現有的 `main.css` 會使檔案變大，但由於五種主色僅會覆蓋少數的三個變數（accent, accent-hover, accent-soft），新增的行數極少，且便於維護，優雅性大於建立分散的外部 CSS 檔案。
