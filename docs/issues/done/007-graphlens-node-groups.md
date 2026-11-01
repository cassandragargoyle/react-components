---
title: INT-007 - GraphLens3D, node groups and colors defined by the document
description: Apply when working on GraphLens3D node groups — the group and color order, the meta.groups definitions, and the handling of invalid documents.
category: specification
ai_load: on-demand
status: active
created: 2026-10-31
related:
  - src/GraphLens3D/
---

# INT-007 - GraphLens3D, node groups and colors defined by the document

## Metadata

- **Status**: ✅ Implemented
- **Type**: enhancement
- **Created**: 2026-10-31
- **Closed**: 2026-11-01
- **Version**: 0.5.1
- **Author**: Zdenek
- **Target**: `src/GraphLens3D/`
- **GitHub**: [#7](https://github.com/cassandragargoyle/react-components/issues/7)
- **Related**:
  - `cassandragargoyle/api` #78 — the GraphView contract with `node.group` and `meta.groups`
  - `portunix-vscode` issue 140 — takes this change over; its acceptance protocol
    `docs/testing/acceptance-140.md` records the tests of this issue
  - `portunix-plugins` #210 — needs the standalone bundle with this change

## Summary

GraphLens3D had hard-coded colors for `tag` and `voice` nodes only, so every other node type
was grey, and all of them fell into one filter called `voice`. The component now reads
`node.group` and `meta.groups` from the GraphView contract, so that a document defines its
own groups and colors.

## Requirements

- `GraphLensNode` has an optional `group`, and `GraphLensMeta` has an optional `groups`.
- The group key resolves in the order `node.group`, `tag` for tag nodes, `node.voice`,
  `node.type`, and `voice` as the fallback.
- The color resolves in the order `meta.groups[key].color` (`#RRGGBB`), the existing palette,
  `DEFAULT_NODE_COLOR`.
- `meta.groups[key].label` is shown in the toolbar filter, the node table and the detail
  panel when it is set.
- A value that is not text in a text field is ignored, a link to a missing node is left out,
  and a document that is not a graph gives an error status, not a blank page.

## Acceptance Criteria

- [x] Nodes use the colors from `meta.groups`, in the viewport, toolbar, node table and detail
      panel
- [x] A document without groups looks the same as before, including tag and voice colors
- [x] The filter shows one row per group and hides and shows each group on its own
- [x] An invalid or missing group definition falls back to default styling without an error
- [x] Unit tests cover the group and color order, and the demo has a graph with groups
- [x] A new package version is published — 0.5.1, published by hand, because the publish
      workflow fails with `E404`
