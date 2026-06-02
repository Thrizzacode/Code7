## ADDED Requirements

### Requirement: AI commit message generation via Gemini API

The system SHALL provide an AI-powered commit message generation feature that uses the Google Gemini API to produce a commit message based on the user's selected file changes and their diff content.

The feature SHALL be accessible from the standalone commit view via a dedicated "✨ AI 生成" button.

The system SHALL require a valid Gemini API Key configured by the user before the generation can proceed.

#### Scenario: Successful message generation with versioned files selected

- **WHEN** the user has one or more versioned files selected in the commit view
- **AND** a valid Gemini API Key is configured in settings
- **WHEN** the user clicks the "✨ AI 生成" button
- **THEN** the system SHALL collect the selected files' paths and statuses
- **AND** the system SHALL fetch the diff for the versioned selected files via `SvnBridge.diff()`
- **AND** the system SHALL call the Gemini API with the user-configured prompt template, file list, and diff content
- **AND** the system SHALL populate the commit message textarea with the AI-generated text

#### Scenario: Generation with only unversioned files selected

- **WHEN** all selected files are unversioned
- **AND** a valid Gemini API Key is configured
- **WHEN** the user clicks the "✨ AI 生成" button
- **THEN** the system SHALL call the Gemini API with the file list only (empty diff)
- **AND** the system SHALL populate the commit message textarea with the AI-generated text based on file names and statuses alone

#### Scenario: No API Key configured

- **WHEN** the user clicks "✨ AI 生成" and no API Key is configured (empty string)
- **THEN** the system SHALL NOT call the Gemini API
- **AND** the system SHALL display a warning notification directing the user to configure the API Key in Settings

#### Scenario: Gemini API returns an error

- **WHEN** the Gemini API call fails due to an invalid key, network error, or server error
- **THEN** the system SHALL display an error notification with the error message from the API
- **AND** the system SHALL NOT modify the commit message textarea content

#### Scenario: Gemini API returns empty response

- **WHEN** the Gemini API returns a blank or whitespace-only response
- **THEN** the system SHALL display a warning notification suggesting the user adjust the prompt
- **AND** the system SHALL NOT modify the commit message textarea content

---

### Requirement: AI generation button availability

The "✨ AI 生成" button SHALL be enabled if and only if at least one file is selected in the commit file list.

The button SHALL be disabled while a generation request is in progress to prevent duplicate calls.

#### Scenario: Button state follows file selection

- **WHEN** no files are selected in the commit view
- **THEN** the "✨ AI 生成" button SHALL be in a disabled state
- **WHEN** one or more files are selected
- **THEN** the "✨ AI 生成" button SHALL become enabled

#### Scenario: Button disabled during generation

- **WHEN** the user clicks "✨ AI 生成" and a generation request is in progress
- **THEN** the button SHALL remain disabled until the request completes or fails

---

### Requirement: AI settings configuration

The system SHALL provide a dedicated "AI 訊息生成" section in the Settings panel where users can configure their Gemini API Key and customize the commit message prompt template.

#### Scenario: Save API Key

- **WHEN** the user enters a value in the API Key field and clicks the save button
- **THEN** the system SHALL persist the value to `aiApiKey` in `config.json`
- **AND** the system SHALL display a success notification

#### Scenario: Save custom prompt

- **WHEN** the user edits the prompt textarea and clicks the save prompt button
- **THEN** the system SHALL persist the value to `aiCommitPrompt` in `config.json`
- **AND** the system SHALL display a success notification

#### Scenario: Reset prompt to team default

- **WHEN** the user clicks the "恢復預設提示詞" button
- **THEN** the system SHALL replace the prompt textarea content with the `DEFAULT_COMMIT_PROMPT` constant
- **AND** the system SHALL persist the default value to `config.json`
- **AND** the system SHALL display a success notification

---

### Requirement: Diff content size limit

To prevent excessive API token usage and latency, the system SHALL truncate the diff content sent to the Gemini API.

#### Scenario: Diff content truncated when too large

- **WHEN** the combined diff of selected files exceeds 8000 characters
- **THEN** the system SHALL truncate the diff to 8000 characters
- **AND** the system SHALL append the text `\n[... diff 已截斷，僅顯示前 8000 字元 ...]` to indicate truncation

##### Example: truncation boundary

| diff size | sent to API | appended notice |
|-----------|------------|-----------------|
| 5000 chars | 5000 chars (unchanged) | none |
| 8000 chars | 8000 chars (unchanged) | none |
| 8001 chars | 8000 chars | `\n[... diff 已截斷，僅顯示前 8000 字元 ...]` |
| 20000 chars | 8000 chars | `\n[... diff 已截斷，僅顯示前 8000 字元 ...]` |
