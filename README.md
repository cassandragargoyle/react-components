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
dependency; `NodeTablePanel` also needs `ag-grid-community` and `ag-grid-react`, which are
optional for everything else.

```tsx
import { BlockDocument, type BlockDocumentData } from '@cassandragargoyle/react-components';

export function Manual({ doc }: { doc: BlockDocumentData }): React.ReactElement {
    return <BlockDocument document={doc} />;
}
```

Stylesheets are bundled into the JavaScript and injected on first use; there is no CSS file
to import.

## Components

| Component | What it is |
| --------- | ---------- |
| [`Avatar`](https://github.com/cassandragargoyle/react-components/tree/main/src/Avatar) | A participant avatar: photo or initials, a ring cue for the actor kind, a click-to-open menu |
| [`BlockDocument`](https://github.com/cassandragargoyle/react-components/tree/main/src/BlockDocument) | A document of blocks — chapters, paragraphs, images, videos — shown as one page and edited in place |
| [`Carousel`](https://github.com/cassandragargoyle/react-components/tree/main/src/Carousel) | A three-card fan carousel around a centred hero card |
| [`NodeTablePanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/NodeTablePanel) | A bottom table panel over AG Grid with an All/Selected filter and selection sync |
| [`OpenPanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/OpenPanel) | A launcher card: Open File / Open Folder and a filterable list of recent items |
| [`ProgressPanel`](https://github.com/cassandragargoyle/react-components/tree/main/src/Progress) | An async-progress panel: spinner, message, fields, a step checklist and errors |
| [`RadialMenu`](https://github.com/cassandragargoyle/react-components/tree/main/src/RadialMenu) | A radial (pie) action menu with nested rings and keyboard navigation |

## Development

```bash
git clone https://github.com/cassandragargoyle/react-components.git
cd react-components

npm install
npm run build
npm test
npm run dev        # the demo at http://127.0.0.1:5173/demo/
```

## Project Structure

```text
react-components/
├── src/                # Component sources, one directory per component
│   └── index.ts        # Public entry point — every exported component
├── demo/               # The demo page served by npm run dev
├── vite.config.ts      # Library build (ESM + .d.ts tree)
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
