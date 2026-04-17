## ADDED Requirements

### Requirement: Revert single file change
The system SHALL provide a mechanism to revert uncommitted changes for a single file in the standalone commit view.

#### Scenario: User reverts a single modified file
- **WHEN** the user clicks the revert button for a specific file
- **THEN** the system SHALL display a confirmation dialog
- **WHEN** the user confirms the revert action
- **THEN** the system SHALL execute the SVN revert command for that file and refresh the file list

### Requirement: Revert multiple selected files
The system SHALL provide a mechanism to revert uncommitted changes for multiple selected files simultaneously in the standalone commit view.

#### Scenario: User reverts multiple selected files
- **WHEN** the user selects multiple files and clicks the batch revert button
- **THEN** the system SHALL display a confirmation dialog
- **WHEN** the user confirms the revert action
- **THEN** the system SHALL execute the SVN revert command for all selected files and refresh the file list

#### Scenario: User cancels revert action
- **WHEN** the user initiates a revert action (single or batch)
- **THEN** the system SHALL display a confirmation dialog
- **WHEN** the user cancels the confirmation dialog
- **THEN** the system SHALL NOT execute the SVN revert command and SHALL keep the current file states intact
