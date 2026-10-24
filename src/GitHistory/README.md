# GitHistory

A **file or folder history view** in the style of the Git Extensions revision grid: the
commits in a grid with a branch graph, ref labels, author avatars, dates and SHAs, and
under it a detail panel with **Commit**, **Diff** and **Files** tabs.

The view is host-neutral. It runs no `git` and reads no file: commits, diffs and details
come from a `GitHistorySource` the host injects, which may run the `git` CLI in an Electron
main process, call a VS Code extension host, or ask a server. Every rich field is
optional — a host that supplies only SHA, author, date and subject gets a plain list with
the diff. It came from Pilot, the `portunix-vscode` desktop app (issue 053, INT-006), where
the Explorer opens it from its **Git → History** menu.

## Usage

```tsx
import { GitHistory, type GitHistorySource } from '@cassandragargoyle/react-components/git-history';

function FileHistory({ file, git }: { file: string; git: MyGitBridge }): React.ReactElement {
    // A new source object reloads the view, so build it once per file
    const source = useMemo<GitHistorySource>(
        () => ({
            loadCommits: ({ follow, skip, limit }) => git.log(file, { follow, skip, limit }),
            loadDiff: (commit, path) => git.show(commit.sha, path ?? commit.path ?? file),
            loadCommitDetails: (commit) => git.details(commit.sha),
            loadCommitFiles: (commit) => git.files(commit.sha),
            findCommit: (sha) => git.find(file, sha),
        }),
        [file, git],
    );

    return (
        <GitHistory
            path={file}
            branch="main"
            source={source}
            onCopySha={(commit) => navigator.clipboard.writeText(commit.sha)}
            onOpenLink={(url) => git.openExternal(url)}
        />
    );
}
```

For a folder pass `target="folder"` and the folder's path.

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `path` | `string` | — | Repository-relative path of the file or folder; header, and the Files tab's preselection |
| `source` | `GitHistorySource` | — | Supplies the data; a new object reloads the view |
| `target` | `'file' \| 'folder'` | `'file'` | History of one file, or of everything below a folder |
| `branch` | `string` | — | Branch label shown as `[branch]` next to the path |
| `pageSize` | `number` | `50` | Commits requested per page |
| `initialFollow` | `boolean` | `true` | Initial state of **Follow renames**; files only |
| `initialLayout` | `Partial<GitHistoryLayout>` | below, 45 % | Where the details sit (`vertical` = below, `horizontal` = beside) and the list's share |
| `onLayoutChange` | `(layout) => void` | — | Called after the layout toggle, a splitter drag or a splitter key, to persist it |
| `initialDiffMode` | `'unified' \| 'split'` | `'unified'` | Initial diff mode |
| `columns` | `Partial<Record<GitHistoryColumn, boolean>>` | all | `false` hides a column (`graph`, `author`, `date`, `age`, `sha`, `status`) |
| `initialColumnWidths` | `GitHistoryColumnWidths` | — | Widths of any columns in pixels, kept within 16–1600; the others keep their defaults |
| `onColumnWidthsChange` | `(widths) => void` | — | Called after a column border was dragged, moved by key or reset, to persist the widths |
| `formatDate` | `(iso) => string` | relative, English | The Age column, e.g. *3 days ago* |
| `formatColumnDate` | `(iso) => string` | `YYYY-MM-DD HH:mm` | The Date column, exact, local time |
| `formatFullDate` | `(iso) => string` | `YYYY-MM-DD HH:mm:ss` | Absolute date in the Commit tab |
| `resolveAvatarUrl` | `(email, commit) => string \| undefined` | — | Author image; without it the avatar shows initials. The view never fetches one itself |
| `linkify` | `(commit) => GitLink[]` | — | Links under the commit message, e.g. *View on GitHub*, *Issue 42* |
| `onOpenLink` | `(url) => void` | — | Opens web and `mailto:` links; without it they are plain anchors |
| `commitActions` | `(commit) => GitCommitAction[]` | — | Row actions: the `⋯` button, a right click, `Shift+F10` |
| `onCopySha` | `(commit) => void` | — | **Copy SHA** in the header and the Commit tab; hidden when omitted |
| `onSelectCommit` | `(commit) => void` | — | Called when the selection changes |
| `headerActions` | `ReactNode` | — | Extra host buttons at the end of the header |
| `labels` | `Partial<GitHistoryLabels>` | English | Override of any visible string |
| `className`, `style` | | — | Applied to the root `.git-history` element |

