## ADDED Requirements

### Requirement: Execute merge with selected revisions

The system SHALL execute `svn merge` with the selected revisions from the source branch into the target branch's working copy.

The merge command SHALL use the `--revision` flag with specific revision ranges derived from the user's selection (e.g., `svn merge -c 1234,1236,1240 <source_url> <target_wc_path>`).

#### Scenario: Successful merge without conflicts

- **WHEN** the user clicks "Merge" with revisions r1234 and r1236 selected
- **THEN** the system SHALL execute `svn merge -c 1234,1236 <source_url> <target_wc_path>`
- **THEN** the system SHALL display a success message with a summary of merged files
- **THEN** the system SHALL prompt the user: "Merge completed. Commit now?"

#### Scenario: Merge with conflicts detected

- **WHEN** the merge operation completes and `svn status --xml` reports conflicted files
- **THEN** the system SHALL display a warning with the list of conflicted files
- **THEN** the system SHALL provide a "Resolve with External Tool" button for each conflicted file
- **THEN** the system SHALL NOT prompt for commit until all conflicts are resolved

#### Scenario: No revisions selected

- **WHEN** the user clicks "Merge" with no revisions selected
- **THEN** the system SHALL disable the merge button
- **THEN** the system SHALL display a tooltip: "Select at least one revision to merge"

### Requirement: Pre-merge working copy validation

Before executing a merge, the system SHALL validate that the target working copy is in a clean state.

#### Scenario: Clean working copy

- **WHEN** the target working copy has no uncommitted changes (`svn status` returns empty)
- **THEN** the system SHALL proceed with the merge

#### Scenario: Dirty working copy

- **WHEN** the target working copy has uncommitted changes
- **THEN** the system SHALL display a warning listing the modified files
- **THEN** the system SHALL ask the user to confirm whether to proceed anyway or abort

### Requirement: Conflict resolution via external tool

When conflicts are detected, the system SHALL allow the user to launch an external merge tool (TortoiseMerge) for each conflicted file.

#### Scenario: Launch external merge tool

- **WHEN** the user clicks "Resolve with External Tool" on a conflicted file
- **THEN** the system SHALL launch the configured merge tool with the conflicted file paths as arguments
- **THEN** the system SHALL monitor the merge tool process
- **THEN** when the external tool exits, the system SHALL re-check the file's conflict status

#### Scenario: Mark conflict as resolved

- **WHEN** the external tool exits and the file is no longer in conflict
- **THEN** the system SHALL execute `svn resolve --accept working <file_path>`
- **THEN** the system SHALL update the conflict list to remove the resolved file
- **THEN** if all conflicts are resolved, the system SHALL prompt for commit

### Requirement: Post-merge commit

After a successful merge (or after all conflicts are resolved), the system SHALL offer to commit the changes.

#### Scenario: User commits immediately

- **WHEN** the user clicks "Commit" after a successful merge
- **THEN** the system SHALL display a commit message input pre-filled with a default message: "Merge r{revisions} from {source} to {target}"
- **THEN** the user SHALL be able to edit the commit message
- **THEN** the system SHALL execute `svn commit -m "<message>" <target_wc_path>`
- **THEN** the system SHALL display the resulting commit revision number on success

#### Scenario: User defers commit

- **WHEN** the user clicks "Later" after a successful merge
- **THEN** the system SHALL close the commit prompt
- **THEN** the system SHALL keep the merged changes in the working copy without committing

#### Scenario: Commit failure

- **WHEN** `svn commit` fails (e.g., out-of-date working copy)
- **THEN** the system SHALL display the error message from SVN
- **THEN** the system SHALL suggest the user run `svn update` externally and retry
