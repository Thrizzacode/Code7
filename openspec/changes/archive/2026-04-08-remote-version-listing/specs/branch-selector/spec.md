## MODIFIED Requirements

### Requirement: Path resolution and display
The system SHALL NOT fallback to a project-wide static version list if the environment directory scanning returns empty.

#### Scenario: Selection of a non-local version
- **WHEN** the user selects a version that exists on the remote server but is missing in the local working copy
- **THEN** the system SHALL resolve the Repo URL correctly
- **THEN** the system SHALL display a warning icon or label (e.g., "⚠ Not found locally") next to the path or version selector
- **THEN** the system SHALL allow the merge to be initiated only if the user is aware that a target working copy update SHALL be required
