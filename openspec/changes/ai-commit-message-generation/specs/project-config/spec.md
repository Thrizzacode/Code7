## ADDED Requirements

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
