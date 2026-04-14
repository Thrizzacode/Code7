## ADDED Requirements

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
