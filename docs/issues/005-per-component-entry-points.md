---
title: INT-005 - Per-component entry points, so optional peers are truly optional
description: Apply when working on the package entry points, the exports map, the library build, or how a consumer loads the heavy optional peers.
category: specification
ai_load: on-demand
status: draft
created: 2026-10-17
related:
  - package.json
  - vite.config.ts
  - src/index.ts
---

# INT-005 - Per-component entry points, so optional peers are truly optional

## Metadata

- **Status**: 📋 Open
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-10-17
- **Author**: Zdenek
- **Target**: `package.json` `exports`, `vite.config.ts`, `src/index.ts`
- **GitHub**: [#5](https://github.com/cassandragargoyle/react-components/issues/5)
- **Related**:
  - `portunix-vscode` [issue 132](https://github.com/cassandragargoyle/portunix-vscode/blob/main/docs/issues/done/132-shared-modules-and-group-b-components.md)
    — moved the graph canvases and the code editor here, which made the problem visible

## Feature Description

The package declares its heavy libraries as **optional** peer dependencies, but it ships as
a single ES module, `dist/index.js`, that imports all of them at the top:

```text
3d-force-graph, ag-grid-community, ag-grid-react, cytoscape, cytoscape-dagre, @xyflow/react
```

Importing anything — even `Avatar` — therefore loads every one of them. A bundler with
tree-shaking drops the unused ones (the package is `"sideEffects": false`), but a consumer
that runs the package unbundled — Vitest, Node, server-side rendering — fails with
`Cannot find package 'cytoscape-dagre'` unless it installs every peer. "Optional" is true
only for bundled browser code.

Give each component, or each group of components with the same heavy peer, its own entry
point, so a consumer loads exactly the peers of what it imports.

## Use Case

- `portunix-vscode`'s `pilot-ui` tests, and every host that tests its own code with Vitest,
  must today install Cytoscape, 3d-force-graph, React Flow and AG Grid only to import
  `ProgressPanel`
- A host that only needs `BlockDocument` should not have to know the graph libraries exist

## Proposed Solution

### Entry points

- One subpath per component directory, e.g.
  `@cassandragargoyle/react-components/graph-canvas`, built from `src/<Component>/index.ts`
- The root entry `.` stays and keeps exporting everything, so existing imports keep working
- `exports` in `package.json` lists every subpath with its `types` and `import`

### Build

- Vite library mode with one `lib.entry` per component (or `preserveModules`), shared code
  in chunks, one `.d.ts` tree as today
- A test that imports each light entry point in plain Node with none of the heavy peers
  installed, so the regression cannot come back

### Hosts that embed the source

`portunix-vscode` resolves the package to `src/index.ts` through an esbuild alias. Its alias
must also map the subpaths (`@cassandragargoyle/react-components/<name>` →
`src/<Component>/index.ts`) before any host code imports a subpath.

### Open questions

- Subpath per component, or per peer group (`/graph`, `/workflow`, `/table`)?
- Do the subpath names follow the directory names (`/GraphCanvas`) or kebab case?
- Is this a minor version (additive) or does the root entry change as well?

## Acceptance Criteria

- [ ] Every component can be imported from its own subpath
- [ ] Importing a component whose peers are not installed does not load those peers, in
      plain Node as well as in a bundler
- [ ] The root entry keeps exporting the whole public API
- [ ] `exports` and the `.d.ts` tree cover every subpath
- [ ] A test proves that light entry points load without the heavy peers
- [ ] The README documents the subpaths and which peers each needs
