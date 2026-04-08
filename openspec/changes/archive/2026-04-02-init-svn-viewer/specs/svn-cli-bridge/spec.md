## ADDED Requirements

### Requirement: SVN command execution wrapper

The system SHALL provide a unified module (`SvnBridge`) that wraps all SVN CLI interactions.

All SVN commands SHALL be executed using `child_process.execFile` (not `exec`) to prevent shell injection.

All query commands SHALL use the `--xml` output flag and parse results with an XML parser.

Each command execution SHALL enforce a configurable timeout (default: 30 seconds for most commands, 60 seconds for `svn log`).

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

#### Scenario: Command timeout

- **WHEN** an SVN command does not complete within the configured timeout
- **THEN** the system SHALL kill the child process
- **THEN** the system SHALL return an error with message: "SVN command timed out after {timeout} seconds"

### Requirement: SVN CLI availability check

The system SHALL verify that the `svn` CLI is available and accessible on the system PATH at application startup.

#### Scenario: SVN CLI available

- **WHEN** the application starts and `svn --version` executes successfully
- **THEN** the system SHALL proceed to the main interface
- **THEN** the system SHALL store the detected SVN version for display in the application

#### Scenario: SVN CLI not found

- **WHEN** the application starts and `svn --version` fails with a "command not found" error
- **THEN** the system SHALL display a blocking error screen with instructions to install SVN CLI or add it to the system PATH
- **THEN** the system SHALL provide a "Retry" button to re-check

### Requirement: Error handling and reporting

All SVN command failures SHALL be captured and presented to the user with actionable information.

#### Scenario: Authentication failure

- **WHEN** an SVN command fails with an authentication error
- **THEN** the system SHALL display: "SVN authentication failed. Please check your SVN credentials."

#### Scenario: Network error

- **WHEN** an SVN command fails due to network connectivity
- **THEN** the system SHALL display: "Cannot connect to SVN server. Please check your network connection."

#### Scenario: Generic SVN error

- **WHEN** an SVN command fails with an unrecognized error
- **THEN** the system SHALL display the raw stderr output from the SVN command
- **THEN** the system SHALL provide a "Copy Error" button to copy the full error to clipboard
