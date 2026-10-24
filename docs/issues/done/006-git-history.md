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

- **Status**: ✅ Implemented
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-10-23
- **Closed**: 2026-10-24
- **Version**: 0.4.0 (phase 1, the simple view), 0.5.0 (phase 2, the rich view)
- **Author**: Zdenek
- **Target**: `src/GitHistory/` (new component), entry point `/git-history`
- **GitHub**: [#6](https://github.com/cassandragargoyle/react-components/issues/6)
- **Related**:
  - `portunix-vscode` issue 053 — the Explorer **Git → History** menu that opens this view
  - [GUI Design Guidelines](../../architecture/GUI-DESIGN-PRINCIPLES.md) — theme, icons,
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
| Date | Exact author date, `YYYY-MM-DD HH:mm` in local time | `date` |
| Age | Relative date (*3 days ago*), the exact date in the tooltip | `date` |
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
- **Author avatars**: the library's own [`Avatar`](../../../src/Avatar/) component is used —
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
- **Date and Age**: two columns from the same author date. **Date** shows it exactly, as
  `YYYY-MM-DD HH:mm` in the viewer's local time, with tabular digits so the column lines
  up; its tooltip adds the seconds, the time zone offset and the commit date when it
  differs. **Age** is the relative form that the single date column showed so far, renamed
  so the two headers do not clash; its tooltip shows the exact date. Both are hidden or
  shown through `columns` (`date`, `age`); default widths 128 px and 104 px.
- **Column widths**: every column — the graph and the message included — has a border on
  its right in the header. Dragging it changes that column alone, to any width from 16 px
  up; the columns after it move along. The message column takes the free width until the
  user resizes it; then it keeps its width, and free space stays after the last column. A
  grid wider than the pane scrolls sideways. The host may replace the exact form with `formatColumnDate(iso)` — the column
  keeps its fixed-width layout — and the relative one with `formatDate` as today.
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

#### Change weight in the Files tab

Each row of the Files tab ends, right-aligned, with the line counts and a **change weight
mark** — how big the change is *for that file*:

```text
 M  src/core/chatSession.ts           +9   −0   ◉     ← 9 of 10 lines: the file was rewritten
 M  src/core/messageRouter.ts        +40  −12   ○     ← 52 of 900 lines
 M  src/legacy/bigTable.ts           +10   −0   ·     ← 10 of 10 000 lines: a touch
 A  src/core/newModule.ts            +120  −0   ◉     ← a new file is changed through and through
 R  docs/old.md → docs/new.md          +0   −0         ← pure rename: nothing to weigh
 M  assets/logo.png                                   ← binary: no counts, no mark
```

- **Counts**: `+additions` in the added colour and `−deletions` in the removed colour, in
  tabular digits so the columns of numbers line up.
- **The mark** uses the same four glyphs as the Explorer's commit heat marks
  (`·` `○` `●` `◉`, see `portunix-vscode` `src/electron/git/commitHeat.svg`), so the two
  read as one visual language: *the bigger the dot, the more it matters*. It has no
  fading here — the commit has one date.
- **Relative, not absolute**: the weight is the share of the file the commit touched,
  `ratio = (additions + deletions) / size`, where `size` is the larger of the file's line
  count before and after the commit (`before = after − additions + deletions`). Ten changed
  lines are a rewrite of a ten-line file and a touch of a ten-thousand-line one.

  | Level | Ratio | Glyph | Reads as |
  | ----- | ----- | ----- | -------- |
  | 0 | no changed lines (rename, mode change) or binary | — | nothing to weigh |
  | 1 | up to 5 % | `·` | a touch |
  | 2 | up to 20 % | `○` | a noticeable change |
  | 3 | up to 50 % | `●` | a large change |
  | 4 | above 50 %, every added or deleted file | `◉` | rewritten |

- **Tooltip** on the mark: *+9 −0 of 10 lines · 90 % of the file · rewritten*; the row's
  accessible label carries the same words.
- **Without a line count** (the host does not send `lines`, or the file was too big for it
  to count) the counts are still shown and the mark is left out; nothing is guessed from
  the byte size.
- The levels are computed by an exported pure function `changeWeight(file)` →
  `{ ratio, level }`, unit-tested with the cases above. The glyph is a small library
  component shared with the history's other marks; Pilot's Explorer switches its heat
  marks to the same component, so the glyphs cannot drift apart.

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
    /** Line count of the file after the commit (0 when deleted); turns on the change
     *  weight mark */
    lines?: number;
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

- [x] Commit graph from `parents`, with `layoutCommitGraph` exported and unit-tested
      (linear history, branch and merge, octopus merge, a lane crossing a page boundary)
- [x] Ref labels with the four kinds and `+N` overflow
- [x] Author column with `Avatar`; no remote image unless `resolveAvatarUrl` is given;
      `Avatar` gains a non-interactive mode and overridable menu texts
- [x] Author highlight of the selected commit's author
- [x] Optional status dot that does not rely on colour alone
- [x] Filter of the loaded commits; `findCommit` for an unloaded SHA
- [x] Row actions from `commitActions`, by mouse and keyboard
- [x] Two date columns: **Date** as `YYYY-MM-DD HH:mm` (local time, `formatColumnDate`
      to override) and **Age** with the relative date; both hideable and resizable
- [x] Every column resizable on its own by the border on its right (drag, arrow keys,
      double click resets), down to 16 px; the message column flexible until resized; the
      grid scrolls sideways when wider than the pane; reported through
      `onColumnWidthsChange`
- [x] Vertical (default) and horizontal layout with a draggable splitter
- [x] Files tab rows end with `+additions −deletions` and a change weight mark relative to
      the file's size (`changeWeight`, levels 0–4, the Explorer heat glyphs); tooltip and
      accessible label in words; no mark without `lines`
- [x] Detail panel tabs Commit, Diff (unified + split) and Files, each shown only with its
      data
- [x] `target="folder"`: no follow toggle, no Diff tab, Files tab scoped to the folder
- [x] Related links, contained-in branches/tags and derives-from-tag, loaded lazily
- [x] Windowed list for long histories; grid and tabs keyboard-accessible
- [x] Hosts with only phase 1 data render as today; README and demo cover the rich view
- [x] Version 0.5.0

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
