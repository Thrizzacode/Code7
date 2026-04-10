## ADDED Requirements

### Requirement: Theme Management

The system SHALL support personalizing the UI by switching between predefined themes that override the application's primary accent color. The system SHALL persist the selected theme configuration.

#### Scenario: Switching Themes

- **WHEN** the user selects a theme (e.g., "TECHNOLOM") from the Top Bar theme dropdown menu
- **THEN** the application immediately applies the new theme (e.g., blue accent) to the DOM without requiring a reload
- **AND** the choice is persisted via the application configuration state.

#### Scenario: Initialization and Default State

- **WHEN** the application starts up
- **THEN** the system SHALL load the saved theme from configuration and apply it
- **AND** if no theme is currently configured, the system SHALL default to the "PHYSICAM" (red) theme.

### Requirement: Dark/Light Mode Management

The system SHALL support alternating between dark and light mode UI bases, preserving the respective theme accents and tinting the backgrounds accordingly.

#### Scenario: Switching Modes

- **WHEN** the user clicks the mode toggle button in the Top Bar
- **THEN** the application immediately transitions to the alternate mode (light or dark)
- **AND** updates the toggle button icon
- **AND** the mode choice is persisted to the application configuration state and `localStorage`.

#### Scenario: Early Mode Restoration

- **WHEN** the application initializes
- **THEN** the system SHALL restore the saved mode from `localStorage` immediately upon startup, prior to async configuration loads, to prevent UI flicker.
