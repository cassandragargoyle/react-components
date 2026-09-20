/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Library build for the @cassandragargoyle/react-components package (ADR-012)
// Emits ESM JS plus a per-file .d.ts tree from the single src/index.ts entry

import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const root = dirname(fileURLToPath(import.meta.url));

// Any bare specifier (react and every optional peer a component may pull in) is a
// dependency the consumer installs — keep it external. Only this package's own
// source, reached by relative import, gets inlined into the bundle
function isExternal(id: string): boolean {
    if (id.startsWith('.') || id.startsWith('\0') || isAbsolute(id)) return false;
    return true;
}

// Components import their stylesheet as a default string and inject it at runtime
// (`import styles from './x.css'; styleEl.textContent = styles`). Redirect bare
// `.css` imports to Vite's `?inline` so the default export is the CSS text and no
// separate stylesheet asset is emitted — the library stays self-contained
function cssAsString(): Plugin {
    return {
        name: 'react-components-css-as-string',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (source.endsWith('.css')) {
                const resolved = await this.resolve(source, importer, {
                    ...options,
                    skipSelf: true,
                });
                if (resolved) return `${resolved.id}?inline`;
            }
            return null;
        },
    };
}

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: false,
        lib: {
            entry: { index: resolve(root, 'src/index.ts') },
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