## Data Source

```ts
interface GitHistorySource {
    loadCommits(query: { follow: boolean; skip: number; limit: number }): Promise<GitHistoryPage>;
    loadDiff(commit: GitCommit, path?: string): Promise<string>;      // unified diff vs. first parent
    loadCommitDetails?(commit: GitCommit): Promise<GitCommitDetails>; // slow: containing branches/tags
    loadCommitFiles?(commit: GitCommit): Promise<GitChangedFile[]>;   // turns on the Files tab
    findCommit?(sha: string): Promise<GitCommit | null>;              // filter and parent links
}

interface GitCommit {
    sha: string; shortSha: string; author: string; date: string; subject: string;  // required
    path?: string;            // the file's path at this commit, after a rename
    parents?: string[];       // full SHAs after history simplification — draws the graph
    authorEmail?: string;     // avatar key, mail link, author highlight
    committer?: string;
    commitDate?: string;
    body?: string;            // message without the subject line
    refs?: GitRef[];          // { name, kind: 'head' | 'branch' | 'remote' | 'tag' }
    status?: 'success' | 'failure' | 'pending' | 'unknown';
}
```

`GitHistoryPage` is `{ commits, hasMore }`, newest first. `GitCommitDetails` is
`{ branches, tags, describe?: { tag, distance } }`. `GitChangedFile` is
`{ path, oldPath?, status, additions?, deletions?, lines? }`, where `lines` is the file's line
count after the commit (0 when deleted). A rejected promise is shown with the
error's `message`, so reject with a readable `Error`.

`parseUnifiedDiff(text)`, `layoutCommitGraph(commits)`, `changeWeight(file)`, `HeatGlyph` and
`DEFAULT_GIT_HISTORY_LABELS` are exported too. The graph layout is a pure function over the loaded commits: lane per
commit and the line segments of each row.

### Commands for a git-backed source

| Call | Command |
| ---- | ------- |
| `loadCommits` | `git log --parents --format=… [--skip] -n <limit+1> -- <path>` — the extra commit tells whether `hasMore`; `%P` gives the simplified parents, `%D` the refs |
| `loadDiff` | `git show -m --first-parent --format= <sha> -- <path>` |
| `loadCommitDetails` | `git branch -a --contains`, `git tag --contains`, `git describe --tags --abbrev=0` |
| `loadCommitFiles` | `git show --format= --name-status --numstat -M <sha>` |

Do not combine `--follow` with `--skip` or rely on its parents: git skips before it
switches to the earlier name, and drops commits from the graph. Collect the earlier names
with `git log --follow --name-only` first, then run a normal log over all of them — the
approach Git Extensions takes. A folder is never followed.

## Behavior

- **First page** — on mount, and whenever `path`, `source`, `pageSize` or the follow
  toggle changes, the list resets and the first page loads; the newest commit is selected.
  Answers to requests made before the reset are ignored.
- **Paging** — the next page loads when the list is scrolled to its end, when the
  selection moves past the last row, or from **Load more**.
- **Graph** — drawn when every loaded commit has `parents`, and hidden while filtering.
  Lanes take colours from `--git-history-lane-0` … `-7`; a merge is a hollow dot. A lane
  that continues on a later page stays open at the bottom.
- **Columns** — graph, message, author, date, age, SHA, status. A column without data
  hides itself (the status column when no commit has a status); `columns` hides any of
  them. **Date** shows the author date exactly, **Age** relatively; both carry the exact
  date with its time zone, and the commit date when it differs, in the tooltip.
