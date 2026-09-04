# chained-merge Specification

## Purpose

TBD - created by archiving change 'chained-merge'. Update Purpose after archive.

## Requirements

### Requirement: Initiate a chained merge across environments

The system SHALL provide a chained merge mode on the Merge page that performs a continuous `branches → qat → stg` merge in a single user-initiated flow. The mode SHALL be entered via a "merge through to STG" checkbox in the action bar. When the checkbox is enabled, the system SHALL reveal a STG target-version selector so the user can choose all three versions (`branches/vA`, `qat/vB`, `stg/vC`) before starting.

The chained merge SHALL be available only when the source environment is `branches`, the target environment is `qat`, and a STG target version is selected. When these preconditions are not met, the "Merge" button SHALL perform the existing single-stage merge unchanged.

#### Scenario: Chained mode enabled with valid selection

- **WHEN** the source is `branches/vA`, the target is `qat/vB`, the "merge through to STG" checkbox is checked, and `stg/vC` is selected
- **THEN** the system SHALL enable the chained merge and, on "Merge", run the `branches → qat → stg` sequence

#### Scenario: Preconditions not met

- **WHEN** the "merge through to STG" checkbox is checked but the source is not `branches`, or the target is not `qat`, or no STG version is selected
- **THEN** the system SHALL NOT start a chained merge
- **THEN** the system SHALL surface a hint explaining the required selection and SHALL keep the single-stage merge behavior on the "Merge" button

#### Scenario: Chained mode disabled

- **WHEN** the "merge through to STG" checkbox is unchecked
- **THEN** the "Merge" button SHALL perform the existing single-stage merge with identical behavior to the current implementation


<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Sequence stages branches → qat → stg

The system SHALL execute the chained merge as an ordered two-stage sequence: stage 1 merges `branches/vA` into the `qat/vB` working copy, and stage 2 merges `qat/vB` into the `stg/vC` working copy. The system SHALL begin a stage only after the previous stage has been committed.

Before executing each stage's merge, the system SHALL run the existing pre-merge validation (dirty working-copy confirmation and behind-HEAD confirmation). If validation is aborted by the user, the chained merge SHALL halt at that stage.

#### Scenario: Both stages complete without conflicts

- **WHEN** the user starts a chained merge and neither stage produces conflicts
- **THEN** the system SHALL merge and commit stage 1 (`branches → qat`), then merge and commit stage 2 (`qat → stg`)
- **THEN** the system SHALL display a completion message indicating the full `branches → qat → stg` chain finished

#### Scenario: Pre-merge validation aborted at a stage

- **WHEN** the user cancels the dirty working-copy or behind-HEAD confirmation for a stage
- **THEN** the system SHALL halt the chained merge at that stage and SHALL NOT start any subsequent stage


<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Relay the committed revision to the next stage

The first stage SHALL merge the revisions the user selected in the revision picker. Each subsequent stage SHALL use the revision produced by committing the previous stage as its single source revision (`svn merge -c <previousCommitRevision>`), and SHALL NOT use the revision picker. The system SHALL NOT reuse the originally selected branch revision numbers as the source for stage 2.

#### Scenario: Stage 2 merges the qat commit revision

- **WHEN** stage 1 commits the merged `branches` revisions into `qat` and produces a new commit revision
- **THEN** stage 2 SHALL merge that new commit revision (not the original `branches` revisions) from `qat` into the `stg` working copy

##### Example: revision relay values

- **GIVEN** the user selects `branches` revisions r1234 and r1236 for stage 1
- **WHEN** stage 1 commits into `qat` and produces revision r5001
- **THEN** stage 2 SHALL run `svn merge -c 5001 <qatUrl> <stgWcPath>`
- **THEN** stage 2 SHALL NOT reference r1234 or r1236 as the source revision


<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Require a confirmed commit at each stage

Each stage in the chained merge SHALL require a commit before the chain continues. The system SHALL present a commit-message dialog at each stage for the user to review and edit, and SHALL NOT auto-commit silently. The "commit later" option SHALL NOT be available during a chained merge. After a confirmed commit, the system SHALL automatically proceed to the next stage without requiring the user to reselect source/target or re-pick revisions.

#### Scenario: Commit confirmed, chain advances

- **WHEN** a stage's merge succeeds and the user confirms the commit dialog
- **THEN** the system SHALL execute the commit, capture the new commit revision, and automatically start the next stage's merge using that revision

#### Scenario: Stage produces no changes

- **WHEN** a stage's merge succeeds but introduces no changes to the working copy
- **THEN** the system SHALL skip that stage's commit, surface a notice, and SHALL NOT create an empty commit


<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Pause on conflicts and auto-resume

