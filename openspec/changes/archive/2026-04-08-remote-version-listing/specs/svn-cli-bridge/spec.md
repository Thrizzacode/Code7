## ADDED Requirements

### Requirement: Execute svn list
The system SHALL provide a method `SvnBridge.list(svnUrl)` to retrieve the subdirectory listing of a remote repository path.

#### Scenario: Execute svn list on directory
- **WHEN** the system calls `SvnBridge.list(svnUrl)`
- **THEN** the system SHALL execute `svn list --xml <svnUrl>`
- **THEN** the system SHALL parse the XML output into an array of subdirectory names
- **THEN** THE system SHALL filter entries to include only those where `kind="dir"`
