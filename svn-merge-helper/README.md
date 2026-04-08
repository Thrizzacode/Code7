# SVN Merge Helper

專為公司專案設計的 SVN Merge 輔助桌面工具，簡化 `branches → qat → stg` 的合併流程。

## 系統需求

- **Node.js** 18+
- **SVN CLI** — `svn` 指令需可在命令列中使用（請確認已加入系統 PATH）
- **TortoiseSVN**（選配）— 用於衝突解決時啟動 TortoiseMerge

## 安裝與開發

```bash
# 安裝依賴
npm install

# 啟動開發模式
npm run dev

# 啟動正式模式
npm start
```

## 使用指南

### 1. 首次設定

首次啟動時，應用程式會引導您新增專案設定：

- **專案名稱**：例如 `Fz_Company`
- **Working Copy 根目錄**：本機 SVN Working Copy 的路徑
- **Repository URL**：SVN Repository 的 URL
- **版本列表**：用逗號分隔版本號，例如 `1.9.0, 1.10.0`
- **路徑模板**：預設已填入標準模板，可依專案需求修改

### 2. 合併操作

1. 從頂部下拉選單選擇專案
2. 在左側選擇**來源**（Source）的環境與版本
3. 在右側選擇**目標**（Target）的環境與版本
4. 從下方的 Revision 列表勾選要合併的 Commit
5. 點擊「執行合併」按鈕

### 3. 衝突處理

若合併過程中發生衝突：

1. 應用程式會列出所有衝突檔案
2. 點擊「使用外部工具解決」啟動 TortoiseMerge
3. 在外部工具中解決衝突後關閉
4. 應用程式會自動偵測並標記已解決的檔案
5. 所有衝突解決後即可提交

### 4. 標準合併流程

```
branches/{version}  →  qat (trunk/05-Code-{version})  →  stg (trunk/05-Code-Stage-{version})
```

## 打包

```bash
npx electron-builder
```

產出檔案位於 `dist/` 目錄。

## 發佈與更新

本專案支援自動化更新檢查與發佈。

### 1. 目標版本更新
若要發佈新版本，請依序執行：
1. 修改 `package.json` 中的 `version`（例如 `1.2.0`）。
2. 將變更推送至 GitHub。
3. 建立一個對應版本號的 Git Tag 並推送：
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
4. GitHub Actions 會自動啟動並編譯 Windows 安裝檔，並建立一個新的 Release。

### 2. GitHub Actions 設定
在 GitHub Repository 的 **Settings > Secrets and variables > Actions** 中，需新增一個名為 `GH_TOKEN` 的 Repository Secret，內容為具備 `repo` 權限的 Personal Access Token。

### 3. App 內更新
使用者可以透過以下方式獲得更新：
- **自動檢查**：App 啟動時會自動在背景檢查更新。
- **手動檢查**：在「設定」面板底部的「App 更新」區塊點擊「檢查更新」。
- 下載完成後，點擊「立即重啟並安裝」即可完成升級。

## 技術架構

- **Electron** — Main Process + Preload + Renderer
- **純 HTML/CSS/JS** — 無前端框架
- **SVN CLI** — 透過 `child_process.execFile` 呼叫
- **fast-xml-parser** — 解析 SVN `--xml` 輸出
