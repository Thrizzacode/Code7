# Remote Version Discovery Design

## Goals
- Provide accurate version lists based on remote repository state.
- Maintain responsiveness by using local scanning as a backup.
- Alert users visually when a selected version is missing from the local workspace.

## Component Design

### SvnBridge 核心橋接
- **路徑**: `svn-merge-helper/src/main/svn-bridge.js`
- **變更**: 實作 `list` 方法與 XML 解析器，獲取遠端 SVN 目錄結構。

### ConfigManager 配置管理
- **路徑**: `svn-merge-helper/src/main/config-manager.js`
- **變更**: 實作 `getEnvVersions` 非同步混合模式，合併遠端與本地版本。

### BranchSelector 渲染器組件
- **路徑**: `svn-merge-helper/src/renderer/js/branch-selector.js`
- **變更**: 處理包含 `presentLocally` 狀態的版本清單，並在 UI 顯示警告標籤。
- **UI State**: Transition to `loading` when environment changes.
- **Handling Data**: Populates dropdown with the merged list.
## 變更範圍
- **核心橋接**: 修改 `svn-merge-helper/src/main/svn-bridge.js` 以支援遠端列表獲取。
- **配置管理**: 修改 `svn-merge-helper/src/main/config-manager.js` 實作混合偵測模式。
- **主程序整合**: 修改 `svn-merge-helper/src/main/main.js` 更新 IPC 通道。
- **渲染器組件**: 修改 `svn-merge-helper/src/renderer/js/branch-selector.js` 處理非本地版本顯示。
- **樣式更新**: 修改 `svn-merge-helper/src/renderer/styles/main.css` 添加警告樣式。
- **Path Resolution**: When a version with `presentLocally: false` is selected, update the path preview with a warning class and tooltip: "This version is not present in your local working copy. It will be fetched remotely during merge/update."

## Data Flow
1. User selects "qat".
2. `BranchSelector` calls `window.svnApi.getEnvVersions(...)`.
3. IPC handler invokes `ConfigManager`.
4. `ConfigManager` queries both Remote and Local.
5. `BranchSelector` receives the results and updates the dropdown.
