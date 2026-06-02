## ADDED Requirements

### Requirement: SVN diff command for specified files

The system SHALL provide a `SvnBridge.diff(filePaths)` method that executes `svn diff` against an explicit list of file paths and returns the combined diff output as a string.

The method SHALL accept only versioned files. Callers are responsible for filtering out unversioned files before invoking this method.

The method SHALL truncate the returned diff text to a maximum of 8000 characters. When truncation occurs, the system SHALL append the suffix `\n[... diff 已截斷，僅顯示前 8000 字元 ...]` to the returned string.

#### Scenario: Diff for a list of versioned files

- **WHEN** the system calls `SvnBridge.diff(filePaths)` with one or more versioned file paths
- **THEN** the system SHALL execute `svn diff <file1> <file2> ...`
- **AND** the system SHALL return `{ success: true, diff: string }`

#### Scenario: Diff result exceeds size limit

- **WHEN** the combined diff output exceeds 8000 characters
- **THEN** the system SHALL return a `diff` string truncated to 8000 characters
- **AND** the returned string SHALL end with `\n[... diff 已截斷，僅顯示前 8000 字元 ...]`

#### Scenario: Empty file list provided

- **WHEN** the system calls `SvnBridge.diff([])` with an empty array
- **THEN** the system SHALL return `{ success: true, diff: "" }` without executing any SVN command

#### Scenario: SVN diff command fails

- **WHEN** the `svn diff` execution fails (e.g., path error or SVN not accessible)
- **THEN** the system SHALL return `{ success: false, error: string }` with the error message
