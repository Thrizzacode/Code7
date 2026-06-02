## 1. 新增共用篩選工具函式

- [x] [P] 1.1 在 `svn-merge-helper/src/renderer/js/utils.js` 的 `Utils` 物件新增 `Utils.filterByRegex(entries, filterText, fields)` 方法，依照設計文件「`Utils.filterByRegex` 的函式簽名」實作：空字串回傳全部、有效 regex 用 regex.test 比對、「regex 失效時的 fallback 行為」為退回純文字並呼叫 Toast（含 module-level 去重 flag）。驗收：在 DevTools console 執行 `Utils.filterByRegex([{revision:'123',author:'john',message:'fix'}], '^12', ['revision','author','message'])` 應回傳該 entry；執行 `Utils.filterByRegex([...], '(bad', [...])` 應回傳全部並顯示 Toast。

## 2. 重構 revision-picker（Search and Filtering）

- [x] [P] 2.1 完成「`revision-picker.js` 的 `_getVisibleRevisions()` 改動」：移除 inline regex 邏輯，改呼叫 `Utils.filterByRegex(this._allRevisions, this._filterText, ['revision', 'author', 'message'])`；同時移除 `this._invalidRegexToastShown` property 的初始化（Toast 去重已移至 Utils）。驗收：在 merge 頁面搜尋欄輸入有效 regex（如 `^r`）及無效 regex（如 `(`），行為與修改前完全相同。

## 3. 強化 log-manager（Search and Filtering）

- [x] [P] 3.1 完成「`log-manager.js` 的 `filter()` 改動」：將現有純文字邏輯替換為 `this._filteredEntries = Utils.filterByRegex(this._logEntries, keyword, ['revision', 'author', 'message'])`，使歷史 dialog 的「Search and Filtering」需求支援正規表達式。驗收條件：開啟歷史 dialog，輸入 `^r` 僅顯示版本號以 r 開頭的紀錄；輸入 `(invalid` 顯示 Toast 並退回純文字搜尋；清空搜尋框恢復全部紀錄。

## 4. 整合驗收

- [x] 4.1 同時開啟 merge 頁面與歷史 dialog，確認兩處搜尋行為一致：有效 regex 正常篩選、無效 regex 顯示 Toast 一次並退回純文字、空字串顯示全部。
