# env-version-detection Specification

## Purpose

TBD - created by archiving change 'smart-branch-selector'. Update Purpose after archive.

## Requirements

### Requirement: Dynamic Environment Version Loading
The system SHALL dynamically scan the filesystem for available versions based on the selected environment and its corresponding path template.

#### Scenario: User selects "qat" environment
- **WHEN** the user selects the "qat" environment
- **THEN** the system SHALL extract the directory prefix from the path template
- **THEN** the system SHALL list all subdirectories matching the prefix and strip the prefix to populate the version dropdown

---
### Requirement: Independent Version Lists
The system SHALL NOT share the same version list between the Source and Target dropdowns if their configured environments or path templates point to different physical directories or prefixes.

#### Scenario: Source is branches, Target is qat
- **WHEN** the Source environment is set to "branches" and the Target environment is set to "qat"
- **THEN** the Source version dropdown SHALL display directories from the "branches" folder
- **THEN** the Target version dropdown SHALL display versions parsed from the "trunk/05-Code-*" folders
