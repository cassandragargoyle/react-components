/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Library build for the @cassandragargoyle/react-components package (ADR-012)
// Emits ESM JS for the root entry and one entry per component (INT-005), plus a per-file .d.ts tree

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { cssAsString } from './vite.css-as-string.ts';

const root = dirname(fileURLToPath(import.meta.url));

interface ExportTarget {
    types: string;
    import: string;
}

// The entries are read from package.json "exports", so the build and the published map
// cannot drift apart: `./dist/<name>.js` is built from the source directory its types
// point at, `./dist/<Dir>/index.d.ts` -> `src/<Dir>/index.ts`
function libraryEntries(): Record<string, string> {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
        exports: Record<string, ExportTarget | string>;
    };
    const entries: Record<string, string> = {};
    for (const target of Object.values(pkg.exports)) {
        if (typeof target === 'string') continue;
        const name = /^\.\/dist\/(.+)\.js$/.exec(target.import)?.[1];
        const source = /^\.\/dist\/(.*)\.d\.ts$/.exec(target.types)?.[1];
        if (!name || source === undefined) throw new Error(`Unexpected exports target: ${JSON.stringify(target)}`);
        entries[name] = resolve(root, 'src', `${source}.ts`);
    }
    return entries;
}

// Any bare specifier (react and every optional peer a component may pull in) is a
// dependency the consumer installs — keep it external. Only this package's own
// source, reached by relative import, gets inlined into the bundle. A peer's
// stylesheet is the exception: it is inlined as text by cssAsString, because an
// external `import 'pkg/x.css'` breaks every consumer that runs the package in
// Node (Vitest, SSR), where a .css file cannot be imported
function isExternal(id: string): boolean {
    if (id.startsWith('.') || id.startsWith('\0') || isAbsolute(id)) return false;
    if (id.endsWith('.css')) return false;
    return true;
}

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: false,
        lib: {
            entry: libraryEntries(),
            formats: ['es'],
        },
        rollupOptions: {
            external: isExternal,
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: '[name][extname]',
            },
        },
    },
    plugins: [
        cssAsString(),
        dts({
            // Per-file .d.ts tree rather than an api-extractor rollup: a rollup cannot
            // resolve optional peers that ship no bundled types. entryRoot keeps the
            // emitted tree flat, so ./dist/index.d.ts matches package.json "types"
            rollupTypes: false,
            entryRoot: 'src',
            tsconfigPath: resolve(root, 'tsconfig.build.json'),
        }),
    ],
});
