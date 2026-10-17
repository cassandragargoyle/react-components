# React Components

Reusable, extensible React components shared across the CassandraGargoyle ecosystem.

[![npm](https://img.shields.io/npm/v/@cassandragargoyle/react-components)](https://www.npmjs.com/package/@cassandragargoyle/react-components)
[![license](https://img.shields.io/npm/l/@cassandragargoyle/react-components)](LICENSE)

## Overview

**Repository**: `react-components`
**Language**: TypeScript (React 19, Node 24+)
**Package**: [`@cassandragargoyle/react-components`](https://www.npmjs.com/package/@cassandragargoyle/react-components) on npmjs.com

This repository is the shared component library of the CassandraGargoyle ecosystem.
It collects UI building blocks that are used across several projects, so that look,
behaviour, and accessibility stay consistent instead of being reimplemented per app.

Components are written in TypeScript, shipped as ES modules, and designed to be
extensible: styling is overridable, behaviour is driven by props, and nothing assumes a
particular application framework or router. Colours follow the Visual Studio Code theme
variables when they are present, so the components look at home in a webview.

## Goals

- **Reusable** — every component is usable in more than one project, with no app-specific logic
- **Extensible** — sensible defaults, overridable styling, escape hatches via props and `ref`
- **Typed** — full TypeScript types for every public prop
- **Accessible** — keyboard navigation and ARIA semantics are part of the definition of done
- **Documented** — each component ships with usage examples

## Getting Started

```bash
npm install @cassandragargoyle/react-components
```

No registry setup and no token: the package is public on npmjs.com. React 19 is a peer
dependency. The heavy libraries are **optional** peers, needed only by the components that
use them.

### Entry Points

Each component has its own entry point, and importing it loads only the peers that
component needs. Under Vitest, in Node and in server-side rendering, where no bundler drops
the unused peers, this is what makes them truly optional:

| Subpath | Exports | Optional peers it loads |
| ------- | ------- | ----------------------- |
| `/avatar` | `Avatar` | — |
| `/block-document` | `BlockDocument` and its functions | — |
| `/carousel` | `Carousel` | — |
| `/code-editor` | `CodeEditor` and its functions | — (the host builds `monaco-editor` as a separate, lazy-loaded chunk) |
| `/graph-canvas` | `GraphCanvas` | `cytoscape`, `cytoscape-dagre`, `ag-grid-community`, `ag-grid-react` |
| `/graph-lens-3d` | `GraphLens3D` | `3d-force-graph`, `ag-grid-community`, `ag-grid-react` |
| `/node-table-panel` | `NodeTablePanel` | `ag-grid-community`, `ag-grid-react` |
| `/open-panel` | `OpenPanel` and its helpers | — |
| `/progress` | `ProgressPanel` | — |
| `/radial-menu` | `RadialMenu`, `useRadialMenu` | — |
| `/workflow-canvas` | `WorkflowCanvas` | `@xyflow/react`, `ag-grid-community`, `ag-grid-react` |

The three graph components embed `NodeTablePanel`, hence AG Grid.

```tsx
import { BlockDocument, type BlockDocumentData } from '@cassandragargoyle/react-components/block-document';

export function Manual({ doc }: { doc: BlockDocumentData }): React.ReactElement {
    return <BlockDocument document={doc} />;
}
```

The root entry `@cassandragargoyle/react-components` still exports everything, and so loads
every optional peer above. It suits a bundled browser build, where the package is
`"sideEffects": false` and the bundler drops what is not used.

A host that embeds the sources instead of the published package, through a bundler alias to
`src/index.ts`, maps the subpaths too: `@cassandragargoyle/react-components/<subpath>` to
`src/<Component>/index.ts`.

Stylesheets are bundled into the JavaScript and injected on first use; there is no CSS file
to import.

## Components

| Component | What it is |
| --------- | ---------- |
| [`Avatar`](https://github.com/cassandragargoyle/react-components/tree/main/src/Avatar) | A participant avatar: photo or initials, a ring cue for the actor kind, a click-to-open menu |
| [`BlockDocument`](https://github.com/cassandragargoyle/react-components/tree/main/src/BlockDocument) | A document of blocks — chapters, paragraphs, images, videos — shown as one page and edited in place |
| [`Carousel`](https://github.com/cassandragargoyle/react-components/tree/main/src/Carousel) | A three-card fan carousel around a centred hero card |
| [`CodeEditor`](https://github.com/cassandragargoyle/react-components/tree/main/src/CodeEditor) | A Monaco code editor, lazy-loaded on first use, with a plain-text fallback |
| [`GraphCanvas`](https://github.com/cassandragargoyle/react-components/tree/main/src/GraphCanvas) | A 2D node-edge graph viewer and editor over Cytoscape, with a node table and property panel |
| [`GraphLens3D`](https://github.com/cassandragargoyle/react-components/tree/main/src/GraphLens3D) | A 3D force-directed graph explorer with search, filters and a detail panel |
| [`NodeTablePanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/NodeTablePanel) | A bottom table panel over AG Grid with an All/Selected filter and selection sync |
| [`OpenPanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/OpenPanel) | A launcher card: Open File / Open Folder and a filterable list of recent items |
| [`ProgressPanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/Progress) | An async-progress panel: spinner, message, fields, a step checklist and errors |
| [`RadialMenu`](https://github.com/cassandragargoyle/react-components/tree/main/src/RadialMenu) | A radial (pie) action menu with nested rings and keyboard navigation |
| [`WorkflowCanvas`](https://github.com/cassandragargoyle/react-components/tree/main/src/WorkflowCanvas) | A workflow editor over React Flow with undo/redo, a node table and property panel |

## Development

```bash
git clone https://github.com/cassandragargoyle/react-components.git
cd react-components

npm install
npm run build
npm test
npm run test:entries   # after a build: each entry point loads only its own peers
npm run dev            # the demo at http://127.0.0.1:5173/demo/
```

## Project Structure

```text
react-components/
├── src/                # Component sources, one directory per component
│   └── index.ts        # Root entry point — every exported component
├── demo/               # The demo page served by npm run dev
├── scripts/            # check-entry-points.mjs, run by npm run test:entries
├── vite.config.ts      # Library build: an entry per package.json export, plus the .d.ts tree
├── vitest.config.ts    # jsdom test environment
└── .github/workflows/  # Publish to npmjs.com on a v* tag
```

Components arrive here from `portunix-vscode`; the migration and the admission bar are
recorded in that repository's **ADR-012** and issue **125**.

## Releasing

Bump `version` in `package.json`, commit, and push a matching `vX.Y.Z` tag. The publish
workflow checks, tests and publishes to npmjs.com through npm Trusted Publishing, with
provenance; no npm token is stored anywhere.

## Contributing

Contributions are welcome via pull requests. Please follow the CassandraGargoyle
contributing guides (code style, naming conventions, git workflow) used across the
ecosystem, and keep each pull request focused on a single component or change.

## License

MIT — see [LICENSE](LICENSE).
