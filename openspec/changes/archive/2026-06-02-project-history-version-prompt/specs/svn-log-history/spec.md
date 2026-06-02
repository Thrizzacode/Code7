## MODIFIED Requirements

### Requirement: Log View Modal

The system SHALL provide a standalone modal interface for displaying SVN log history for a specific file or path.

#### Scenario: View Project Root Logs
- **WHEN** the user clicks "專案歷史" from the Commit page AND a commit version (wcPath) has been selected
- **THEN** the system SHALL call the `svn:log` API to fetch the latest 100 entries for the project root path
- **AND** the system SHALL display a list with Revision, Author, Date, and Message

#### Scenario: View Project Root Logs - Version Not Selected
- **WHEN** the user clicks "專案歷史" from the Commit page AND no commit version (wcPath) has been selected
- **THEN** the system SHALL display a Toast warning with title "尚未選擇版本", message "請先在上方選擇版本後再查看專案歷史"
- **AND** the log modal SHALL NOT open

#### Scenario: View Single File Logs
- **WHEN** the user clicks the `🔍 (Show Log)` button next to a single file in the Commit file list
- **THEN** the system SHALL fetch and display only the history for that specific file

##### Example: version selection guard
| State | User Action | Expected Behavior |
|-------|-------------|-------------------|
| wcPath = "" (not selected) | Click "專案歷史" | Toast warning shown, modal stays closed |
| wcPath = "D:\repo\branches\feature" | Click "專案歷史" | Log modal opens with project root logs |
