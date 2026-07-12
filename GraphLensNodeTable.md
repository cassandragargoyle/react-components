# GraphLensNodeTable

## Overview

**File**: `GraphLensNodeTable.tsx`
**Status**: Stable

Bottom panel of the `GraphLens3D` viewer. Renders the nodes of the currently
loaded graphlens document as a sortable [AG Grid](https://www.ag-grid.com/)
table (`ag-grid-react` / `ag-grid-community`, dark `themeQuartz` styling
matching the rest of the Pilot UI). It mirrors `WorkflowNodeTable` from the
`WorkflowCanvas` component, adapted to the graphlens node shape and its
single-selection model.

## Props

| Prop | Type | Description |
| ----------------- | -------------------------------- | ----------- |
| `nodes` | `GraphLensNode[]` | Nodes to display — the caller passes only nodes that pass the toolbar search/kind filters (`isVisible`), so the table always matches the 3D view |
| `selectedId` | `string \| null` | Currently selected node id, used to highlight the matching row and to drive the "Selected" filter |
| `filter` | `TableFilter` (`'all' \| 'selected'`) | Current table filter mode |
| `onFilterChange` | `(filter: TableFilter) => void` | Called when the user clicks the All/Selected toggle |
| `onNodeClick` | `(id: string) => void` | Called when a row is clicked; the parent reuses `handleNodeClick` to select the node in the 3D viewport |
| `degreeOf` | `(id: string) => number` | Adjacency helper from `GraphLens3D`, used to compute the Degree column |
| `height` | `number` | Panel height in pixels, controlled by the resize handle in `GraphLens3D` |

## Columns

- **ID** — `node.id`
- **Label** — `node.label`, falling back to `node.title`, then `node.id`
- **Kind** — `kindOf(node)` (`tag` or the voice type, e.g. `VoC`), rendered with a
  color swatch via `kindColor()` (`KindCellRenderer`)
- **Degree** — number of connecting links, via `degreeOf(node.id)`
- **Meta columns** — one column per unique key found across `node.meta` objects
  (`collectMetaColumns`), flattened the same way `WorkflowNodeTable` flattens
  `WorkflowNode.properties`; object/array values are JSON-stringified

## Behavior

- **All / Selected filter**: "All" shows every passed-in node; "Selected" shows
  only the node matching `selectedId` (0 or 1 rows), since `GraphLens3D`
  selection is single-select (`GraphLensSelection`), unlike `WorkflowCanvas`'s
  multi-select `Set<string>`. The header also shows a "Showing: X of Y nodes"
  count.
- **Row click → viewport selection**: clicking a row calls `onNodeClick(id)`,
  which the parent wires to `handleNodeClick` (pans/highlights the node in the
  3D viewport and records it in the navigation history).
- **Viewport selection → row highlight**: an effect watches `selectedId` and
  calls `node.setSelected(...)` on the matching AG Grid row, keeping the table
  in sync when the selection changes from the viewport, the detail panel, or
  back/forward navigation.
- **No multi-select**: unlike `WorkflowNodeTable`, Ctrl/Cmd-click multi-select
  is intentionally not implemented — `GraphLens3D` has no concept of multiple
  selected nodes, so `rowSelection` is `'single'`.
- **Read-only**: no editing of node data from the table, consistent with
  `GraphLens3D` being a read-only viewer.

## Styling

Styles live in `GraphLens3D.css` under the `.graphlens-node-table*` and
`.graphlens-resize-handle` selectors — a `graphlens-` prefixed port of the
`.workflow-node-table*` rules in `WorkflowCanvas.css` (same dark `themeQuartz`
params, compact 28px header / 26px row height, VS Code theme variables).

## Integration

Composed by `GraphLens3D.tsx` inside `.graphlens-center`, stacked below the
3D viewport and above a `.graphlens-resize-handle` drag bar (min 80px, max
500px, matching `WorkflowCanvas`'s `handleResizeStart` clamping). The parent
owns `tableFilter` and `tableHeight` state and passes visible nodes computed
from the toolbar's `isVisible` predicate.

---

**Created**: 2026-07-02
**Last Updated**: 2026-07-02
