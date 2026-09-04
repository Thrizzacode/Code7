## MODIFIED Requirements

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

## ADDED Requirements

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
