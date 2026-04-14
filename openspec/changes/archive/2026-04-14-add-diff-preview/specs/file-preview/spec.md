## ADDED Requirements

### Requirement: Local SVN Diff Invocation
The system SHALL support invoking the external TortoiseSVN diff utility for versioned files that have been modified.

#### Scenario: Open Diff for modified file
- **WHEN** user actions a diff request on a file with modified, conflicted, or deleted status
- **THEN** system SHALL execute TortoiseProc.exe to view the diff

### Requirement: Local File Open Invocation
The system SHALL support opening unversioned or newly added files directly in the user's default registered text editor or IDE.

#### Scenario: Open unversioned file
- **WHEN** user actions an open request on a file with added or unversioned status
- **THEN** system SHALL execute Electron shell.openPath to open the file
