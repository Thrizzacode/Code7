## 1. Revision Multi-selection Updates

- [x] 1.1 實作 Requirement: Revision multi-selection - 移除 `revision-picker.js` 中 `isMerged` 為 true 時的 checkbox `disabled` 屬性。
- [x] 1.2 實作 Requirement: Revision multi-selection - 移除 `revision-tbody` 點擊事件監聽器中對 `.merged` 元素的 `return` 阻斷邏輯，開放手動選取。
- [x] 1.3 實作 Requirement: Revision multi-selection - 修改 `Select All` 邏輯，確保全選操作只會選取目前可見且尚未合併 (`eligible`) 的 Revision，不會選中已合併的項目。
- [x] 1.4 實作 Requirement: Revision multi-selection - 改進已合併列的選取視覺：取消 `not-allowed` 游標，並在選取時增加橘色背景與提示邊條。

## 2. Revision Filtering Updates

- [x] 2.1 實作 Requirement: Revision filtering - 在 `_getVisibleRevisions()` 中加入 `RegExp` 支援，讓使用者能使用正規表達式（如 `Henshin1|Henshin2`）進行複雜條件過濾。
- [x] 2.2 實作 Requirement: Revision filtering - 加入 `try-catch` 保護機制，當使用者輸入不合法的正規表達式時，避免系統崩潰，並自動退回普通的字串包含比對。
- [x] 2.3 實作 Requirement: Revision filtering - 加入 UI 提示，當偵測到不合法的 RegExp 時，觸發警告提示 (Tooltip/Toast) 告知使用者語法異常。
- [x] 2.4 實作 Requirement: Revision filtering - 搜尋框內新增 `ℹ️` 圖示與 Hover Tooltip，顯示常用的 Regex 範例說明。
