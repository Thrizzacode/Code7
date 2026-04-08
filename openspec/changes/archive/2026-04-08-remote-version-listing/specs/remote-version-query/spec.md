## ADDED Requirements

### Requirement: Remote subdirectory listing
The system SHALL provide a mechanism to list subdirectories of a given remote SVN URL.

#### Scenario: Successful remote listing
- **WHEN** provided a valid SVN repository URL
- **THEN** THE system SHALL return a list of subdirectory names found at that URL

### Requirement: Timeout handling for remote listing
The system SHALL NOT block indefinitely if the remote server is unresponsive. A timeout of 10 seconds SHALL be enforced.

#### Scenario: Remote server timeout
- **WHEN** the SVN server does not respond within 10 seconds
- **THEN** the system SHALL return a timeout error
