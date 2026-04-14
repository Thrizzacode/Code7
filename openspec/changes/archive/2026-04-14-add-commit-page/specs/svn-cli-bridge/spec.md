## MODIFIED Requirements

### Requirement: SVN command execution wrapper

The system SHALL provide a unified module (`SvnBridge`) that wraps all SVN CLI interactions. The wrapper SHALL be enhanced to parse granular file statuses and execute selective commits.

#### Scenario: Granular Status Parsing

- **WHEN** the system calls `SvnBridge.status(path)`
- **THEN** the system SHALL execute `svn status --xml <path>`
- **AND** the system SHALL return the comprehensive list of statuses, correctly identifying if a file is modified, unversioned, added, deleted, or conflicted, making these statuses distinguishable to the consuming module.

#### Scenario: Selective Commit with Array of Files

- **WHEN** the system calls `SvnBridge.commit(wcPath, message, filesArray)` and `filesArray` is provided
- **THEN** the system SHALL construct and execute an `svn commit -m <message> <file1> <file2> ...` command targeting only the specified files within `wcPath`.

#### Scenario: Committing Unversioned Files

- **WHEN** the system calls `SvnBridge.commit(wcPath, message, filesArray)` and the `filesArray` includes entries that are currently unversioned
- **THEN** the system SHALL automatically isolate these unversioned entries and execute `svn add <unversioned-files...>` prior to the main commit execution
- **AND** the system SHALL subsequently proceed to commit the full `filesArray`, including the newly added files.
