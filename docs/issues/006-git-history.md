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
- **Version**: 0.4.0
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

## Out of Scope

- Split (side-by-side) diff view
- Syntax highlighting in the diff — it would need Monaco as a peer of this entry
- Blame, comparing two arbitrary revisions, a commit graph

## Acceptance Criteria

- [x] `GitHistory`, `parseUnifiedDiff` and the types exported from `/git-history` and the
      root entry; the entry loads no optional peer
- [x] Commit list with paging and keyboard navigation
- [x] The selected commit's diff with line numbers and colouring
- [x] Loading, empty and error states; late answers ignored
- [x] Unit tests for the parser and the component
- [x] README and demo page
