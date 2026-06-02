## MODIFIED Requirements

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