- **Column widths** — every column has its own width and a border on its right in the
  header: dragging it changes that column alone and the columns after it move along;
  Left/Right move it by 10 px, a double click restores the default. Defaults: the graph
  fits its lanes, author 160, date 128, age 104, SHA 76, status 24 px; the message column
  takes the free width until it is resized, then it keeps its own width too and the free
  space stays after the last column. A grid wider than the pane scrolls sideways.
- **Ref labels** — the checked-out branch bold, branches solid, remotes dashed, tags with
  a tag glyph; more than three fold into `+N` with the rest in its tooltip.
- **Author highlight** — the other commits of the selected commit's author get a soft
  background and a bold name.
- **Filter** — case-insensitive over subject, author, e-mail, SHA prefix and ref names of
  the loaded commits. A hex filter of seven or more digits with no loaded match asks
  `findCommit`.
- **Keyboard** — the list is a `grid`: Up/Down, Page Up/Down and Home/End move the
  selection; `Shift+F10` or the context-menu key opens the row actions. The tabs follow the
  WAI-ARIA tabs pattern (Left/Right, Home/End). The splitter is a `separator` moved by the
  arrow keys.
- **Long lists** — above 200 commits only the visible rows are rendered.
- **Tabs** — *Commit*: avatar, author and e-mail, author and commit dates, hash, parents
  (a click selects the parent), the full message, related links and, loaded lazily, the
  containing branches and tags and the nearest tag. *Diff*: the history file's diff,
  unified or split; not shown for a folder. *Files*: every file of the commit with its
  status and line counts, and the chosen file's diff; for a folder only the files below it,
  with a switch for all.
- **Change weight** — each row of the Files tab ends with `+additions −deletions` and a mark
  of how much of *that file* the commit changed: changed lines over the larger of the line
  counts before and after (`changeWeight`). Up to 5 % `·`, 20 % `○`, 50 % `●`, above `◉`; an
  added or deleted file is `◉`; a rename or a binary has no mark, and so has a file without
  `lines`. The tooltip and the row's accessible name say it in words. The glyph is
  `HeatGlyph`, the same one Pilot uses for its Explorer commit heat; colour it through
  `--git-history-weight-color`.
- **States** — loading and error of the whole view use `ProgressPanel`; no commits shows
  the empty state; a failed diff, file list, detail or next page is reported in place.

## Styling

The stylesheet is injected once on first use and scoped to `.git-history-*` classes. The
root fills its parent's height (`height: 100%`), so give the parent a height. Colours read
the VS Code theme variables (`--vscode-diffEditor-*`, `--vscode-list-*`, `--vscode-charts-*`,
`--vscode-testing-icon*`, `--vscode-editor-font-family`, …) with dark-theme fallbacks; the
lane colours, `--git-history-graph-hollow` and `--git-history-ref-border` can be set on
`.git-history`. Every interactive element has a `:focus-visible` outline.

## Files

- `GitHistory.tsx` — the component, its props, layout and default labels
- `CommitList.tsx` — the commit grid with columns, windowing and row actions
- `CommitGraphCell.tsx` — one row of the graph as SVG
- `layoutCommitGraph.ts` — the lane layout of the graph
- `RefLabels.tsx` — ref chips
- `HeatGlyph.tsx` — the four-step heat glyph
- `changeWeight.ts` — the change weight of a file in a commit
- `CommitMenu.tsx` — the row action menu
- `DetailPanel.tsx` — the Commit, Diff and Files tabs
- `DiffView.tsx` — unified and split diff tables
- `parseUnifiedDiff.ts` — the unified-diff parser
- `types.ts` — the data-source contract and the shapes it returns
- `GitHistory.css` — scoped stylesheet
- `*.test.ts(x)` — unit tests
- `index.ts` — public exports

The behaviour follows Git Extensions, which is GPL-3.0; nothing here is taken from its code.

---

**Created**: 2026-10-23
**Last Updated**: 2026-10-23
