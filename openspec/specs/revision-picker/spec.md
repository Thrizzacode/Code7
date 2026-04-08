# revision-picker Specification

## Purpose

TBD - created by archiving change 'init-svn-viewer'. Update Purpose after archive.

## Requirements

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

---
### Requirement: Revision multi-selection

The system SHALL allow the user to select multiple revisions from the list using checkboxes.

Checkboxes for already-merged revisions SHALL NOT be disabled. The user SHALL be allowed to manually select already-merged revisions (identified by a visual indicator) to re-merge them (cherry-pick).

The system SHALL display a selection summary showing the count of selected revisions and the revision number range.

#### Scenario: Select individual revisions

- **WHEN** the user clicks the checkbox on revision r1234 and r1236
- **THEN** the system SHALL mark both revisions as selected
- **THEN** the system SHALL display "2 revisions selected (r1234, r1236)"

#### Scenario: Select all visible revisions

- **WHEN** the user clicks a "Select All" checkbox in the list header
- **THEN** the system SHALL select all currently visible revisions that have NOT already been merged
- **THEN** the system SHALL NOT automatically select revisions that are marked as already merged
- **THEN** the system SHALL update the selection summary

#### Scenario: Deselect all

- **WHEN** the user clicks "Deselect All"
- **THEN** the system SHALL clear all selections
- **THEN** the system SHALL update the selection summary to show zero selected

#### Scenario: Manually select a merged revision

- **WHEN** the user clicks the checkbox of a revision that is marked as already merged
- **THEN** the system SHALL select that revision
- **THEN** the system SHALL display the row with full opacity (no fade)
- **THEN** the system SHALL apply a distinct visual style (e.g. orange background or border) to indicate a re-merge override
- **THEN** the system SHALL update the selection summary

---
### Requirement: Revision filtering

The system SHALL provide a text filter input above the revision list.

The filter SHALL match against revision number, author name, and commit message content.

The system SHALL support standard RegExp (Regular Expressions) in the filter input.

If the provided filter input is an invalid RegExp, the system SHALL display a UI warning (Tooltip or Toast) AND fallback to standard string matching or ignore the invalid filter. It MUST NOT crash.

The system SHALL provide a help icon (`ℹ️`) near the search input that displays common RegExp examples on hover.

#### Scenario: Filter by author

- **WHEN** the user types "mike" into the filter input
- **THEN** the system SHALL display only revisions where the author name contains "mike" (case-insensitive)
- **THEN** the system SHALL preserve any existing selections on filtered-out revisions

#### Scenario: Filter by revision number

- **WHEN** the user types "1234" into the filter input
- **THEN** the system SHALL display revisions where the revision number contains "1234"

#### Scenario: Filter using RegExp

- **WHEN** the user types "Henshin1|Henshin2" into the filter input
- **THEN** the system SHALL display revisions where the author, message, or revision matches the regex "Henshin1|Henshin2"

#### Scenario: Invalid RegExp input

- **WHEN** the user types an invalid RegExp like "[x" into the filter input
- **THEN** the system SHALL display a UI warning indicating invalid regex syntax
- **THEN** the system SHALL NOT crash and SHALL gracefully fallback to literal matching or previous valid state

#### Scenario: Clear filter

- **WHEN** the user clears the filter input
- **THEN** the system SHALL display all revisions again
- **THEN** the system SHALL restore visibility of previously selected revisions
