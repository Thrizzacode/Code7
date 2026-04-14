# standalone-commit Specification

## Purpose

TBD - created by archiving change 'add-commit-page'. Update Purpose after archive.

## Requirements

### Requirement: Standalone Commit Interface

The system SHALL provide a dedicated, standalone user interface for viewing and selecting local changes to be committed to the repository, independently of the merge workflow.

#### Scenario: Navigating to the Commit View

- **WHEN** the user selects the "Commit" navigation option from the global application interface
- **THEN** the system SHALL switch the main content area to the standalone commit view
- **AND** the system SHALL display the currently selected project and branch information.

#### Scenario: Displaying Workspace Changes

- **WHEN** the standalone commit view becomes active
- **THEN** the system SHALL scan the current project's working directory using the SVN bridge
- **AND** the system SHALL display a list of all detected modifications, including modified, newly added, and deleted files.

#### Scenario: Toggling Unversioned Files Visibility

- **WHEN** the user interacts with the "Show Unversioned files" visibility toggle in the commit interface
- **THEN** the system SHALL respectively show or hide unversioned files in the generated list of changes without requiring a new scan.

#### Scenario: Executing a Selective Commit

- **WHEN** the user inputs a valid commit message, selects specific files from the change list, and initiates the commit action
- **THEN** the system SHALL submit only the selected files to the repository via the SVN bridge
- **AND** after a successful commit, the system SHALL refresh the change list to reflect the new state of the workspace.

<!-- @trace
source: add-commit-page
updated: 2026-04-14
code:
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/main/main.js
-->

---
### Requirement: Interactive File List Preview actions
The commit file list SHALL provide interactive elements to trigger file previews based on file status, and row-click selection events MUST be disabled to avoid conflict with double-click preview triggers.

#### Scenario: Row double-click triggers preview
- **WHEN** user double clicks a row in the commit file table
- **THEN** system SHALL invoke the appropriate preview action for that file's status

#### Scenario: Icon button triggers preview
- **WHEN** user clicks the action icon button in the file list row
- **THEN** system SHALL invoke the appropriate preview action for that file's status

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