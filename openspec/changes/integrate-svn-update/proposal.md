# Proposal: Integrate SVN Selective Update

## Problem
當前版本的 SVN Merge Helper 雖能識別僅存在於伺服器上的版本，但若使用者選取這些「遠端版本」進行操作（如獲取 Revisions 或執行 Merge），會因為本地工作副本 (Working Copy) 缺少對應目錄而彈出 `svn: E155010: The node ... was not found` 的錯誤。

## Root Cause
本專案通常使用「稀疏檢出 (Sparse Checkout)」來節省空間，僅檢出必要的環境目錄。雖然 Remote Discovery 識別了伺服器上存在的新版本，但 SVN 的 `merge` 指令仍需要在本地有對應的 Target 節點才能執行。目前應用程式缺乏將缺失的伺服器節點「拉取」至本地的手段。

## Proposed Solution
1. **指令層級**: 實作 `svn update --set-depth infinity <local_path>`。此指令能在稀疏檢出環境中精確抓取單一目錄。
2. **橋接層級 (SvnBridge)**: 封裝 `ensureLocalPath` 方法。
3. **UI 層級 (BranchSelector)**:
   - 在路徑預覽區塊偵測到非本地版本時，顯示「📂 同步至本地」按鈕。
   - 同步完成後，自動更新本地狀態標籤。
4. **防呆機制**: 針對尚未在本地同步的版本，暫停或是彈出提示再執行 Merge。

## Success Criteria
- [ ] 選取標註為 `(遠端)` 的版本後，點擊「同步至本地」能正確執行 SVN 更新。
- [ ] 同步完成後，路徑預覽的警告圖示消失。
- [ ] 原本會報錯 `E155010` 的 Merge 操作能順利執行。

## Impact
- **Affected code**: 
  - `svn-merge-helper/src/main/svn-bridge.js`
  - `svn-merge-helper/src/main/main.js`
  - `svn-merge-helper/src/renderer/index.html`
  - `svn-merge-helper/src/renderer/js/branch-selector.js`
  - `svn-merge-helper/src/renderer/styles/main.css`
