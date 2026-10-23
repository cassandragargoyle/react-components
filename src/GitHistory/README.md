# GitHistory

A **file history view**: the commits that touched one file in a paged list on the left, and
the selected commit's change to that file as a unified diff on the right.

The view is host-neutral. It runs no `git` and reads no file: the commits and the diffs
come from a `GitHistorySource` the host injects, which may run the `git` CLI in an Electron
main process, call a VS Code extension host, or ask a server. It came from Pilot, the
`portunix-vscode` desktop app (issue 053), where the Explorer opens it from its
**Git → History** menu.

## Usage

```tsx
import { GitHistory, type GitHistorySource } from '@cassandragargoyle/react-components/git-history';

function FileHistory({ file, git }: { file: string; git: MyGitBridge }): React.ReactElement {
    // A new source object reloads the view, so build it once per file
    const source = useMemo<GitHistorySource>(
        () => ({
            loadCommits: ({ follow, skip, limit }) => git.log(file, { follow, skip, limit }),
            loadDiff: (commit) => git.show(commit.sha, commit.path ?? file),
        }),
        [file, git],
    );

    return (
        <GitHistory
            path={file}
            branch="main"
            source={source}
            onCopySha={(commit) => navigator.clipboard.writeText(commit.sha)}
        />
    );
}
```

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `path` | `string` | — | Path shown in the header; display only |
| `source` | `GitHistorySource` | — | Supplies the commits and diffs; a new object reloads the view |
| `branch` | `string` | — | Branch label shown as `[branch]` next to the path |
| `pageSize` | `number` | `50` | Commits requested per page |
| `initialFollow` | `boolean` | `true` | Initial state of the **Follow renames** toggle |
| `formatDate` | `(iso) => string` | relative, English | Display form of a commit date; the ISO date stays in the tooltip |
| `onCopySha` | `(commit) => void` | — | **Copy SHA** button for the selected commit; hidden when omitted |
| `onSelectCommit` | `(commit) => void` | — | Called when the selection changes by click or keyboard |
| `headerActions` | `ReactNode` | — | Extra host buttons at the end of the header |
| `labels` | `Partial<GitHistoryLabels>` | English | Override of any visible string |
| `className`, `style` | | — | Applied to the root `.git-history` element |

The data source:

```ts
interface GitHistorySource {
    // One page, newest first; skip = commits already loaded
    loadCommits(query: { follow: boolean; skip: number; limit: number }): Promise<GitHistoryPage>;
    // Unified-diff text of one commit for the file, against its first parent
    loadDiff(commit: GitCommit): Promise<string>;
}

interface GitHistoryPage {
    commits: GitCommit[];
    hasMore: boolean;          // false when the list is complete
}

interface GitCommit {
    sha: string;               // full, the row key
    shortSha: string;
    author: string;
    date: string;              // ISO 8601
    subject: string;
    path?: string;             // the file's path at this commit, after a rename
}
```

A rejected promise is shown in the error state with the error's `message`, so reject with
a readable `Error` (*git is not installed*, *not a git repository*).

`parseUnifiedDiff(text)` and `DEFAULT_GIT_HISTORY_LABELS` are exported too. The parser is a
pure function that turns unified-diff text into files, hunks and numbered lines; it reads
`git diff`, `git show` and plain `diff -u` output.

### Commands for a git-backed source

| Call | Command |
| ---- | ------- |
| `loadCommits` | `git log [--follow] --skip=<skip> -n <limit+1> --format=… -- <file>` — the extra commit tells whether `hasMore` |
| `loadDiff` | `git show <sha> --format= -- <path>` — a root commit diffs against the empty tree |

With `--follow`, add `--name-only` (or `--name-status`) to learn each commit's path, and
pass it as `GitCommit.path`, so `loadDiff` asks for the file under its name at that commit.
Do not combine `--follow` with `--skip`: git skips before it switches to the earlier name,
and the history behind a rename is lost. Request `skip + limit + 1` commits with `-n`
instead and drop the first `skip`.

## Behavior

- **First page** — on mount, and whenever `path`, `source`, `pageSize` or the follow
  toggle changes, the list resets and the first page loads. The newest commit is selected
  and its diff loaded. An answer to a request made before the reset is ignored.
- **Paging** — the next page loads when the list is scrolled to its end, when the
  selection moves past the last row, or from the **Load more** button.
- **Keyboard** — the list is a `listbox`: Up/Down move the selection, Home/End jump to the
  first/last loaded commit. The selected row is kept in view.
- **States** — the loading and error states of the whole view use `ProgressPanel`; a file
  without commits shows the empty state. A failed diff or a failed next page is reported
  in place, and the list stays usable.
- **Diff** — one section per file in the diff, with old and new line numbers. Added and
  deleted files and renames are named in the section title; a binary change is reported
  and not shown. Unified view only; there is no syntax highlighting.

## Styling

The stylesheet is injected once on first use and scoped to `.git-history-*` classes. The
root fills its parent's height (`height: 100%`), so give the parent a height. Colours read
the VS Code theme variables (`--vscode-diffEditor-insertedLineBackground`,
`--vscode-diffEditor-removedLineBackground`, `--vscode-list-activeSelectionBackground`,
`--vscode-editor-font-family`, …) with dark-theme fallbacks, and every interactive element
has a `:focus-visible` outline.

## Files

- `GitHistory.tsx` — the component, its props and the default labels
- `CommitList.tsx` — the paged, keyboard-navigable commit list
- `DiffView.tsx` — the unified diff table
- `parseUnifiedDiff.ts` — the unified-diff parser
- `types.ts` — the data-source contract and the parsed diff shapes
- `GitHistory.css` — scoped stylesheet
- `GitHistory.test.tsx`, `parseUnifiedDiff.test.ts` — unit tests
- `index.ts` — public exports

---

**Created**: 2026-10-23
**Last Updated**: 2026-10-23
