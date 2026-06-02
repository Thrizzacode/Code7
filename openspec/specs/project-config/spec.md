# project-config Specification

## Purpose

TBD - created by archiving change 'init-svn-viewer'. Update Purpose after archive.

## Requirements

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

---
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

---
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

---
### Requirement: Saving imported workspaces

The system SHALL accept a batch of dynamically discovered project configurations from the workspace importer.
The system SHALL overwrite or merge the discovered projects into the existing `config.json` payload and persist them identically to manually added configurations.

#### Scenario: Overwriting configuration via import

- **WHEN** a user initiates a workspace import
- **THEN** the system SHALL replace the current array of stored projects with the newly discovered and parsed projects

---
### Requirement: AI configuration fields in config schema

The system SHALL extend the `config.json` schema with two additional fields to support AI-powered commit message generation:

- `aiApiKey` (string): the user's personal Gemini API Key. Default value: empty string `""`.
- `aiCommitPrompt` (string): the prompt template sent to the Gemini API. Default value: `DEFAULT_COMMIT_PROMPT` constant defined in `config-manager.js`.

Both fields SHALL be persisted to `%APPDATA%\Code7\config.json` alongside existing fields.

On application start, if either field is absent from the config file, the system SHALL apply the default value automatically during config normalization.

#### Scenario: First launch — AI fields absent from existing config

- **WHEN** the application loads a config file that does not contain `aiApiKey` or `aiCommitPrompt`
- **THEN** the system SHALL populate `aiApiKey` with `""` in memory
- **AND** the system SHALL populate `aiCommitPrompt` with the `DEFAULT_COMMIT_PROMPT` constant in memory
- **AND** the system SHALL NOT overwrite the config file until the user explicitly saves a setting

#### Scenario: User saves Gemini API Key

- **WHEN** the user enters a value in the API Key field in Settings and clicks save
- **THEN** the system SHALL write the trimmed string value to `aiApiKey` in `config.json`

#### Scenario: User saves custom prompt

- **WHEN** the user modifies the prompt textarea in Settings and clicks save prompt
- **THEN** the system SHALL write the new string value to `aiCommitPrompt` in `config.json`

#### Scenario: User resets prompt to default

- **WHEN** the user clicks the reset-to-default button in the AI settings section
- **THEN** the system SHALL write `DEFAULT_COMMIT_PROMPT` to `aiCommitPrompt` in `config.json`

<!-- @trace
source: ai-commit-message-generation
updated: 2026-06-02
code:
  - svn-merge-helper/src/renderer/js/merge-context.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/test-merge-tool.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/preload/preload.js
-->