---
title: INT-006 - GitHistory, a host-neutral file history view with a unified diff
description: Apply when working on GitHistory — its data source, the commit list and paging, the diff parser and view, and the loading, empty and error states.
category: specification
ai_load: on-demand
status: active
created: 2026-10-23
related:
  - src/GitHistory/
  - docs/architecture/GUI-DESIGN-PRINCIPLES.md
---

# INT-006 - GitHistory, a host-neutral file history view with a unified diff

## Metadata

- **Status**: 🔄 In Progress
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-10-23
- **Version**: 0.4.0 (phase 1, the simple view), 0.5.0 (phase 2, the rich view)
- **Author**: Zdenek
- **Target**: `src/GitHistory/` (new component), entry point `/git-history`
- **GitHub**: [#6](https://github.com/cassandragargoyle/react-components/issues/6)
- **Related**:
  - `portunix-vscode` issue 053 — the Explorer **Git → History** menu that opens this view
  - [GUI Design Guidelines](../architecture/GUI-DESIGN-PRINCIPLES.md) — theme, icons,
    interaction states

## Summary

A view of the history of one file: the commits that touched it in a paged list, and the
selected commit's change to the file as a unified diff. It is written for Pilot's Explorer,
but Git history is not a Pilot subject, so the view lives here and any host can feed it.

The work has two phases. **Phase 1** (0.4.0, implemented) is a simple list and diff.
**Phase 2** (0.5.0) turns it into a rich history view in the style of Git Extensions'
revision grid: a commit graph, branch and tag labels, avatars and columns in the list, and
a commit detail panel with tabs under it. See [Phase 2](#phase-2---rich-history-view).

## Requirements

### Host neutrality

- The component runs no `git`, reads no file and calls no host API. Commits and diffs come
  from an injected `GitHistorySource` of two async functions:
  - `loadCommits({ follow, skip, limit })` returns a page `{ commits, hasMore }`, newest
    first
  - `loadDiff(commit)` returns the unified-diff text of that commit for the file
- A rejected promise is shown with the error's message.
- Changing `path`, `source`, `pageSize` or the follow mode resets the view; answers to the
  earlier requests are ignored.

### Layout

- **Header**: the path, the branch label, the **Follow renames** toggle, **Copy SHA** (only
  with `onCopySha`) and host buttons through `headerActions`.
- **Left**: the commit list — short SHA, subject, author, relative date with the ISO date
  in the tooltip. The newest commit is selected after the first page.
- **Right**: the selected commit's subject and meta, then its diff for the file, one section
  per file in the diff, with old and new line numbers and added/removed colouring.

### Paging and keyboard

- The next page loads when the list is scrolled to the end, when the selection moves past
  the last row, or from **Load more**.
- The list is a `listbox`; Up/Down move the selection, Home/End jump.

### States

- Loading and error of the whole view use `ProgressPanel`.
- No commits: an empty state (*No history for this file*).
- A failed diff or next page is reported in place; the list stays usable.

### Diff parsing

- `parseUnifiedDiff(text)` is exported — a pure parser of `git diff`, `git show` and
  `diff -u` output into files, hunks and numbered lines.
- It handles added, deleted and renamed files, binary changes, the `\ No newline at end of
  file` marker, and removed or added lines that start like a header (`---`, `+++`, `@@`).

### Packaging

- Entry point `/git-history` with no optional peer (checked by `npm run test:entries`).
- Every string overridable through `labels`; `DEFAULT_GIT_HISTORY_LABELS` exported.
- A demo page at `/demo/git-history.html` over an in-memory source.

## Phase 2 - Rich History View

Phase 2 is modelled on the revision grid of Git Extensions (reference screenshot
`commitlog205.png`, not stored in the repository because it shows real people). Every new
field is **optional**: a host that supplies only the phase 1 fields still gets the simple
view, and each column or panel appears only when its data is present.

### Reference: Git Extensions

[Git Extensions](https://github.com/gitextensions/gitextensions) is the model for the
behaviour and may be studied for it. Its code is **GPL-3.0** and this library is MIT, so
nothing is copied or translated from it: the graph layout, the columns and the panel are
written here from the behaviour, not from the source. Parts worth reading for the
behaviour, under `src/app/GitUI/UserControls/RevisionGrid/`:

- `Graph/` — lane assignment (`RevisionGraph`, `LaneInfoProvider`, `LaneSharing`), lane
  colours (`RevisionGraphLaneColor`) and segment drawing (`Rendering/`)
- `Columns/` — one provider per column (graph, message with ref labels, avatar, author,
  date, commit id, build status) and the hover highlight
- `RevisionGridControl.cs` — the path filter of a file or folder history and the
  two-step follow of renames; `src/app/GitUI/CommandsDialogs/FormFileHistory.cs` — which
  tabs a file and a folder history show

### Rich Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ src/foo/Bar.ts  [main]        Filter: [__________]   ⤺ follow   ⇅ layout   ⋯     │ toolbar
├─────────────────────────────────────────────────────────────────────────────────┤
│ │●  [origin/main] Merge pull request #61 from x/fix  (JD) J. Doe   14 h ago ec51e441 ● │
│ ├─● [x/fix] (Try to) fix the unit test              (AR) A. Roe     21 h ago 1ca4fbc3 ● │
│ │ ●  README: improve download links                 (AR) A. Roe     1 d ago  8e6ea009 ● │ selected
│ ●─┘  Sign developer certificate of origin (#58)     (SL) S. Lee     1 d ago  4ef634e8   │
├─────────────────────────────────────────────────────────────────────────────────┤ splitter
│ [Commit] [Diff] [Files]                                                          │ tabs
│ (AR)  Author:       Alex Roe <alex.roe@example.com>                               │
│       Author date:  1 day ago (2019-02-17 00:24:07)                               │
│       Commit date:  23 hours ago (2019-02-17 23:28:22)                            │
│       Commit hash:  8e6ea009bf99033c5e035d9384c0bdc9ce8fbef3                      │
│       Parent:       3d8a57c155                                                    │
│ ┌───────────────────────────────────────────────────────────────────────────┐   │
│ │ README: Improve download links                                              │   │
│ │                                                                             │   │
│ │ * pointing towards the last release …   Partly fix #6252                    │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│ Related links: View on GitHub, Issue 6252                                         │
│ Contained in branches: main, origin/main · Contained in tags: v3.0.0             │
│ Derives from tag: v3.00.00-rc2 + 186 commits                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Layout**: the list above the detail panel (default, as in the screenshot) or beside it
  (phase 1). Toggled in the toolbar and set by the `layout` prop; the splitter between the
  two is draggable and its position is reported through `onLayoutChange` so a host can
  keep it.

### Commit list

Columns, from left to right; a column without data in the loaded commits is hidden:

| Column | Content | Data |
| ------ | ------- | ---- |
| Graph | Lanes and commit dots; merges and branch points drawn as curves | `parents` |
| Refs + subject | Labels of branches, remote branches and tags, then the subject | `refs`, `subject` |
| Author | Avatar and name | `author`, `authorEmail`, avatar from the host |
| Date | Relative date, full date in the tooltip | `date` |
| SHA | Short SHA, monospace | `shortSha` |
| Status | A dot for the build or check status | `status` |

- **Graph**: the lanes are computed in the component from `parents` by an exported pure
  function `layoutCommitGraph(commits)` (lane per row, edges to the next row), tested on its
  own. It works page by page: a lane that continues into a not-yet-loaded page stays open
  at the bottom. Lane colours come from a palette of theme variables
  (`--git-history-lane-0` … `-7`, falling back to `--vscode-charts-*`); a merge commit is a
  hollow dot, the selected commit's lane is emphasised.
- **Ref labels**: one chip per ref, with a kind (`head`, `branch`, `remote`, `tag`) that
  sets an outline style — the current `HEAD` branch is bold, remote branches are dashed,
  tags have a tag glyph. Monochrome by default, theme variables to colour them. Long label
  lists are cut with a `+N` chip whose tooltip lists the rest.
- **Author avatars**: the library's own [`Avatar`](../../src/Avatar/) component is used —
  no second avatar implementation. It shows initials with a colour that is stable per
  author (seeded by the e-mail). The host may give an image through
  `resolveAvatarUrl(email)`, which becomes `Avatar`'s `avatarUrl`; the component never
  fetches a remote image on its own (offline by default). For use in a list row `Avatar`
  needs a non-interactive mode (no popup menu, no focus stop) and overridable menu texts
  (today they are fixed Czech strings); both are part of phase 2.
- **Author highlight**: rows by the author of the selected commit get a soft highlight and
  a bold author name, as in the screenshot.
- **Status dot**: `status` is `success | failure | pending | unknown`; shown with a
  colour *and* a shape or tooltip, so it does not rely on colour alone.
- **Filter**: a text box filters the loaded commits by subject, author or SHA. Typing a
  full or abbreviated SHA that is not loaded asks the host (`findCommit`, optional).
- **Row actions**: a `⋯` button on hover and a context menu (keyboard: `Shift+F10`)
  offering host-provided actions through `commitActions(commit)` — Copy SHA, Copy
  subject, Open on the web, and anything the host adds.

### Commit detail panel

Tabs, each shown only when the host supports it:

- **Commit**: avatar, author with e-mail (a link through `onOpenLink('mailto:…')`), author
  date and commit date (relative and absolute), full hash (copyable), parents as links —
  a click selects a loaded parent, or asks the host to load it. Then the full commit
  message, with its line breaks kept.
  - **Related links**: `linkify(commit)` returns `{ label, url }[]` (e.g. *View on GitHub*,
    *Issue 6252* from `#6252` in the message); opened through `onOpenLink`.
  - **Contained in branches / tags** and **Derives from tag + N commits**: loaded lazily
    through `loadCommitDetails(commit)` because they are slow to compute; shown with a
    small loading line until they arrive.
- **Diff**: the phase 1 diff of the file; adds a **split** (side-by-side) mode next to
  unified. Hidden for a folder (see [Folder history](#folder-history)).
- **Files**: every file the commit changed (`loadCommitFiles(commit)` → path, status
  A/M/D/R, added/removed line counts); selecting one shows its diff
  (`loadDiff(commit, path)`). The file of this history is selected first.

Console and Build Report from the screenshot are left out (see Out of Scope).

### Folder history

The history may be of a folder as well as of a file, following Git Extensions, where a
path ending in `/` filters the revision grid to the commits that touched anything below
it. A new prop `target: 'file' | 'folder'` (default `'file'`) switches the view:

| | File | Folder |
| - | ---- | ------ |
| Commits | that touched the file | that touched any file below the folder |
| Follow renames | toggle shown | hidden — `git log --follow` takes exactly one file |
| Header | file path | folder path with a trailing `/` |
| Commit tab | yes | yes |
| Diff tab | the file's diff | hidden, as in Git Extensions — there is no single file |
| Files tab | every file of the commit, this file first | the commit's files **below the folder**, the first selected and its diff shown; other files of the commit behind a *Show all files* switch |

Git Extensions shows only the Commit tab for a folder; the Files tab here goes one step
further so the change itself stays one click away. `GitCommit.path` is not used for a
folder.

### Data source additions

```ts
interface GitRef {
    name: string;                                   // 'main', 'origin/main', 'v1.0.0'
    kind: 'head' | 'branch' | 'remote' | 'tag';     // 'head' = the checked-out branch
}

interface GitCommit {
    // phase 1 fields …
    parents?: string[];         // full SHAs, after history simplification for the file
    authorEmail?: string;
    commitDate?: string;        // ISO 8601; date stays the author date
    committer?: string;
    body?: string;              // full message without the subject line
    refs?: GitRef[];
    status?: 'success' | 'failure' | 'pending' | 'unknown';
}

interface GitCommitDetails {
    branches: string[];
    tags: string[];
    describe?: { tag: string; distance: number };   // "Derives from tag … + N commits"
}

interface GitChangedFile {
    path: string;
    oldPath?: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    additions?: number;
    deletions?: number;
}

interface GitHistorySource {
    loadCommits(query): Promise<GitHistoryPage>;
    loadDiff(commit: GitCommit, path?: string): Promise<string>;   // path: a file of Files tab
    loadCommitDetails?(commit: GitCommit): Promise<GitCommitDetails>;
    loadCommitFiles?(commit: GitCommit): Promise<GitChangedFile[]>;
    findCommit?(sha: string): Promise<GitCommit | null>;
}
```

New props: `layout`, `onLayoutChange`, `resolveAvatarUrl`, `linkify`, `onOpenLink`,
`commitActions`, `columns` (to hide a column), `labels` extended for every new string.

### Performance and accessibility

- The list renders only the visible rows (windowing) once it holds more than a few
  hundred commits; the graph is drawn per row so windowing keeps working.
- The list becomes a `grid` with column headers; the arrow keys keep moving the selection,
  Tab moves into the detail panel, and the tabs follow the WAI-ARIA tabs pattern.
- The graph and the status dots have text alternatives (row `aria-label`: subject,
  author, date, refs, *merge of N parents*).

### Phase 2 Acceptance Criteria

- [ ] Commit graph from `parents`, with `layoutCommitGraph` exported and unit-tested
      (linear history, branch and merge, octopus merge, a lane crossing a page boundary)
- [ ] Ref labels with the four kinds and `+N` overflow
- [ ] Author column with `Avatar`; no remote image unless `resolveAvatarUrl` is given;
      `Avatar` gains a non-interactive mode and overridable menu texts
- [ ] Author highlight of the selected commit's author
- [ ] Optional status dot that does not rely on colour alone
- [ ] Filter of the loaded commits; `findCommit` for an unloaded SHA
- [ ] Row actions from `commitActions`, by mouse and keyboard
- [ ] Resizable author, date and SHA columns (drag, arrow keys, double click resets),
      reported through `onColumnWidthsChange`
- [ ] Vertical (default) and horizontal layout with a draggable splitter
- [ ] Detail panel tabs Commit, Diff (unified + split) and Files, each shown only with its
      data
- [ ] `target="folder"`: no follow toggle, no Diff tab, Files tab scoped to the folder
- [ ] Related links, contained-in branches/tags and derives-from-tag, loaded lazily
- [ ] Windowed list for long histories; grid and tabs keyboard-accessible
- [ ] Hosts with only phase 1 data render as today; README and demo cover the rich view
- [ ] Version 0.5.0

## Out of Scope

- Split (side-by-side) diff view — in phase 1; phase 2 adds it
- The repository sidebar of the screenshot (branches, remotes, tags tree) and a branch
  filter: they belong to a repository-wide log, not to the history of one file; a separate
  component can reuse the list and the detail panel later
- The Console and Build Report tabs of the screenshot
- Syntax highlighting in the diff — it would need Monaco as a peer of this entry
- Blame, comparing two arbitrary revisions, a commit graph

## Phase 1 Acceptance Criteria

- [x] `GitHistory`, `parseUnifiedDiff` and the types exported from `/git-history` and the
      root entry; the entry loads no optional peer
- [x] Commit list with paging and keyboard navigation
- [x] The selected commit's diff with line numbers and colouring
- [x] Loading, empty and error states; late answers ignored
- [x] Unit tests for the parser and the component
- [x] README and demo page
