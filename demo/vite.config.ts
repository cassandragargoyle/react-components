/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The demo server: components straight from src/ with the BlockDocument sample beside them
// `npm run dev` serves http://127.0.0.1:5173/demo/; the VS Code debugger launches it

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { cssAsString } from '../vite.css-as-string.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
    // The repository is the root, so source maps point at src/ and the debugger finds it
    root: repo,
    // The sample's plans and media are served from /, where its relative paths resolve
    publicDir: resolve(repo, 'src/BlockDocument/samples'),
    plugins: [cssAsString()],
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        open: false,
    },
});
