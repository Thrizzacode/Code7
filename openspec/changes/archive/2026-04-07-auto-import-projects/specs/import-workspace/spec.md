## ADDED Requirements

### Requirement: Workspace discovery

The system SHALL allow the user to select a parent workspace directory using a native filesystem dialog.
The system SHALL scan the selected directory to automatically discover project folders.
The system SHALL identify a folder as a valid project if it meets the following criteria:
- The folder name starts with `Fz_`.
- The folder is a directory on the filesystem.
- The folder contains a `.svn` hidden directory, indicating it is an SVN working copy.

#### Scenario: User imports a valid workspace

- **WHEN** the user selects a parent directory containing multiple `Fz_` folders mapped as SVN working copies
- **THEN** the system SHALL discover all qualifying folders as projects

#### Scenario: User imports an invalid workspace

- **WHEN** the user selects a directory containing no `Fz_` folders or no SVN working copies
- **THEN** the system SHALL alert the user that no valid projects were found

---

### Requirement: Automatic repository URL resolution

For each discovered project folder, the system SHALL automatically resolve its remote repository URL without manual user input.
The system SHALL gather this URL by executing `svn info --xml` on the project's folder.
The system SHALL parse the `url` property from the SVN output and assign it to the project configuration.

#### Scenario: Valid SVN working copy

- **WHEN** the system discovers a valid project folder
- **THEN** the system SHALL execute `svn info` and extract the repository URL successfully

#### Scenario: Execution timeout or failure

- **WHEN** the `svn info` execution fails or times out for a discovered folder
- **THEN** the system SHALL skip importing the affected folder and list it in an error notification

---

### Requirement: Dynamic branches detection

The system SHALL NOT require the user to configure a static list of version numbers (e.g., `1.5.0`, `1.6.0`).
When retrieving a project's version list for branch resolution, the system SHALL dynamically read the contents of the `branches` subfolder within the project's working copy directory.
The system SHALL filter the read directory contents to list only directories whose names match a valid semantic-like pattern or standard branch naming convention, ignoring hidden files (e.g., `.svn`).

#### Scenario: Project branches loaded dynamically

- **WHEN** the branches selector UI requests the list of versions for a specific project
- **THEN** the system SHALL scan the `branches` directory inside the local working copy and return the directory names as available versions
