## ADDED Requirements

### Requirement: Merge Status Query
The system SHALL retrieve the list of merged revisions from the SVN server for a given source URL and target Working Copy path using the `svn mergeinfo` command.

#### Scenario: Both Source and Target are selected
- **WHEN** the user selects a valid Source version and Target version
- **THEN** the system SHALL perform an asynchronous query to fetch the merged revision numbers
- **THEN** this query SHALL run in parallel with the `svn log` command to minimize perceived latency

### Requirement: Mark Merged Revisions
The system SHALL visually distinguish revisions that have already been merged into the Target branch to prevent duplicate merging.

#### Scenario: Rendering the revision table
- **WHEN** the Revision list is populated
- **THEN** the system SHALL disable the checkbox for any revision that is present in the merged revision set
- **THEN** the system SHALL visually dim the row of the merged revision
- **THEN** the user SHALL NOT be able to manually select disabled revisions
