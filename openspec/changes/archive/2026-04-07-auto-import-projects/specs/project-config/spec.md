## MODIFIED Requirements

### Requirement: Project configuration storage

The system SHALL store project configurations in a JSON file located in the user's AppData directory (`%APPDATA%/svn-merge-helper/config.json`).

Each project configuration SHALL contain:
- Project name (string)
- Working copy root path (absolute filesystem path)
- Repository URL (SVN repository URL)
- Path templates (object mapping environment names to path patterns with `{version}` placeholder)

#### Scenario: First launch with no configuration

- **WHEN** the application starts and no config file exists
- **THEN** the system SHALL display a setup screen prompting the user to import a workspace directory

#### Scenario: Delete a project

- **WHEN** the user deletes a project from the configuration
- **THEN** the system SHALL remove the project from the config file
- **THEN** the system SHALL NOT delete any files from the filesystem

## REMOVED Requirements

### Removed: Add a new project
**Reason**: Replaced by automated workspace importing feature (`import-workspace` capability).
**Migration**: Users SHALL click "Import Workspace Directory" to select a root parameter, allowing the system to recursively discover, configure, and store projects via SVN background scanning.

### Removed: Edit an existing project
**Reason**: Hand-typed paths and SVN URLs are error-prone and no longer needed with auto-discovery.
**Migration**: If project locations or SVN endpoints change, users SHALL re-import the workspace.

## ADDED Requirements

### Requirement: Saving imported workspaces

The system SHALL accept a batch of dynamically discovered project configurations from the workspace importer.
The system SHALL overwrite or merge the discovered projects into the existing `config.json` payload and persist them identically to manually added configurations.

#### Scenario: Overwriting configuration via import

- **WHEN** a user initiates a workspace import
- **THEN** the system SHALL replace the current array of stored projects with the newly discovered and parsed projects
