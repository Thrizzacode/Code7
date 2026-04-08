# env-version-detection Specification

## Purpose

TBD - created by archiving change 'smart-branch-selector'. Update Purpose after archive.

## Requirements

### Requirement: Dynamic Environment Version Loading
The system SHALL dynamically scan for available versions based on the selected environment using a hybrid approach.

#### Scenario: Hybrid version detection
- **WHEN** the user selects an environment (e.g., qat)
- **THEN** the system SHALL first attempt to list directories via remote SVN URL
- **THEN** THE system SHALL fallback to local directory scanning if the remote query fails or times out
- **THEN** the system SHALL merge and deduplicate results from both remote and local sources


<!-- @trace
source: remote-version-listing
updated: 2026-04-08
code:
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/main/config-manager.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/CHANGELOG.md
-->

---
### Requirement: Independent Version Lists
The system SHALL NOT share the same version list between the Source and Target dropdowns if their configured environments or path templates point to different physical directories or prefixes.

#### Scenario: Source is branches, Target is qat
- **WHEN** the Source environment is set to "branches" and the Target environment is set to "qat"
- **THEN** the Source version dropdown SHALL display directories from the "branches" folder
- **THEN** the Target version dropdown SHALL display versions parsed from the "trunk/05-Code-*" folders