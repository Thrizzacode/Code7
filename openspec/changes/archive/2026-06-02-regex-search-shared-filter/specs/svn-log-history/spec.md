## MODIFIED Requirements

### Requirement: Search and Filtering

The log view interface SHALL provide local filtering with regular expression support.

#### Scenario: Filter by keywords (plain text)
- **WHEN** the user types an author name, revision number, or message keyword in the search box
- **THEN** the system SHALL immediately filter the currently loaded log list and display only matching entries

#### Scenario: Filter by regular expression
- **WHEN** the user types a valid regular expression in the search box
- **THEN** the system SHALL apply the regex (case-insensitive) against the revision number, author, and message fields
- **AND** only matching entries SHALL be displayed

##### Example: regex patterns
| Input | Expected Behavior |
|-------|------------------|
| `^123` | Shows entries where revision starts with "123" |
| `john\|jane` | Shows entries authored by john or jane |
| `fix.*bug` | Shows entries whose message contains "fix" followed by "bug" |
| `` | Shows all entries (empty input) |

#### Scenario: Invalid regular expression fallback
- **WHEN** the user types an invalid regular expression (e.g., `(unclosed`)
- **THEN** the system SHALL display a Toast error: title "語法異常", message "不合法的正規表達式，已退回純文字搜尋。"
- **AND** the system SHALL fall back to plain text substring matching
- **AND** the Toast SHALL appear only once per invalid input sequence (not on every keystroke)
