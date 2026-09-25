# Development Instructions

## Project Information

- **Repository**: `https://github.com/cassandragargoyle/react-components`
- **Project Name**: react-components
- **Package**: `@cassandragargoyle/react-components`, published to GitHub Packages
- **Primary Purpose**: The shared component library of the CassandraGargoyle ecosystem —
  reusable, extensible React components used across several applications, so that look,
  behaviour and accessibility stay consistent instead of being reimplemented per app
- **Primary Language**: TypeScript, React 19, Node.js 24+
- **Platforms**: Windows, Linux

Components migrate here from `portunix-vscode`; the migration and the admission bar are
recorded in that repository's **ADR-012** and issue **125**. Issue numbers in the source
comments (`#100`, `#105`) are `portunix-vscode` issues.

## Security Guidelines

- Never run destructive commands without confirmation
- Always warn about potential data loss before executing risky operations
- Require explicit confirmation for operations that could lose implemented code
- Never commit a token; `.npmrc` reads `NODE_AUTH_TOKEN` from the environment

## Project Structure

- `/src/<Component>/` - One directory per component: the component, its stylesheet, its
  types and hooks, its tests and its `README.md`. `index.ts` is its barrel
- `/src/index.ts` - The public entry point; only what it exports is public API
- `/demo/` - The demo page served by `npm run dev`; it imports the public entry point
- `/types/` - Ambient declarations (CSS and SVG modules, JSX, testing matchers)
- `/vite.config.ts` - The library build: ES modules plus the `.d.ts` tree in `dist/`
- `/vite.css-as-string.ts` - The plugin that imports a stylesheet as text, for the build
  and the demo alike
- `/vitest.config.ts` - The jsdom test environment; `*.css` imports resolve to `''`
- `/.github/workflows/` - Publish to GitHub Packages on a `v*` tag
- `/.vscode/` - Debugging: the demo in Chrome or Edge, and Vitest under the debugger
- `/docs/issues/` - The specification, one issue per file
- `/docs/contributing/` - Methodology and conventions
- `/docs/architecture/` - GUI design guidelines
- `/.claude/` - AI assistant configuration: roles and the issue workflow skills

Tests live beside the source as `src/<Component>/<Component>.test.tsx`.

## Coding Guidelines & Development Instructions

### Strict Rules

- Code, code comments, and user messages must be in English
- Communication with team members can be in their preferred language, but documentation
  remains in English; Czech translations sit beside the original as `*.cs.md`
- When implementing new features, always check existing project structure first
- Prefer editing existing files over creating new ones
- Do not add "Generated with [Claude Code]" signatures to code or files
- **NEVER add "Co-Authored-By: Claude <noreply@anthropic.com>" to code files or git commits** - attribution not required
- All Markdown files must follow [Markdown Style Guide](docs/contributing/MARKDOWN-STYLE.md)
  and [Markdown Frontmatter](docs/contributing/MARKDOWN-FRONTMATTER.md)

See `docs/contributing/CODE-STYLE-TYPESCRIPT.md` for the language guidelines.

### General Principles

- Follow existing conventions and styles in the project
- Always explore existing code before creating new implementations
- All program text (messages, labels, constants) in English
- Comments in English, written as phrases (no ending periods)
- A new source file starts with the MIT license block and a two-line header comment saying
  what it is for

### Design Principles

Key priorities (in order):

1. **Automatic over manual** - prefer solutions that work without user intervention
2. **Zero configuration** - prefer solutions that work out of the box
3. **Convention over configuration** - follow established patterns
4. **Fail gracefully** - help users understand and recover from errors

### TODO Management

- Format: `TODO:NNN [INITIALS]: description`, numbered per file (001, 002, ...)
- Use `TODO:XXX` as a temporary placeholder, then request proper numbering

### Issue Tracking & Documentation

- An issue lives in two places at once: the file `docs/issues/NNN-slug.md` is the content,
  the GitHub issue `#N` is the number and the index, and they are one to one (`#1` ⇄
  `001-*.md` ⇄ **INT-001**)
- **GitHub owns the number** — create the issue there first (`gh issue create`) and adopt
  what it gives you; never pick `NNN` by counting the files, except under *When GitHub Is
  Not Reachable*
- A finished issue moves to `docs/issues/done/` and its GitHub issue is closed; there is no
  index table in the repository to maintain
- [docs/contributing/ISSUE-MANAGEMENT.md](docs/contributing/ISSUE-MANAGEMENT.md) is the
  workflow; the `create-issue`, `implement-issue` and `finish-branch` skills drive it

### AI Assistant Guidelines

- Claude Code is the preferred AI assistant with pre-configured context
- Switch roles with `/role <name>`; the active role is kept in the git-ignored
  `CLAUDE.local.md`
- Follow [docs/contributing/AI-ASSISTANTS.md](docs/contributing/AI-ASSISTANTS.md)

### Translation Workflow

- Use the `.translated/` directory for temporary team member translations
- Follow [docs/contributing/TRANSLATION-WORKFLOW.md](docs/contributing/TRANSLATION-WORKFLOW.md)

### Repository Management

- Main branch is `main` (not `master`)
- License: MIT

## Development Setup

### Prerequisites

- Node.js 24 or newer, with npm
- For publishing or consuming `@cassandragargoyle/*` packages: a GitHub token with
  `read:packages` (`write:packages` to publish) exported as `NODE_AUTH_TOKEN`, see `.npmrc`

### Initial Setup

```bash
git clone https://github.com/cassandragargoyle/react-components.git
cd react-components
npm install
npm run build
```

### Build Instructions

```bash
npm run build           # the library: ES modules and .d.ts into dist/
npm run typecheck       # tsc --noEmit over src/, types/ and demo/
npm run dev             # the demo at http://127.0.0.1:5173/demo/, reloading on save
```

In Visual Studio Code, **Run and Debug** offers *Demo: BlockDocument in Chrome* (starts the
server, breakpoints in `src/`) and *Tests: the current file*.

### Releasing

Bump `version` in `package.json`, commit, and push a matching `vX.Y.Z` tag; the publish
workflow refuses a tag that does not match `package.json`.

## Testing

- Framework: Vitest with jsdom and Testing Library, over the sources — `npm test` needs no
  prior build
- Included: `src/**/*.{test,spec}.{ts,tsx}`

### Before Reporting Anything As Done

```bash
npm run typecheck
npm run build
npm test
```

Report what actually ran. A verification that skipped is not one that passed.

## Project-Specific Information

### Dependencies

React and React DOM are peer dependencies. A component that needs a heavy library takes it
as an **optional** peer (as `NodeTablePanel` does with `ag-grid-*`), so the rest of the
library keeps working without it. No runtime dependency is added without a reason written
down in the pull request: consumers must keep working offline, with no CDN.

### Key Rules

- **Reusable, not app-specific.** A component is admitted only when it is usable in more
  than one project; it imports no router, store or host API and carries no domain logic
- **Behaviour through props.** Every public prop is typed and exported as
  `<Component>Props`; styling is overridable through `className`, `style` and the theme
  custom properties
- **The public API is `src/index.ts`.** Removing or renaming anything it exports is a
  breaking change and bumps the version accordingly
- **Accessible by definition.** Keyboard navigation and ARIA semantics are part of done,
  see [GUI Design Principles](docs/architecture/GUI-DESIGN-PRINCIPLES.md)
- **Documented.** Each component ships a `README.md` with usage examples
