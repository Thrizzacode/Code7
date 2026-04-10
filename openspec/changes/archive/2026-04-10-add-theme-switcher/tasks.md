## Theme Management

- [x] 1.1 增加 `[data-theme="physicam"]` 設定區塊，重新定義 `--accent`, `--accent-hover`, 與 `--accent-soft` 為對應的紅色系數值。(implements Requirement: Theme Management)
- [x] 1.2 增加 `[data-theme="technolom"]` 設定區塊，將前述變數覆寫為藍色系。
- [x] 1.3 增加 `[data-theme="esprim"]` 設定區塊，將前述變數覆寫為綠色系。
- [x] 1.4 增加 `[data-theme="paradigm"]` 設定區塊，將前述變數覆寫為紫色系。
- [x] 1.5 增加 `[data-theme="inazuma"]` 設定區塊，將前述變數覆寫為金黃色系。
- [x] 1.6 在 CSS 加入主題選單中各個色塊小圓點 (或小方塊) 的必要樣式，例如 `.theme-swatch`。

## 2. 配置管理 (src/main/config-manager.js)

- [x] 2.1 修改 `createDefaultConfig()` 方法，加入預設屬性 `theme: 'physicam'`。
- [x] 2.2 在 `ConfigManager.load()` 中確保回傳的設定檔物件物件包含合法的 `theme` 屬性。

## 3. UI 呈現 (src/renderer/index.html)

- [x] 3.1 在 `<header class="top-bar">` 右側區段 (`.top-bar-right`) 新增一個自訂的下拉選單 (類似原有的 dropdown)，用來展示 5 個主題選項。
- [x] 3.2 下拉選單內的每個選項都需包含一個顯示該主色的色塊預覽區 (swatch) 與主題名稱。

## 4. 邏輯整合 (src/renderer/js/app.js & js/settings.js)

- [x] 4.1 建立切換主題的事件監聽，當使用者點選選單不同選項時，立即更新 `document.documentElement.setAttribute('data-theme', ...)`。
- [x] 4.2 切換後，透過 `window.svnApi.saveConfig(config)` 將選擇寫入本地端配置檔。
- [x] 4.3 在 `App.init()` 或設定初始化階段，實作讀取當前 `config.theme` 並套用至畫面。

## Dark/Light Mode Management

- [x] 5.1 在 `main.css` 定義 `[data-mode="light"]` 的全局變數以覆寫原有在 `:root` 設定的深色背景調性。(implements Requirement: Dark/Light Mode Management)

- [x] 5.2 於 `main.css` 為每一個主題分別再加上淺色模式下的特有背景調性修飾（如 `[data-mode="light"][data-theme="physicam"]`）。
- [x] 5.3 在 HTML 的主題下拉選單旁加入切換深色/淺色模式的按鈕 (`#btn-mode-toggle`)。
- [x] 5.4 新增 `ModeController` 處理按鈕點擊，即時更新元件的提示標題、按鈕 icon (🌙 / ☀️) 以及 `data-mode` 屬性。
- [x] 5.5 修改 `ConfigManager` 以支援預設 `mode: 'dark'` 的載入與儲存，並讓 `ModeController` 將模式選擇連動存檔至 `config.json`。
- [x] 5.6 於 `ModeController` 實作基於 `localStorage` 的 `restoreEarly()`，在 `App.init` 第一步被呼叫，避免因為 Config IPC 讀取時差造成畫面閃動的問題。
