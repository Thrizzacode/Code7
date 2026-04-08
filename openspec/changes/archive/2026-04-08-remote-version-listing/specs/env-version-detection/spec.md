## MODIFIED Requirements

### Requirement: Dynamic Environment Version Loading
The system SHALL dynamically scan for available versions based on the selected environment using a hybrid approach.

#### Scenario: Hybrid version detection
- **WHEN** the user selects an environment (e.g., qat)
- **THEN** the system SHALL first attempt to list directories via remote SVN URL
- **THEN** THE system SHALL fallback to local directory scanning if the remote query fails or times out
- **THEN** the system SHALL merge and deduplicate results from both remote and local sources
