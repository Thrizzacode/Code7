# svn-update-integration Specification

## Purpose

TBD - created by archiving change 'integrate-svn-update'. Update Purpose after archive.

## Requirements

### Requirement: Update Current Project

The system SHALL provide a button to update only the currently selected project's working copy.

#### Scenario: Selection of Single Update

- **WHEN** the user selects "Update Current Project" from the update menu
- **THEN** the system SHALL execute `SvnBridge.update` for the active project's path
- **THEN** the system SHALL display a progress notification "Updating current project..."
- **THEN** the system SHALL show "Updated successfully" upon completion or an error message if it fails

---
### Requirement: Update All Projects

The system SHALL provide a button to update all projects defined in the current configuration sequentially.

#### Scenario: Selection of Update All

- **WHEN** the user selects "Update All Projects" from the update menu
- **THEN** the system SHALL iterate through all paths listed in the configuration (including sub-projects)
- **THEN** the system SHALL execute `SvnBridge.update` for each path
- **THEN** the system SHALL display a progress notification showing "[X/Y] Updating {project_name}..."
- **THEN** the system SHALL persist the list of paths to update from either the project settings or a fixed mapping

---
### Requirement: Update Status Feedback

The system SHALL provide immediate visual feedback during and after the update operations.

#### Scenario: Success Feedback

- **WHEN** an update operation completes without error
- **THEN** the system SHALL show a temporary green checkmark icon or success message
- **THEN** the system SHALL automatically refresh the project's revision log to reflect new changes

#### Scenario: Failure Feedback

- **WHEN** an update operation fails (e.g., due to conflicts)
- **THEN** the system SHALL show a red warning icon or error message
- **THEN** the system SHALL report the specific error provided by the bottom-level SVN bridge
