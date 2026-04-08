## Why

現有系統的搜尋功能僅支援單一字串精確比對，無法滿足複雜指令（如多重條件「A 或 B」）的過濾需求；此外，目前已合併的 Commit 雖然有反灰標記，卻強制將 Checkbox 鎖死，這導致在需要緊急覆蓋或 Cherry-pick 重新合併的特殊情況下，使用者無法手動再次進行合併。

## What Changes

- **支援正規表達式搜尋**：讓搜尋欄 (`revision-filter-input`) 能支援標準 Regex (如 `Henshin1|Henshin2`) 查詢。
- **正規表達式幫助圖示**：於搜尋框內新增 `ℹ️` 圖示，滑鼠移入時顯示常用 Regex 範例（如 `A|B`、`^`、`$`）。
- **錯誤輸入保護**：當使用者輸入了不合法的 Regex 語法，系統會自動退回普通字串搜尋，並顯示 Toast 警告提示。
- **解除合併鎖定 (可重複合併)**：拔除已合併 (`merged`) 的 Checkbox 的 `disabled` 屬性，並允許選取。
- **選取狀態強化**：已合併的列在被選取時會恢復亮度 (`opacity: 1`)，並呈現橘色背景與左側提示邊條，清楚標示為「覆蓋/重新合併」狀態。
- **保護全選功能**：修改「全選 (Select All)」的行為，**僅針對未合併 (Eligible)** 的 Revision 進行全選，避免誤傳過多舊紀錄。

## Non-Goals (optional)

- 不會提供複雜的「視覺化過濾器面板」，仍基於單一輸入框。
- 不會改變 SVN CLI 背後的拉取機制。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `revision-picker`: 調整表格的 `disabled` 狀態與 `selectAll` 範圍邏輯。

## Impact

- **Affected code**: 
    - `svn-merge-helper/src/renderer/js/revision-picker.js` (負責顯示邏輯與事件攔截)
    - `svn-merge-helper/src/renderer/index.html` (可能需調整 HTML Tooltip 結構或移除 disabled 屬性)
    - `svn-merge-helper/src/renderer/styles/main.css` (可能需調整 Checkbox 在被選取時的視覺樣式確保能清楚看見) 
