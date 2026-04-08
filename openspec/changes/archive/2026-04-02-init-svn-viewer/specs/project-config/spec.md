## ADDED Requirements

### Requirement: Project configuration storage

The system SHALL store project configurations in a JSON file located in the user's AppData directory (`%APPDATA%/svn-merge-helper/config.json`).

Each project configuration SHALL contain:
- Project name (string)
- Working copy root path (absolute filesystem path)
- Repository URL (SVN repository URL)
- Version list (array of version strings, e.g., `["1.9.0", "1.10.0"]`)
- Path templates (object mapping environment names to path patterns with `{version}` placeholder)

#### Scenario: First launch with no configuration

- **WHEN** the application starts and no config file exists
- **THEN** the system SHALL display a setup screen prompting the user to add at least one project

#### Scenario: Add a new project

- **WHEN** the user fills in project name, working copy path, repository URL, version list, and path templates
- **THEN** the system SHALL validate that the working copy path exists on the filesystem
- **THEN** the system SHALL save the project to the config file
- **THEN** the system SHALL display the newly added project in the project selector

#### Scenario: Edit an existing project

- **WHEN** the user modifies any field of an existing project configuration
- **THEN** the system SHALL persist the changes to the config file immediately

#### Scenario: Delete a project

- **WHEN** the user deletes a project from the configuration
- **THEN** the system SHALL remove the project from the config file
- **THEN** the system SHALL NOT delete any files from the filesystem

### Requirement: Default path templates

The system SHALL provide default path templates based on the observed project structure:

| Environment | Default Template |
|-------------|-----------------|
| branches    | `branches/{version}` |
| qat         | `trunk/05-Code-{version}` |
| stg         | `trunk/05-Code-Stage-{version}` |

Each project SHALL allow overriding the default templates with custom patterns.

#### Scenario: Apply default templates

- **WHEN** the user adds a new project without specifying custom path templates
- **THEN** the system SHALL apply the default path templates

#### Scenario: Override templates per project

- **WHEN** the user specifies custom path templates for a project
- **THEN** the system SHALL use the custom templates instead of the defaults for that project

### Requirement: External merge tool path configuration

The system SHALL allow the user to configure the path to an external merge tool (e.g., TortoiseMerge.exe).

The system SHALL attempt to auto-detect the TortoiseMerge installation path from the Windows Registry before falling back to manual configuration.

#### Scenario: Auto-detect TortoiseMerge

- **WHEN** the application starts and no merge tool path is configured
- **THEN** the system SHALL query the Windows Registry for TortoiseSVN installation path
- **THEN** if found, the system SHALL set the merge tool path to `{install_path}/bin/TortoiseMerge.exe`

#### Scenario: Manual merge tool configuration

- **WHEN** auto-detection fails and the user manually provides a merge tool path
- **THEN** the system SHALL validate that the specified executable exists
- **THEN** the system SHALL save the path to the config file
