# GraphLens 3D Viewer

Reusable React/TypeScript component that renders the **graphlens** contract
(`meta` + `nodes` + `links`) as an interactive 3D force-directed graph using
[`3d-force-graph`](https://github.com/vasturiano/3d-force-graph) (Three.js +
d3-force-3d). It is the 3D counterpart to the 2D Cytoscape `GraphCanvas`.

![GraphLens3D visual reference](./GraphLens3D.svg)

Below the 3D viewport, a resizable `GraphLensNodeTable` (AG Grid) lists the
nodes of the currently loaded document — sortable, filterable by All/Selected,
and bidirectionally synced with the viewport selection.

## Usage

```tsx
import { GraphLens3D } from '@cassandragargoyle/react-components/graph-lens-3d';

// Pure and prop-driven: the host loads the document and passes it in
<GraphLens3D data={doc} status={loadStatus} />
```

`data` is `null` while loading; `status` (optional) drives the detailed loading
screen. Optional peers: `3d-force-graph`, `ag-grid-community`, `ag-grid-react`.

## Source of truth

This component is the **single source of truth** for the GUI of the `graphlens`
Portunix plugin (portunix-plugins #086). The plugin must **not** maintain a
hand-written `static/app.js`; it vendors the bundle `portunix-vscode` builds
from this component instead.

## Data contract

The component renders a `GraphLensDocument` declared in [`types.ts`](./types.ts)
— note `links` (not `edges`) and `meta` (not `metadata`). This is intentionally
a separate type from `GraphCanvas`'s `GraphDocument`; do not overload that one.

The TS type mirrors the **canonical, language-independent GraphView schema**
(`Api #011`, `contract/schemas/graph-view.schema.json`): `id`, `type` and
`label` are required on every node; `meta` and `version` are optional at the
document level. Documents at rest use the `.glens.json` filename suffix. Align
the TS type to that schema rather than inventing a parallel shape.

The component does not validate against the schema, but it stays usable with a
wrong document. An object in a field that is shown as text is ignored. A link to
a node that does not exist is left out, and the statistics show how many were. A
document without the graph shape (a `nodes` array of objects with an `id`, and a
`links` array) shows an error instead of the graph.

## Node groups and colors

A document can define its own groups and colors, with no change to the code:

```json
{
  "meta": {
    "groups": {
      "language": { "label": "Programming language", "color": "#d29922" },
      "manifest": { "label": "Manifest", "color": "#58a6ff" }
    }
  },
  "nodes": [
    { "id": "language:c", "type": "language", "label": "C", "group": "language" }
  ],
  "links": []
}
```

The group of a node is the first value that is set: `node.group`, `tag` for tag
nodes, `node.voice`, `node.type`. A value that is not non-empty text counts as
not set. The filter, the statistics and the node table have one entry per group.
A document that defines `meta.groups` shows each filter on its own line.

The color of a group is `meta.groups[key].color`, then the built-in `tag` and
voice palette, then the neutral default. A color that is not `#RRGGBB` is
ignored, and a missing definition uses the default styling, so a document
without groups looks as it did before. `meta.groups[key].label` replaces the key
wherever the group is shown; a long label is cut with an ellipsis, and the full
text is in its tooltip.

## Consumption modes in portunix-vscode

| Mode | Entry | Data source |
| ---- | ----- | ----------- |
| Standalone offline bundle | `index.graphlens.tsx` | `fetch('/data.json')` |
| VS Code webview | `index.graphlens.tsx` | `postMessage` (`setGraphData`) |
| Electron app | `index.graphlens.electron.tsx` | preload IPC bridge (`window.graphLensApi`) |

The `index.graphlens.tsx` entry gates its data source on whether
`acquireVsCodeApi()` is available (webview vs standalone). The Electron app uses
a dedicated entry that reads `*.glens.json` via the main process and delivers it
over IPC, mirroring the existing Canvas viewer.

## Building the standalone bundle

In `portunix-vscode`:

```bash
make graphlens-bundle
```

This runs `esbuild.graphlens.mjs`, producing a single self-contained IIFE bundle
(`3d-force-graph`/Three.js inlined, CSS injected at runtime) plus `index.html` at
`src/vscode-extension/dist/graphlens/`. No CDN or third-party network calls are
made — only `GET /data.json` from the same origin. The graphlens plugin vendors
this output into `plugins/graphlens/src/graphlens/static/`.
