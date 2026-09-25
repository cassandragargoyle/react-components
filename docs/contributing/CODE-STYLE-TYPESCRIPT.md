# TypeScript Code Style Guide

## Overview

This document defines the TypeScript coding standards for this project.
All TypeScript source code — the components, their hooks and types, the tests and the build
configuration — MUST follow these conventions.

## General Principles

- Enable `"strict": true` in all `tsconfig.json` files
- Prefer union types over enums
- Prefer named exports over default exports
- All program text (messages, labels, constants) in English
- Comments in English, written as phrases (no ending periods)

## Naming Conventions

### Files

- **camelCase** for service/utility files: `tiffConverter.ts`, `connectionManager.ts`
- **PascalCase** for React component files: `Canvas.tsx`, `OverlayLayer.tsx`
- **Types suffix** for type-only files: `connectionTypes.ts`, `messageTypes.ts`
- **Hooks follow React pattern**: `useConnectionStatus.ts`, `useGitStatus.ts`
- **Barrel files**: `index.ts` for public API re-exports
- **Test files**: `<name>.test.ts`

### Variables and Functions

- Use `camelCase` for variables, functions, methods: `overlayCount`, `updateOverlays()`
- Use `PascalCase` for classes and React components: `CanvasEditorProvider`, `Canvas`
- Use `UPPER_SNAKE_CASE` for module-level constants: `VALID_CATEGORIES`, `CONFIG_DIR`
- Short names for short scopes: `i`, `o`, `err`

### Types and Interfaces

- Use `PascalCase`: `OverlayObject`, `CanvasFile`
- Prefix interfaces only when defining contracts: `CanvasApiProvider`, `CanvasStateListener`
- Use descriptive names without `I` prefix

## Type System

### Union Types Over Enums

```typescript
// Preferred — union type
export type OverlayCategory = 'field' | 'text_zone' | 'barcode' | 'marker';

// Runtime validation via Set when needed
const VALID_CATEGORIES = new Set<string>(['field', 'text_zone', 'barcode', 'marker']);
```

### Interfaces for Object Shapes

```typescript
export interface OverlayObject {
    /** Unique identifier */
    id: string;
    /** Display label shown on the overlay */
    label: string;
    /** Bounding box in pixel coordinates */
    bbox: BoundingBox;
}
```

### Discriminated Unions for Messages

```typescript
export type ExtensionToWebviewMessage =
    | { type: 'setImage'; uri: string; width: number; height: number }
    | { type: 'setOverlays'; overlays: OverlayObject[] }
    | { type: 'clearOverlays' };
```

### Utility Types

Use built-in utility types where appropriate:

```typescript
Record<OverlayCategory, { border: string; fill: string }>
Omit<RecentItem, 'lastOpened'>
Partial<OverlayStyle>
```

## Code Formatting

### Indentation

- **4 spaces** for indentation (no tabs)

### Quotes

- **Single quotes** for all strings: `'utf-8'`, `'canvas'`

### Semicolons

- **Required** at end of all statements

### Line Length

- No hard limit, but aim for readability
- Break long lines at logical points

## Import Organization

### Import Order

Group imports in this order, separated by blank lines:

```typescript
// Node.js built-in modules
import * as path from 'path';
import * as fs from 'fs';

// Third-party packages
import * as vscode from 'vscode';

// Local modules
import { CanvasFile, OverlayObject, isValidCanvasFile } from '../../shared/types/canvasFile';
import { ImageConversionService } from '../services/ImageConversionService';
```

### Import Style

- **Named imports** for specific items: `import { useEffect, useRef } from 'react'`
- **Namespace imports** for Node.js modules: `import * as path from 'path'`
- **Type re-exports** via `export type` in barrel files

## Export Patterns

### Named Exports

```typescript
// Preferred — named exports
export function isValidCanvasFile(data: unknown): data is CanvasFile { ... }
export class CanvasEditorProvider { ... }
export const CATEGORY_COLORS: Record<OverlayCategory, ...> = { ... };
```

### Barrel Files

```typescript
// index.ts — re-export public API
export { Canvas } from './Canvas';
export type { OverlayObject, OverlayCategory } from './types';
```

### No Default Exports

Default exports are not used in this project. Always use named exports.

## Comments and Documentation

### File Headers

Every source file starts with a license block and a purpose comment:

```typescript
/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Standalone avatar: an image with an initials fallback and a click-to-open menu
// Domain-neutral — carries no application dependency
```

### JSDoc

Use JSDoc for exported interfaces, classes, and public methods:

```typescript
/** Canvas type determines default tool palette and editor behavior */
export type CanvasType = 'manual_form' | 'template' | 'review';

/**
 * Custom editor provider for a canvas document.
 * Implements CustomEditorProvider so VS Code manages save lifecycle natively.
 */
export class CanvasEditorProvider { ... }
```

Use single-line JSDoc for fields and simple methods:

```typescript
/** Unique identifier */
id: string;
/** Whether the user can move/resize this overlay in the GUI */
editable: boolean;
```

### Inline Comments

- Write as phrases, no ending period
- Explain **why**, not **what**

```typescript
// Selection info takes priority over cursor position
if (this.selectedOverlayIds.size > 0) return;
```

## Error Handling

### Try-Catch Pattern

```typescript
try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    // ...
} catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to load file: ${msg}`);
}
```

### Silent Fallback for Expected Failures

```typescript
try {
    const content = await fs.promises.readFile(canvasPath, 'utf-8');
    // ...
} catch {
    // No canvas file found — normal case
}
```

### Validation Functions

Use type guards for runtime validation of external data:

```typescript
export function isValidCanvasFile(data: unknown): data is CanvasFile {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return obj.version === '1.0' && typeof obj.canvas_type === 'string';
}
```

## React Components

### Functional Components

```typescript
export function Canvas(): React.ReactElement {
    const [overlays, setOverlays] = useState<OverlayObject[]>([]);
    // ...
}
```

### Hooks

- Name custom hooks with `use` prefix: `useConnectionStatus`
- Extract reusable logic into custom hooks

### State Management

- Use `useState` for component-local state
- Use `useRef` for mutable values that don't trigger re-render
- Use `useCallback` for stable function references passed as props

## Project-Specific Conventions

### One Directory per Component

- `src/<Component>/` holds the component, its stylesheet, its types, its hooks, its tests
  and its `README.md`
- `src/<Component>/index.ts` is the component's barrel; `src/index.ts` re-exports it, and
  only what `src/index.ts` exports is public API
- Tests sit beside the source as `<Component>.test.tsx`

### Props

- Every public prop is typed and exported as `<Component>Props`
- Behaviour is driven by props; a component holds no application state and imports no
  router, store or host API
- Styling is overridable: accept `className` and `style`, and forward `ref` where a
  consumer could reasonably need the DOM node

### Stylesheets

- A component imports its stylesheet as a string (`import styles from './X.css'`) and
  injects it once at runtime, guarded by `typeof styles === 'string' && styles`, so the
  bundle stays a single file; under Vitest every `.css` import resolves to `''`
- Class names are prefixed with the component name, so two components never collide

### Optional Peers

- A component that needs a heavy library (`ag-grid-*`) takes it as an optional peer
  dependency; the rest of the library must keep working without it installed

## tsconfig.json

All TypeScript packages MUST include these compiler options:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [React Reference](https://react.dev/reference/react)
- Project-specific requirements in [AGENTS.md](../../AGENTS.md)
