# remote-version-query Specification

## Purpose

TBD - created by archiving change 'remote-version-listing'. Update Purpose after archive.

## Requirements

### Requirement: Remote subdirectory listing
The system SHALL provide a mechanism to list subdirectories of a given remote SVN URL.

#### Scenario: Successful remote listing
- **WHEN** provided a valid SVN repository URL
- **THEN** THE system SHALL return a list of subdirectory names found at that URL


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
### Requirement: Timeout handling for remote listing
The system SHALL NOT block indefinitely if the remote server is unresponsive. A timeout of 10 seconds SHALL be enforced.

#### Scenario: Remote server timeout
- **WHEN** the SVN server does not respond within 10 seconds
- **THEN** the system SHALL return a timeout error

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