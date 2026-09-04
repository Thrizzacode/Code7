## ADDED Requirements

### Requirement: Dry-run merge preview

The SVN bridge SHALL provide a merge-preview operation that runs `svn merge` with the `--dry-run` flag so that no changes are written to the working copy. It SHALL accept the same source URL, target working-copy path, and revision list as the real merge operation, and SHALL build one `-c <rev>` argument per selected revision.

The operation SHALL parse the command output into categorised file lists — updated, added, deleted, and conflicted — and SHALL also return the raw output. On command failure it SHALL return a structured error without throwing.

#### Scenario: Preview returns categorised changes

- **WHEN** the renderer requests a merge preview for revisions r1234 and r1236
- **THEN** the bridge SHALL execute `svn merge -c 1234 -c 1236 --dry-run <source_url> <target_wc_path>`
- **THEN** the bridge SHALL return `{ success: true, preview: { updated, added, deleted, conflicted, raw } }`
- **THEN** the target working copy SHALL be unchanged

#### Scenario: Preview command fails

- **WHEN** the dry-run merge command exits with an error
- **THEN** the bridge SHALL return `{ success: false, error }` with the SVN error details
- **THEN** the bridge SHALL NOT throw

##### Example: output line classification

| Output line prefix | Category |
|--------------------|----------|
| `U    src/x.js`    | updated  |
| `A    src/new.js`  | added    |
| `D    src/old.js`  | deleted  |
| `C    src/c.js`    | conflicted |
| `   C src/tree.js` | conflicted |

### Requirement: Recursive working-copy revert

The SVN bridge revert operation SHALL support a recursive mode that executes `svn revert -R <path>` to restore an entire working-copy subtree, including reverting conflicted files and removing their `.mine` / `.r<N>` conflict artifact files. When the recursive option is not supplied, the revert operation SHALL behave as before (non-recursive revert of the given path or paths), preserving backward compatibility.

#### Scenario: Recursive revert of a working copy

- **WHEN** the renderer requests a revert of a working-copy path with the recursive option enabled
- **THEN** the bridge SHALL execute `svn revert -R <path>`
- **THEN** the bridge SHALL return `{ success: true }` with the command output on success

#### Scenario: Non-recursive revert unchanged

- **WHEN** the renderer requests a revert without the recursive option
- **THEN** the bridge SHALL execute `svn revert <path>` exactly as in the previous behavior

#### Scenario: Recursive revert fails

- **WHEN** `svn revert -R` exits with an error
- **THEN** the bridge SHALL return `{ success: false, error }` with the SVN error details
- **THEN** the bridge SHALL NOT throw
