## ADDED Requirements

### Requirement: User can switch IIS version from Settings
The system SHALL provide a mechanism in the Settings panel to select and switch the local IIS version.

#### Scenario: View IIS version switcher
- **WHEN** the user opens the Settings panel
- **THEN** an "IIS 版本設定" section SHALL be visible with a version selector and a submit button.

### Requirement: System escalates privileges to copy configuration
The system SHALL execute a PowerShell script with elevated privileges (UAC prompt) to replace the system's `hosts` and `applicationHost.config` files.

#### Scenario: User applies version change
- **WHEN** the user clicks the apply button with a selected version
- **THEN** the system SHALL launch a PowerShell elevated prompt
- **AND** the system SHALL wait for the process to exit
- **AND** show a success Toast notification if the exit code is 0.
- **AND** show an error Toast notification if the process is declined or fails.

### Requirement: System detects current IIS version
The system SHALL detect and display the currently active IIS version by reading the `applicationHost.config` file and searching for a branch version pattern in the physical paths.

#### Scenario: User views current IIS version
- **WHEN** the user opens the Settings panel
- **THEN** the system SHALL attempt to read `C:\Windows\System32\inetsrv\config\applicationHost.config`
- **AND** extract the version string (e.g., "1.11.0") from the first `physicalPath` containing a `\branches\` pattern.
- **AND** display this version string in the "IIS 版本設定" section.
