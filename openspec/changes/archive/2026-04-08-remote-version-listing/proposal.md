# Proposal: Remote-First Hybrid SVN Discovery

## 問題描述
當前版本的 SVN Merge Helper 僅透過掃描本地檔案系統來識別可用版本。這導致當本地目錄為空時（例如尚未 `svn checkout` 或 `svn update`），UI 會出現「Ghost Version」問題或完全無法顯示伺服器上已存在的版本。

## 解決方案
實作 **Remote-First Hybrid Discovery** 架構：
1. **遠端優先**: 透過 `svn list --xml` 直接查詢 SVN 伺服器獲取權威版本清單。
2. **混合模式**: 合併遠端結果與本地掃描結果，確保即使在離線狀態下也能看到本地緩存的版本。
3. **UI 視覺化**: 為僅存在於遠端的版本添加標誌，並在選取時提供「本地尚未檢出」的警告資訊。

## 變更範圍
- **核心橋接**: 修改 `svn-merge-helper/src/main/svn-bridge.js` 以支援遠端列表獲取。
- **配置管理**: 修改 `svn-merge-helper/src/main/config-manager.js` 實作混合偵測模式。
- **主程序整合**: 修改 `svn-merge-helper/src/main/main.js` 更新 IPC 通道。
- **渲染器組件**: 修改 `svn-merge-helper/src/renderer/js/branch-selector.js` 處理非本地版本顯示。
- **樣式更新**: 修改 `svn-merge-helper/src/renderer/styles/main.css` 添加警告樣式。

## 驗證計畫
- [x] 驗證空目錄情境下能正確顯示遠端路徑。
- [x] 驗證斷網情境下能正常 Fallback 至本地偵測。
- [x] 驗證選取非本地版本後，路徑預覽與警告狀態正確顯示。
