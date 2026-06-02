---
name: svn-merge-helper-release
description: Automates the version bump, async build, commit, and tagging process for releasing svn-merge-helper.
---

# svn-merge-helper-release

## 用途

自動化 `svn-merge-helper` 應用程式的發版與建置流程。當使用者明確要求發布新版本時觸發。

## 觸發時機

- 當使用者要求發版時，例如：「幫我發版」、「Help me release」、「release svn-merge-helper」或類似語句。

## 執行步驟

觸發此 skill 後，請嚴格依照以下順序執行：

### 1. 更新版本號與文件

- 分析近期未發布的變更，判斷語意版本應升級的等級（Major、Minor 或 Patch），或直接詢問使用者新版本號。
- 讀取 `svn-merge-helper/package.json` 確認目前版本。
- 使用 `replace_file_content` 工具將 `svn-merge-helper/package.json` 中的 `"version"` 欄位更新為 `<NEW_VERSION>`。
- 根據近期變更，更新 `svn-merge-helper/CHANGELOG.md`，加入新版本與對應的發版說明。
- 根據近期變更，更新 `svn-merge-helper/confluence.html`，加入新版本與相關文件說明。

### 2. 執行非同步建置（`npm run build:win`）

- 使用 `run_command` 工具執行 `npm run build:win`。
- **工作目錄：** 將 `Cwd` 設為 `svn-merge-helper` 目錄。
- **非同步執行：** 將 `WaitMsBeforeAsync` 設為較小的值（例如 `500` ms），使建置指令在背景執行，不阻塞 agent。

### 3. Commit 與 Push

- 使用 `run_command` 暫存已修改的檔案：`git add svn-merge-helper/package.json svn-merge-helper/CHANGELOG.md svn-merge-helper/confluence.html` 以及其他相關檔案。
- 建立 commit：`git commit -m "chore(release): bump version to <NEW_VERSION>"`
- 推送至遠端：`git push`

### 4. 建立 Tag 並推送

- 為新版本建立 Git tag：`git tag v<NEW_VERSION>`（依專案歷史慣例決定是否加 `v` 前綴）。
- 將 tag 推送至遠端：`git push origin v<NEW_VERSION>`（或 `git push --tags`）。
- 告知使用者發版步驟與 Git 操作已完成，非同步建置正在背景執行中。

## 背景監控（選用）

- 可使用步驟 2 回傳的 command ID，透過 `command_status` 工具回報建置是否成功完成。
