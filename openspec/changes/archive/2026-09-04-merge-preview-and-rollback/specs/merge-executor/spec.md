## MODIFIED Requirements

### Requirement: Execute merge with selected revisions

The system SHALL execute `svn merge` with the selected revisions from the source branch into the target branch's working copy.

The merge command SHALL use the `--revision` flag with specific revision ranges derived from the user's selection (e.g., `svn merge -c 1234,1236,1240 <source_url> <target_wc_path>`).

When the "show merge preview" setting is enabled, the system SHALL run a dry-run merge (`svn merge --dry-run`) after pre-merge validation succeeds and before executing the real merge, and SHALL require the user to confirm a preview dialog before the working copy is modified. When the setting is disabled, the system SHALL execute the merge directly with no preview dialog.

#### Scenario: Successful merge without conflicts

- **WHEN** the user clicks "Merge" with revisions r1234 and r1236 selected and the preview is confirmed (or disabled)
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

#### Scenario: Preview dialog shown and confirmed

- **WHEN** the "show merge preview" setting is enabled and pre-merge validation has succeeded
- **THEN** the system SHALL run `svn merge --dry-run` for the selected revisions without modifying the working copy
- **THEN** the system SHALL display a dialog summarising the counts of files to be updated, added, deleted, and expected to conflict, with a scrollable full file list
- **WHEN** the user confirms the dialog
- **THEN** the system SHALL proceed to execute the real merge

#### Scenario: Preview dialog cancelled

- **WHEN** the merge preview dialog is shown and the user cancels it
- **THEN** the system SHALL NOT execute the merge
- **THEN** the target working copy SHALL remain unchanged

#### Scenario: Dry-run preview command fails

- **WHEN** the `svn merge --dry-run` command returns an error (e.g. authentication or network failure)
- **THEN** the system SHALL display the error message
- **THEN** the system SHALL offer the user a choice to skip the preview and merge directly, or to cancel
- **THEN** if the user cancels, the working copy SHALL remain unchanged

## ADDED Requirements

### Requirement: Abandon and roll back an uncommitted merge

When a merge has modified the target working copy but has not been committed, the system SHALL provide a single action to abandon the merge and restore the working copy to its pre-merge clean state. This action SHALL execute a recursive revert (`svn revert -R`) on the target working copy and SHALL remove the files that the dry-run preview identified as additions and that remain unversioned after the revert. The action SHALL NOT revert or remove anything that has already been committed, and SHALL NOT remove unversioned files that were not part of the merge.

The abandon action SHALL be available from the conflict-resolution dialog (before all conflicts are resolved) and from the merge-failure dialog. The system SHALL require a secondary confirmation before performing the rollback.

#### Scenario: Roll back from the conflict dialog

- **WHEN** conflicts are detected and the user clicks "Abandon merge and revert" in the conflict-resolution dialog
- **THEN** the system SHALL ask the user to confirm
- **WHEN** the user confirms
- **THEN** the system SHALL execute `svn revert -R <target_wc_path>`
- **THEN** the system SHALL delete the still-unversioned files that the dry-run preview listed as additions
- **THEN** the system SHALL report the number of reverted and removed files
- **THEN** the merge flow SHALL end without prompting for commit

#### Scenario: External-tool status polling stops when the dialog is dismissed

- **WHEN** the user has launched the external merge tool for a conflicted file and the conflict-resolution dialog is then dismissed (via "Abandon merge and revert", "close", "continue", "defer", or the window close control)
- **THEN** the system SHALL stop the background conflict-status poller for every file in that dialog
- **THEN** a later poll SHALL NOT run `svn resolve`, mark a file resolved, or re-open the conflict-resolution dialog
- **THEN** in particular, a file that `svn revert -R` has cleared of its conflict marker SHALL NOT be reported as "resolved"

#### Scenario: Roll back after a merge command failure

- **WHEN** `svn merge` returns an error and the merge-failure dialog is shown
- **THEN** the system SHALL provide an "Abandon merge and revert" action alongside the existing "copy error" and "close" actions
- **WHEN** the user confirms the rollback
- **THEN** the system SHALL run the recursive revert and additions cleanup on the target working copy

#### Scenario: Recursive revert fails

- **WHEN** the abandon action runs and `svn revert -R` returns an error
- **THEN** the system SHALL display the SVN error message
- **THEN** the system SHALL advise the user to revert manually in TortoiseSVN
- **THEN** the system SHALL NOT claim the working copy was restored

#### Scenario: Addition cleanup partially fails

- **WHEN** the recursive revert succeeds but one or more preview-identified addition files cannot be deleted (e.g. file locked)
- **THEN** the system SHALL list the files that could not be removed
- **THEN** the system SHALL still treat the revert itself as successful

##### Example: files acted on by rollback

- **GIVEN** the dry-run preview reported added: `src/new-a.js`, `src/new-b.js`; updated: `src/x.js`
- **AND** the user has a pre-existing unversioned file `notes.txt` unrelated to the merge
- **WHEN** the user abandons the merge
- **THEN** `svn revert -R` restores `src/x.js` and unschedules `src/new-a.js`, `src/new-b.js`
- **THEN** the system deletes `src/new-a.js` and `src/new-b.js` from disk
- **THEN** the system SHALL NOT delete `notes.txt`
