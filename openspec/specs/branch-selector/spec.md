# branch-selector Specification

## Purpose

TBD - created by archiving change 'init-svn-viewer'. Update Purpose after archive.

## Requirements

### Requirement: Source and target environment selection

The system SHALL provide two dropdown selectors displayed side by side — the left for the source environment and the right for the target environment.

Each dropdown SHALL present the following environment options:
- `branches` (with a sub-selector for version, e.g., `1.9.0`, `1.10.0`)
- `qat` (with a sub-selector for version)
- `stg` (with a sub-selector for version)

The system SHALL display a directional indicator (→) between the two selectors to visually communicate the merge direction.

#### Scenario: Select source and target

- **WHEN** the user selects "branches / 1.9.0" as source and "qat / 1.9.0" as target
- **THEN** the system SHALL resolve the source SVN path using the project's path template for `branches` with version `1.9.0`
- **THEN** the system SHALL resolve the target SVN path using the project's path template for `qat` with version `1.9.0`
- **THEN** the system SHALL display the resolved full SVN paths below each selector for confirmation

#### Scenario: Prevent same source and target

- **WHEN** the user selects the same environment and version for both source and target
- **THEN** the system SHALL disable the merge action
- **THEN** the system SHALL display a warning message indicating source and target cannot be identical

---
### Requirement: Project selector

The system SHALL provide a project selector dropdown at the top of the interface.

When the user selects a project, the branch selectors SHALL populate their version options from the selected project's configured version list.

#### Scenario: Switch project

- **WHEN** the user selects a different project from the project selector
- **THEN** the system SHALL reset both source and target selectors
- **THEN** the system SHALL populate version options from the new project's configuration

#### Scenario: Single project configured

- **WHEN** only one project is configured
- **THEN** the system SHALL auto-select that project
- **THEN** the system SHALL still display the project selector (not hide it)

---
### Requirement: Merge flow validation

The system SHALL validate the merge direction against the allowed flow: `branches → qat → stg`.

#### Scenario: Valid merge direction

- **WHEN** the user selects source "branches" and target "qat"
- **THEN** the system SHALL allow the merge to proceed

#### Scenario: Reverse merge direction warning

- **WHEN** the user selects a merge direction that goes against the standard flow (e.g., stg → branches)
- **THEN** the system SHALL display a warning indicating this is a non-standard merge direction
- **THEN** the system SHALL still allow the merge to proceed if the user confirms
