## ADDED Requirements

### Requirement: Revision list display

The system SHALL display a list of revisions from the selected source branch when both source and target are selected.

Each revision entry SHALL display:
- Revision number
- Author name
- Commit date and time
- Commit message (first line, truncated to 120 characters)

The system SHALL fetch revisions using `svn log --xml --limit 100` against the source branch path.

#### Scenario: Load revision list

- **WHEN** the user has selected both source and target environments
- **THEN** the system SHALL fetch the latest 100 revisions from the source branch
- **THEN** the system SHALL display them in reverse chronological order (newest first)
- **THEN** the system SHALL show a loading indicator while fetching

#### Scenario: Load more revisions

- **WHEN** the user clicks "Load More" at the bottom of the revision list
- **THEN** the system SHALL fetch the next 100 revisions (using `--revision` range parameters)
- **THEN** the system SHALL append them to the existing list

#### Scenario: Empty revision list

- **WHEN** the source branch has no commit history
- **THEN** the system SHALL display an empty state message: "No revisions found"

### Requirement: Revision multi-selection

The system SHALL allow the user to select multiple revisions from the list using checkboxes.

The system SHALL display a selection summary showing the count of selected revisions and the revision number range.

#### Scenario: Select individual revisions

- **WHEN** the user clicks the checkbox on revision r1234 and r1236
- **THEN** the system SHALL mark both revisions as selected
- **THEN** the system SHALL display "2 revisions selected (r1234, r1236)"

#### Scenario: Select all visible revisions

- **WHEN** the user clicks a "Select All" checkbox in the list header
- **THEN** the system SHALL select all currently visible revisions
- **THEN** the system SHALL update the selection summary

#### Scenario: Deselect all

- **WHEN** the user clicks "Deselect All"
- **THEN** the system SHALL clear all selections
- **THEN** the system SHALL update the selection summary to show zero selected

### Requirement: Revision filtering

The system SHALL provide a text filter input above the revision list.

The filter SHALL match against revision number, author name, and commit message content.

#### Scenario: Filter by author

- **WHEN** the user types "mike" into the filter input
- **THEN** the system SHALL display only revisions where the author name contains "mike" (case-insensitive)
- **THEN** the system SHALL preserve any existing selections on filtered-out revisions

#### Scenario: Filter by revision number

- **WHEN** the user types "1234" into the filter input
- **THEN** the system SHALL display revisions where the revision number contains "1234"

#### Scenario: Clear filter

- **WHEN** the user clears the filter input
- **THEN** the system SHALL display all revisions again
- **THEN** the system SHALL restore visibility of previously selected revisions
