---
name: svn-merge-helper-release
description: Automates the version bump, async build, commit, and tagging process for releasing svn-merge-helper.
---

# svn-merge-helper-release

## Purpose
Automates the release and build workflow for the `svn-merge-helper` application. This is explicitly triggered when the user requests a new release.

## When to Use This Skill
- When the user asks to release the app, for example: "幫我發版", "Help me release", "release svn-merge-helper", or similar phrases.

## Step-by-Step Instructions

When this skill is triggered, please strictly follow these ordered steps:

### 1. Update Version and Documentation
- Analyze the recent unreleased changes to determine the semantic version bump (Major, Minor, or Patch), or simply ask the user what the new version should be.
- Read `svn-merge-helper/package.json` to find the current version.
- Use the `replace_file_content` tool to update the `"version"` field in `svn-merge-helper/package.json` to the `<NEW_VERSION>`.
- Based on the recent changes, update `svn-merge-helper/CHANGELOG.md` with the new version and its release notes.
- Based on the recent changes, update `svn-merge-helper/confluence.html` with the new version and relevant documentation updates.

### 2. Execute Async Build (`npm run build:win`)
- Use the `run_command` tool to execute `npm run build:win`.
- **Directory:** Set `Cwd` to the `svn-merge-helper` directory.
- **Asynchronous Execution:** Set `WaitMsBeforeAsync` to a low value (e.g., `500` ms) so that the build command is sent to the background and the agent is not blocked.

### 3. Commit and Push
- Use `run_command` to stage the modified files: `git add svn-merge-helper/package.json svn-merge-helper/CHANGELOG.md svn-merge-helper/confluence.html` and any other relevant files.
- Commit the change: `git commit -m "chore(release): bump version to <NEW_VERSION>"`
- Push the commit to the remote repository: `git push`

### 4. Tag and Push Tag
- Create a Git tag for the new version: `git tag v<NEW_VERSION>` (adjust the `v` prefix based on the project's historical tagging convention).
- Push the specific tag to the remote repository: `git push origin v<NEW_VERSION>` (or `git push --tags`).
- Inform the user that the release steps and Git operations are complete, and that the async build is currently running in the background.

## Background Monitoring (Optional)
- You can use the `command_status` tool using the command ID returned from step 2 to report back to the user whether the build completed successfully.
