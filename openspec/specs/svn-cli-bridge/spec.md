# svn-cli-bridge Specification

## Purpose

TBD - created by archiving change 'init-svn-viewer'. Update Purpose after archive.

## Requirements

### Requirement: SVN command execution wrapper

The system SHALL provide a unified module (`SvnBridge`) that wraps all SVN CLI interactions. The wrapper SHALL be enhanced to parse granular file statuses and execute selective commits.

#### Scenario: Granular Status Parsing

- **WHEN** the system calls `SvnBridge.status(path)`
- **THEN** the system SHALL execute `svn status --xml <path>`
- **AND** the system SHALL return the comprehensive list of statuses, correctly identifying if a file is modified, unversioned, added, deleted, or conflicted, making these statuses distinguishable to the consuming module.

#### Scenario: Selective Commit with Array of Files

- **WHEN** the system calls `SvnBridge.commit(wcPath, message, filesArray)` and `filesArray` is provided
- **THEN** the system SHALL construct and execute an `svn commit -m <message> <file1> <file2> ...` command targeting only the specified files within `wcPath`.

#### Scenario: Committing Unversioned Files

- **WHEN** the system calls `SvnBridge.commit(wcPath, message, filesArray)` and the `filesArray` includes entries that are currently unversioned
- **THEN** the system SHALL automatically isolate these unversioned entries and execute `svn add <unversioned-files...>` prior to the main commit execution
- **AND** the system SHALL subsequently proceed to commit the full `filesArray`, including the newly added files.


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
### Requirement: SVN CLI availability check

The system SHALL verify that the `svn` CLI is available and accessible on the system PATH at application startup.

#### Scenario: SVN CLI available

- **WHEN** the application starts and `svn --version` executes successfully
- **THEN** the system SHALL proceed to the main interface
- **THEN** the system SHALL store the detected SVN version for display in the application

#### Scenario: SVN CLI not found

- **WHEN** the application starts and `svn --version` fails with a "command not found" error
- **THEN** the system SHALL display a blocking error screen with instructions to install SVN CLI or add it to the system PATH
- **THEN** the system SHALL provide a "Retry" button to re-check

---
### Requirement: Error handling and reporting

All SVN command failures SHALL be captured and presented to the user with actionable information.

#### Scenario: Authentication failure

- **WHEN** an SVN command fails with an authentication error
- **THEN** the system SHALL display: "SVN authentication failed. Please check your SVN credentials."

#### Scenario: Network error

- **WHEN** an SVN command fails due to network connectivity
- **THEN** the system SHALL display: "Cannot connect to SVN server. Please check your network connection."

#### Scenario: Generic SVN error

- **WHEN** an SVN command fails with an unrecognized error
- **THEN** the system SHALL display the raw stderr output from the SVN command
- **THEN** the system SHALL provide a "Copy Error" button to copy the full error to clipboard

---
### Requirement: Execute svn list
The system SHALL provide a method `SvnBridge.list(svnUrl)` to retrieve the subdirectory listing of a remote repository path.

#### Scenario: Execute svn list on directory
- **WHEN** the system calls `SvnBridge.list(svnUrl)`
- **THEN** the system SHALL execute `svn list --xml <svnUrl>`
- **THEN** the system SHALL parse the XML output into an array of subdirectory names
- **THEN** THE system SHALL filter entries to include only those where `kind="dir"`

<!-- @trace
source: remote-version-listing
updated: 2026-04-08
code:
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/main/config-manager.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/CHANGELOG.md
-->

---
### Requirement: SVN diff command for specified files

The system SHALL provide a `SvnBridge.diff(filePaths)` method that executes `svn diff` against an explicit list of file paths and returns the combined diff output as a string.

The method SHALL accept only versioned files. Callers are responsible for filtering out unversioned files before invoking this method.

The method SHALL truncate the returned diff text to a maximum of 8000 characters. When truncation occurs, the system SHALL append the suffix `\n[... diff 已截斷，僅顯示前 8000 字元 ...]` to the returned string.

#### Scenario: Diff for a list of versioned files

- **WHEN** the system calls `SvnBridge.diff(filePaths)` with one or more versioned file paths
- **THEN** the system SHALL execute `svn diff <file1> <file2> ...`
- **AND** the system SHALL return `{ success: true, diff: string }`

#### Scenario: Diff result exceeds size limit

- **WHEN** the combined diff output exceeds 8000 characters
- **THEN** the system SHALL return a `diff` string truncated to 8000 characters
- **AND** the returned string SHALL end with `\n[... diff 已截斷，僅顯示前 8000 字元 ...]`

#### Scenario: Empty file list provided

- **WHEN** the system calls `SvnBridge.diff([])` with an empty array
- **THEN** the system SHALL return `{ success: true, diff: "" }` without executing any SVN command

#### Scenario: SVN diff command fails

- **WHEN** the `svn diff` execution fails (e.g., path error or SVN not accessible)
- **THEN** the system SHALL return `{ success: false, error: string }` with the error message

<!-- @trace
source: ai-commit-message-generation
updated: 2026-06-02
code:
  - svn-merge-helper/src/renderer/js/merge-context.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/test-merge-tool.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/preload/preload.js
-->