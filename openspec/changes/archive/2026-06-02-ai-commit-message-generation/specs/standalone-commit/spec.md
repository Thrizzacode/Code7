## ADDED Requirements

### Requirement: AI-powered commit message generation button

The standalone commit view SHALL include an "✨ AI 生成" button positioned adjacent to the commit message textarea.

The button SHALL be enabled only when at least one file is selected, following the same selection count condition as the existing commit button.

The button SHALL be disabled while an AI generation request is in progress.

Upon successful generation, the system SHALL populate the commit message textarea with the AI-generated text without submitting the commit.

#### Scenario: AI generate button appears in commit view

- **WHEN** the user navigates to the standalone commit tab
- **THEN** the commit view SHALL display the "✨ AI 生成" button below the commit message textarea

#### Scenario: Button enabled state mirrors file selection

- **WHEN** the user selects one or more files from the commit file list
- **THEN** the "✨ AI 生成" button SHALL become enabled
- **WHEN** the user deselects all files
- **THEN** the "✨ AI 生成" button SHALL return to a disabled state

#### Scenario: Generated message fills textarea without auto-submitting

- **WHEN** AI generation succeeds
- **THEN** the system SHALL write the generated text into the commit message textarea
- **AND** the system SHALL NOT automatically trigger the commit action
