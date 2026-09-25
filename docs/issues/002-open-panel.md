---
title: INT-002 - OpenPanel, a host-neutral launcher with a recent list
description: Apply when working on OpenPanel — its props, the recent list, filtering, missing items and the loading state.
category: specification
ai_load: on-demand
status: active
created: 2026-09-26
related:
  - src/OpenPanel/
  - docs/architecture/GUI-DESIGN-PRINCIPLES.md
---

# INT-002 - OpenPanel, a host-neutral launcher with a recent list

## Metadata

- **Status**: 🔄 In Progress
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-09-26
- **Version**: 0.2.0
- **Author**: Zdenek
- **Target**: `src/OpenPanel/` (new component)
- **GitHub**: [#2](https://github.com/cassandragargoyle/react-components/issues/2)
- **Related**:
  - `portunix-vscode` issue 125 — the migration of components into this library
  - [GUI Design Guidelines](../architecture/GUI-DESIGN-PRINCIPLES.md) — theme, icons,
    interaction states

## Feature Description

A launcher screen: a centred card with **Open File** / **Open Folder** buttons and a
filterable list of **recently opened** items. It is the "nothing is open yet" screen of a
desktop app or a webview.

The component comes from Pilot, the `portunix-vscode` desktop app (its issues #014 and
#102), carried here with its history by `git subtree`. There it took no props and called
the Electron preload global `window.fileApi` directly, which is why issue 125 first kept it
out of the library. This issue makes it host-neutral.

## Use Case

- A desktop app built on Electron shows it when no project is open
- A VS Code webview or a browser app shows the same card over its own file access
- A host that opens only folders shows only the Open Folder button

## Proposed Solution

- **Data in, actions out.** The recent list arrives as `recentItems`; Open File, Open
  Folder, open a recent item and Clear Recent leave through callbacks. A button whose
  callback is omitted is not rendered. The component calls no host API
- **A loading state.** `loading` replaces the empty state until the host has delivered the
  list, so an empty store and a list on its way no longer look the same
- **Overridable text and display.** `labels` overrides any string, `formatPath` the shown
  path, `icon` the icon above the title, `filterThreshold` when the filter appears
- **Scoped styling.** The stylesheet holds only `.open-panel-*` rules and reads the VS Code
  theme variables with dark fallbacks; the page layout, `body` and the host's status bar
  stay with the host
- **Small fixes on the way.** The `/` shortcut focuses the filter through a ref instead of a
  document query; `shortenHomePath` also shortens macOS `/Users/<user>`; buttons carry
  `type="button"` and the icons `aria-hidden`

## Acceptance Criteria

- [x] `OpenPanel`, `OpenPanelProps`, `OpenPanelRecentItem`, `OpenPanelItemType`,
      `OpenPanelLabels`, `DEFAULT_OPEN_PANEL_LABELS` and `shortenHomePath` are exported from
      `src/index.ts`
- [x] The component imports no host API and no global beyond `document` for style injection
- [x] Missing items (`exists === false`) are disabled, badged *Not found*, and do not call
      `onOpenRecent`
- [x] Filtering matches name and path case-insensitively and keeps the list height stable
- [x] Unit tests cover the actions, the empty and loading states, filtering, the `/`
      shortcut, missing items, label overrides and path shortening
- [x] The component ships a `README.md` with usage, props and styling
- [x] `npm run typecheck`, `npm run build` and `npm test` pass
- [ ] Version 0.2.0 is published to npmjs.com — waits for the `v0.2.0` tag
- [ ] `portunix-vscode` Pilot renders its start screen from this component — wired, not
      yet checked in the running app
