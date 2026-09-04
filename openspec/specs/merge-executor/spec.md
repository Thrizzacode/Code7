# merge-executor Specification

## Purpose

TBD - created by archiving change 'init-svn-viewer'. Update Purpose after archive.

## Requirements

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


<!-- @trace
source: merge-preview-and-rollback
updated: 2026-09-04
code:
  - build-1.10.0.log
  - bash.exe.stackdump
  - svn-merge-helper/test-merge-tool.js
  - sh.exe.stackdump
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/CHANGELOG.md
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/main/config-manager.js
  - svn-merge-helper/src/renderer/js/settings.js
-->

---
### Requirement: Pre-merge working copy validation

Before executing a merge, the system SHALL validate that the target working copy is in a clean state and is up to date with the SVN server.

#### Scenario: Clean working copy

- **WHEN** the target working copy has no uncommitted changes (`svn status` returns empty)
- **THEN** the system SHALL proceed with the merge

#### Scenario: Dirty working copy

- **WHEN** the target working copy has uncommitted changes
- **THEN** the system SHALL display a warning listing the modified files
- **THEN** the system SHALL ask the user to confirm whether to proceed anyway or abort

#### Scenario: Working copy behind HEAD before merge

- **WHEN** the local working copy revision is less than the HEAD revision on the SVN server
- **THEN** the system SHALL display a confirmation dialog showing the local revision and the HEAD revision
- **THEN** the system SHALL require the user to confirm before proceeding with the merge
- **THEN** if the user cancels, the merge operation SHALL be aborted with no changes made

#### Scenario: Update check fails before merge

- **WHEN** the `svn info` call to retrieve the HEAD revision fails (e.g., network error or timeout)
- **THEN** the system SHALL silently skip the update check
- **THEN** the system SHALL proceed with the merge without blocking the user

##### Example: revision comparison at merge time

| Local revision | HEAD revision | Outcome |
| -------------- | ------------- | ------- |
| r100           | r105          | Show warning dialog; user must confirm to proceed |
| r105           | r105          | No dialog; merge proceeds immediately |
| r105           | r100          | No dialog (local is not behind); merge proceeds immediately |


<!-- @trace
source: merge-precheck-update-validation
updated: 2026-06-02
code:
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/test-merge-tool.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/renderer/js/merge-context.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/index.html
-->

---
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

---
### Requirement: Post-merge commit

After a successful merge (or after all conflicts are resolved), the system SHALL offer to commit the changes. Before executing the commit, the system SHALL proactively check whether the working copy is up to date with the SVN server.

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

#### Scenario: Working copy behind HEAD before post-merge commit

- **WHEN** the user clicks "Commit" and the local working copy revision is less than the HEAD revision
- **THEN** the system SHALL display a confirmation dialog showing the local revision and the HEAD revision
- **THEN** the system SHALL require the user to confirm before executing the commit
- **THEN** if the user cancels, the commit SHALL be aborted and the merged changes SHALL remain in the working copy

#### Scenario: Update check fails before post-merge commit

- **WHEN** the `svn info` call to retrieve the HEAD revision fails before committing
- **THEN** the system SHALL silently skip the update check
- **THEN** the system SHALL proceed with the commit attempt without blocking the user

#### Scenario: Commit failure

- **WHEN** `svn commit` fails (e.g., out-of-date working copy)
- **THEN** the system SHALL display the error message from SVN
- **THEN** the system SHALL suggest the user run `svn update` externally and retry

<!-- @trace
source: merge-precheck-update-validation
updated: 2026-06-02
code:
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/test-merge-tool.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/renderer/js/merge-context.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/index.html
-->

---
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

<!-- @trace
source: merge-preview-and-rollback
updated: 2026-09-04
code:
  - build-1.10.0.log
  - bash.exe.stackdump
  - svn-merge-helper/test-merge-tool.js
  - sh.exe.stackdump
  - svn-merge-helper/src/preload/preload.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/index.html
  - svn-merge-helper/CHANGELOG.md
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/main/main.js
  - svn-merge-helper/src/main/svn-bridge.js
  - svn-merge-helper/src/main/config-manager.js
  - svn-merge-helper/src/renderer/js/settings.js
-->