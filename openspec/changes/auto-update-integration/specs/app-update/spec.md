## ADDED Requirements

### Requirement: Automated Update Check
The system SHALL automatically check for application updates on startup.

#### Scenario: Update found on startup
- **WHEN** the application starts AND a newer version is available on GitHub Releases
- **THEN** the system SHALL begin downloading the update in the background
- **THEN** the system SHALL notify the user via a Toast message that an update is being downloaded

#### Scenario: No update found on startup
- **WHEN** the application starts AND the current version is up to date
- **THEN** the system SHALL NOT display any update-related notifications to the user

### Requirement: Manual Update Check
The system SHALL provide a manual "Check for Updates" button in the Settings panel.

#### Scenario: Manual check with success
- **WHEN** the user clicks the "Check for Updates" button
- **THEN** the system SHALL initiate an update check
- **THEN** the system SHALL display a "Checking for updates..." status in the UI
- **THEN** the system SHALL notify the user of the result (either "Latest version" or "New version available")

### Requirement: Background Downloading and Progress
The system SHALL download updates in the background and report progress to the UI.

#### Scenario: Downloading in progress
- **WHEN** an update is being downloaded
- **THEN** the system SHALL update the progress percentage in the Settings panel in real-time
- **THEN** the system SHALL disable the "Check for Updates" button during download

### Requirement: Post-Download Installation
The system SHALL allow the user to restart and install the update once it has been fully downloaded.

#### Scenario: Update ready to install
- **WHEN** the update download is complete
- **THEN** the system SHALL change the status to "Update ready" in the UI
- **THEN** the system SHALL provide a "Restart and Install" button
- **THEN** the system SHALL notify the user via a Toast message that the app is ready to update

#### Scenario: User clicks restart
- **WHEN** the user clicks the "Restart and Install" button
- **THEN** the system SHALL quit the application and install the downloaded update
