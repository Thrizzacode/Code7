## MODIFIED Requirements

### Requirement: SVN command execution wrapper

The system SHALL provide a unified module (`SvnBridge`) that wraps all SVN CLI interactions.

All SVN commands SHALL be executed using `child_process.execFile` (not `exec`) to prevent shell injection.

All query commands SHALL use the `--xml` output flag and parse results with an XML parser.

Each command execution SHALL enforce a configurable timeout (default: 30 seconds for most commands, 60 seconds for `svn log`, 120 seconds for `svn merge` and `svn update`).

#### Scenario: Execute svn log

- **WHEN** the system calls `SvnBridge.log(path, { limit: 100 })`
- **THEN** the system SHALL execute `svn log --xml --limit 100 <path>`
- **THEN** the system SHALL parse the XML output into an array of `LogEntry` objects with fields: `revision`, `author`, `date`, `message`

#### Scenario: Execute svn info

- **WHEN** the system calls `SvnBridge.info(path)`
- **THEN** the system SHALL execute `svn info --xml <path>`
- **THEN** the system SHALL parse the XML output into a `RepoInfo` object with fields: `url`, `repositoryRoot`, `revision`, `lastChangedRevision`

#### Scenario: Execute svn status

- **WHEN** the system calls `SvnBridge.status(path)`
- **THEN** the system SHALL execute `svn status --xml <path>`
- **THEN** the system SHALL parse the XML output into an array of `StatusEntry` objects with fields: `path`, `itemStatus`, `propsStatus`

#### Scenario: Execute svn update

- **WHEN** the system calls `SvnBridge.update(path)`
- **THEN** the system SHALL execute `svn update <path>`
- **THEN** the system SHALL return a success result with the raw string output from the command

#### Scenario: Command timeout

- **WHEN** an SVN command does not complete within the configured timeout
- **THEN** the system SHALL kill the child process
- **THEN** the system SHALL return an error with message: "SVN command timed out after {timeout} seconds"