When a stage's merge produces conflicts, the system SHALL pause the chained merge and present the existing conflict-resolution flow (external merge tool per conflicted file). When all conflicts for that stage are resolved, the system SHALL automatically continue to that stage's commit confirmation and then to the next stage, without the user reselecting branches or revisions.

#### Scenario: Conflict resolved then chain continues

- **WHEN** stage 1 (`branches → qat`) produces conflicts and the user resolves all of them with the external tool
- **THEN** the system SHALL run `svn resolve` for each resolved file, present the stage 1 commit confirmation, and on confirmation proceed automatically to stage 2 (`qat → stg`)


<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Halt at current stage on interruption, preserving completed stages

If the user interrupts the chained merge — by closing the conflict-resolution dialog before all conflicts are resolved, or by cancelling a commit dialog — the system SHALL halt at the current stage. The system SHALL preserve any stage already committed and SHALL NOT roll it back. The system SHALL NOT start any subsequent stage. The system SHALL display which stages completed and at which stage the chain stopped, indicating that the remaining stage can be performed later.

When the chain halts at a stage whose merge has modified that stage's working copy but has not yet been committed, the halt dialog SHALL offer an action to roll back that current stage's working copy to its pre-merge state, using the same recursive revert and additions-cleanup behavior as a single-stage merge abandon. This rollback SHALL apply only to the current uncommitted stage's working copy. Already-committed stages SHALL never be offered for rollback.

#### Scenario: Cancel commit after stage 1

- **WHEN** stage 1 (`branches → qat`) has been committed and the user cancels the stage 2 commit dialog or closes the stage 2 conflict dialog before resolving all conflicts
- **THEN** the system SHALL keep the stage 1 `qat` commit intact, SHALL leave the `stg` working copy unmodified, and SHALL show a message that the chain stopped at `qat → stg` and can be resumed later

#### Scenario: Roll back the current uncommitted stage on halt

- **WHEN** the chain halts at a stage because the user closed the conflict dialog before resolving all conflicts, and that stage's merge has modified its working copy but has not been committed
- **THEN** the halt dialog SHALL present a "roll back this stage" action
- **WHEN** the user confirms that action
- **THEN** the system SHALL run `svn revert -R` plus additions cleanup on that stage's target working copy only
- **THEN** any earlier committed stage SHALL remain untouched

#### Scenario: No rollback offered for committed stages

- **WHEN** the chain halts after one or more stages have already been committed
- **THEN** the halt dialog SHALL NOT offer to roll back any committed stage
- **THEN** the completed-stages list SHALL be shown as preserved


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
### Requirement: Require the STG working copy before starting

Before starting a chained merge, the system SHALL verify that the `stg/vC` target working copy exists locally. If it does not exist, the system SHALL block the chained merge and guide the user to sync the version locally using the existing sync-to-local flow before retrying.

#### Scenario: STG working copy missing

- **WHEN** the user starts a chained merge but the selected `stg/vC` working copy is not present locally
- **THEN** the system SHALL NOT start the merge and SHALL prompt the user to sync the STG version to local first

<!-- @trace
source: chained-merge
updated: 2026-06-03
code:
  - svn-merge-helper/src/renderer/js/log-manager.js
  - svn-merge-helper/src/renderer/js/app.js
  - svn-merge-helper/src/renderer/js/merge-executor.js
  - svn-merge-helper/src/renderer/js/chained-merge.js
  - svn-merge-helper/src/renderer/styles/main.css
  - svn-merge-helper/src/renderer/index.html
  - bash.exe.stackdump
  - svn-merge-helper/src/renderer/js/branch-selector.js
  - svn-merge-helper/src/renderer/js/utils.js
  - svn-merge-helper/src/renderer/js/commit-manager.js
-->

---
### Requirement: Merge preview before each chained stage

When the "show merge preview" setting is enabled, the system SHALL run a dry-run merge preview before executing the real merge for each stage of the chained merge, and SHALL require the user to confirm the preview before that stage's working copy is modified. When the user cancels a stage's preview, the system SHALL halt the chain at that stage without modifying that stage's working copy, preserving any already-committed stages.

#### Scenario: Confirm preview for each stage

- **WHEN** the chained merge reaches a stage and the preview setting is enabled
- **THEN** the system SHALL run `svn merge --dry-run` for that stage's source and revisions
- **THEN** the system SHALL show the preview dialog for that stage
- **WHEN** the user confirms
- **THEN** the system SHALL execute that stage's real merge

#### Scenario: Cancel a stage preview

- **WHEN** the user cancels the preview dialog for stage 2 of a chained merge
- **THEN** the system SHALL halt the chain at stage 2
- **THEN** the stage 2 working copy SHALL remain unmodified
- **THEN** the stage 1 commit SHALL be preserved

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