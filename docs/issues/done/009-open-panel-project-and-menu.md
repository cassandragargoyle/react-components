---
title: INT-009 - OpenPanel, an optional project button, description, action order, menu and project items
description: Apply when working on the optional parts of OpenPanel — the project button, the description under the title, the order of the buttons, the "…" menu and the recent items of type project.
category: specification
ai_load: on-demand
status: draft
created: 2026-11-17
related:
  - src/OpenPanel/
  - docs/issues/done/002-open-panel.md
---

# INT-009 - OpenPanel, an optional project button, description, action order, menu and project items

## Metadata

- **Status**: 📋 Open
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-11-17
- **Author**: Zdenek
- **Target**: `src/OpenPanel/`
- **GitHub**: [#9](https://github.com/cassandragargoyle/react-components/issues/9)
- **Related**:
  - [INT-002 — OpenPanel, a host-neutral launcher with a recent list](done/002-open-panel.md) — the component
    this issue extends
  - `portunix-reco-studio` issue 99 — the customer recognition project (`*.cgproject.jsonc`) whose start screen
    needs these parts

## Feature Description

OpenPanel opens a file or a folder. An application that works with **projects** — a project manifest such as
`<name>.cgproject.jsonc` of the CassandraGargoyle api, which different applications use for different purposes —
needs more on its start screen:

- A button that opens a project, and the order of the buttons, so the project can come first
- A short text under the title that says what a project is **in this application**
- A **"…" menu** at the top right of the card, for actions that do not deserve a button (for example "New
  Project…" or "Create Project from Template…")
- Recent items that are projects, with their own icon, told apart from files and folders

Every part is **optional and off by default**. A host that passes none of the new props renders exactly the
OpenPanel of today, so Pilot and the other hosts do not change. The component stays host-neutral: it knows
nothing about project files, it renders what the host configures.

## Use Case

- Reco Studio (a desktop app for form recognition) shows "Start with a customer project", a description of its
  recognition project, the buttons Open Project · Open Folder · Open File, the menu item New Project… and its
  recent projects
- Another application that uses a project manifest for another purpose writes its own title and description, or
  none
- Pilot keeps Open File · Open Folder and no menu

## Proposed Solution

| Part | Prop | Default |
| ---- | ---- | ------- |
| Project button | `onOpenProject?: () => void`, text `labels.openProject` | not rendered; text `Open Project` |
| Order of the buttons | `actions?: readonly OpenPanelAction[]` (`'file' \| 'folder' \| 'project'`) | `['file', 'folder', 'project']`: the order of today |
| Description | `labels.description` | `''`: not rendered |
| Menu | `menuItems?: readonly OpenPanelMenuItem[]`, button text `labels.more` | not rendered without items; `More actions` |
| Project items | `OpenPanelItemType` gains `'project'` | only a host that sends such items gets them |

- A button is rendered only when its callback is given and its action is in `actions`; an action listed twice is
  rendered once
- The button text has no ellipsis, as Open File and Open Folder; menu items may have one, following the menu
  convention that `…` opens a dialog
- A menu item is `{ id, label, onSelect, disabled? }` or `{ separator: true }`. The menu opens on a click,
  Enter, Space or ArrowDown on the "…" button; ArrowUp / ArrowDown / Home / End move between the enabled items,
  Enter or Space selects, Escape and a click outside close it and return the focus to the button. ARIA:
  `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` and `role="menuitem"`
- A project item has its own icon (a folder with a diamond). Its name is the project name the host gives; the
  path is the manifest
- `OpenPanelItemType` gaining a member is an addition to an exported type, so the version is **0.7.0**

## Acceptance Criteria

- [ ] Without the new props the rendered DOM is the same as in 0.6.0 (tested)
- [ ] `onOpenProject` renders an Open Project button; `labels.openProject` changes its text
- [ ] `actions` sets the order of the buttons; an action without its callback is not rendered
- [ ] `labels.description` renders a paragraph under the title; an empty description renders nothing
- [ ] `menuItems` renders the "…" button; the menu works with the mouse and with the keyboard as described,
      skips disabled items and separators, and returns the focus to the button when it closes
- [ ] A recent item of type `project` shows the project icon; folders and files are unchanged
- [ ] `OpenPanelAction` and `OpenPanelMenuItem` are exported from `src/index.ts` and from the `./open-panel`
      entry point
- [ ] README of the component and `OpenPanel.svg` show the new parts; the version is 0.7.0
- [ ] `npm run typecheck`, `npm run build` and `npm test` pass
