# file-preview Specification

## Purpose

TBD - created by archiving change 'add-diff-preview'. Update Purpose after archive.

## Requirements

### Requirement: Local SVN Diff Invocation
The system SHALL support invoking the external TortoiseSVN diff utility for versioned files that have been modified.

#### Scenario: Open Diff for modified file
- **WHEN** user actions a diff request on a file with modified, conflicted, or deleted status
- **THEN** system SHALL execute TortoiseProc.exe to view the diff


<!-- @trace
source: add-diff-preview
updated: 2026-04-14
code:
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/main/svn-bridge.js
-->

---
### Requirement: Local File Open Invocation
The system SHALL support opening unversioned or newly added files directly in the user's default registered text editor or IDE.

#### Scenario: Open unversioned file
- **WHEN** user actions an open request on a file with added or unversioned status
- **THEN** system SHALL execute Electron shell.openPath to open the file

<!-- @trace
source: add-diff-preview
updated: 2026-04-14
code:
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/main/svn-bridge.js
-->