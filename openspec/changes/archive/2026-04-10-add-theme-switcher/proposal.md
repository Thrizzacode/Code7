## Why

為了讓使用者能個人化應用程式的外觀，我們需要加入佈景主題 (Theme) 切換的功能。提供多種顏色選項能帶來更符合個別使用者偏好的視覺體驗。

## What Changes

- 在應用程式的上方導覽列 (Top Bar) 中，加入一個新的下拉選單來切換主題。
- 該選單將提供 5 個預設的主題選項 (PHYSICAM、TECHNOLOM、ESPRIM、PARADIGM、INAZUMA)，每一個選項皆會顯示對應主題主色的色塊預覽與名稱。
- 在主題下拉選單旁新增一個深色/淺色模式 (Dark/Light Mode) 切換按鈕，點擊可即時切換應用程式背景的明暗基調。
- 主題切換的運作方式是透過 `data-theme` 屬性來選擇性覆寫應用程式原有的主要強調色 (`--accent` 的 CSS 變數) 以及各層級的背景色調；而明暗模式則透過 `data-mode="light"` 覆寫基礎顏色。
- 預設主題為 PHYSICAM (紅色)，預設模式為 dark (深色)。
- 使用者切換的主題與明暗模式將會被寫入本機設定，並透過 `ConfigManager` 儲存於 `config.json`，於每次開啟時重新套用。更進一步地，明暗模式會額外儲存於 `localStorage` 中，以確保在非同步機制讀出設定前，應用程式在閃爍前就能立刻還原先前的畫面顯示狀態。

## Capabilities

### New Capabilities

- `theme-management`: 應用程式 UI 佈景主題與色彩變更的管理，允許使用者於五個介面主題中進行無縫切換，並自動記憶偏好設定。

### Modified Capabilities

(none)

## Impact

- Affected specs: `theme-management`
- Affected code: 
  - `src/renderer/index.html`
  - `src/renderer/styles/main.css`
  - `src/renderer/js/app.js`
  - `src/main/config-manager.js`
