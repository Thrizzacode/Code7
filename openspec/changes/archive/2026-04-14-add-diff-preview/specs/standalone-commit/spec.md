## ADDED Requirements

### Requirement: Interactive File List Preview actions
The commit file list SHALL provide interactive elements to trigger file previews based on file status, and row-click selection events MUST be disabled to avoid conflict with double-click preview triggers.

#### Scenario: Row double-click triggers preview
- **WHEN** user double clicks a row in the commit file table
- **THEN** system SHALL invoke the appropriate preview action for that file's status

#### Scenario: Icon button triggers preview
- **WHEN** user clicks the action icon button in the file list row
- **THEN** system SHALL invoke the appropriate preview action for that file's status
