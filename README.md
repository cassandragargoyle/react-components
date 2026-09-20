# React Components

A growing collection of reusable and extensible React components for modern web applications.

## Overview

**Repository**: `react-components`
**Language**: TypeScript (React 18+, Node 18+)
**Status**: Early — the library is being set up; no components have been published yet.

This repository is the shared component library of the CassandraGargoyle ecosystem.
It collects UI building blocks that are used across several projects, so that look,
behaviour, and accessibility stay consistent instead of being reimplemented per app.

Components are written in TypeScript, shipped as ES modules, and designed to be
extensible: styling is overridable, behaviour is driven by props, and nothing assumes a
particular application framework or router.

## Goals

- **Reusable** — every component is usable in more than one project, with no app-specific logic
- **Extensible** — sensible defaults, overridable styling, escape hatches via props and `ref`
- **Typed** — full TypeScript types for every public prop
- **Accessible** — keyboard navigation and ARIA semantics are part of the definition of done
- **Documented** — each component ships with usage examples

## Getting Started

The package is not published yet. Once the build is in place:

```bash
npm install @cassandragargoyle/react-components
```

```tsx
import { Button } from '@cassandragargoyle/react-components';

export function Example(): React.ReactElement {
  return <Button variant="primary">Save</Button>;
}
```

## Development

```bash
git clone https://github.com/cassandragargoyle/react-components.git
cd react-components

npm install
npm run build
npm test
```

## Project Structure

```text
react-components/
├── src/            # Component sources, one directory per component
├── docs/           # Contributing guides and component documentation
└── README.md
```

## Contributing

Contributions are welcome via pull requests. Please follow the CassandraGargoyle
contributing guides (code style, naming conventions, git workflow) used across the
ecosystem, and keep each pull request focused on a single component or change.

## License

MIT — see [LICENSE](LICENSE).
