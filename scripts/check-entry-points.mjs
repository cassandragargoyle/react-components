/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Checks the built entry points in dist/ against the optional peers each may load (INT-005)
// Run after `npm run build`: walks every entry's import graph, then imports the light ones in plain Node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const OPTIONAL_PEERS = Object.keys(pkg.peerDependenciesMeta ?? {}).filter((name) => pkg.peerDependenciesMeta[name].optional);
const REQUIRED_PEERS = Object.keys(pkg.peerDependencies ?? {}).filter((name) => !OPTIONAL_PEERS.includes(name));

const AG_GRID = ['ag-grid-community', 'ag-grid-react'];

// The optional peers each subpath is allowed to reach, statically or lazily; the README
// table documents the same list. A subpath missing here, or a peer it reaches beyond its
// list, fails the check
const EXPECTED_PEERS = {
    '.': [...AG_GRID, 'cytoscape', 'cytoscape-dagre', '3d-force-graph', '@xyflow/react', 'react-markdown', 'remark-gfm'],
    './avatar': [],
    './block-document': [],
    './carousel': [],
    './code-editor': [],
    './git-history': [],
    './graph-canvas': [...AG_GRID, 'cytoscape', 'cytoscape-dagre'],
    './graph-lens-3d': [...AG_GRID, '3d-force-graph'],
    './markdown-view': ['react-markdown', 'remark-gfm'],
    './node-table-panel': AG_GRID,
    './open-panel': [],
    './progress': [],
    './radial-menu': [],
    './workflow-canvas': [...AG_GRID, '@xyflow/react'],
};

// Static `import … from '…'`, `export … from '…'`, a bare `import '…'`, and `import('…')`
const IMPORT_PATTERN = /\b(?:import|export)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function packageName(specifier) {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

// Every bare package an entry file reaches through the relative imports of dist/
function reachedPackages(entryFile) {
    const packages = new Set();
    const seen = new Set();
    const queue = [entryFile];
    while (queue.length > 0) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(IMPORT_PATTERN)) {
            const specifier = match[1] ?? match[2];
            if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier));
            else packages.add(packageName(specifier));
        }
    }
    return packages;
}

// Imports the entry in a fresh Node process in which every optional peer fails to resolve,
// as it does for a consumer that never installed them
function importWithoutPeers(entryFile) {
    const script = `
        import { registerHooks } from 'node:module';
        const blocked = new Set(${JSON.stringify(OPTIONAL_PEERS)});
        registerHooks({
            resolve(specifier, context, next) {
                const parts = specifier.split('/');
                const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
                if (blocked.has(name)) {
                    const error = new Error("Cannot find package '" + specifier + "' (blocked by check-entry-points)");
                    error.code = 'ERR_MODULE_NOT_FOUND';
                    throw error;
                }
                return next(specifier, context);
            },
        });
        await import(${JSON.stringify(pathToFileURL(entryFile).href)});
    `;
    return spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: root, encoding: 'utf8' });
}

const failures = [];
const fail = (subpath, message) => failures.push(`${subpath}: ${message}`);

for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (typeof target === 'string') continue;
    const expected = EXPECTED_PEERS[subpath];
    if (!expected) {
        fail(subpath, 'not listed in EXPECTED_PEERS of scripts/check-entry-points.mjs');
        continue;
    }
    const entryFile = resolve(root, target.import);
    const typesFile = resolve(root, target.types);
    if (!existsSync(entryFile)) fail(subpath, `${target.import} is missing; run npm run build first`);
    if (!existsSync(typesFile)) fail(subpath, `${target.types} is missing`);
    if (!existsSync(entryFile)) continue;

    const reached = reachedPackages(entryFile);
    for (const name of reached) {
        // Vite writes this placeholder when an optional peer is missing at build time
        if (name.startsWith('__vite-optional-peer-dep:')) {
            fail(subpath, `built against a missing optional peer (${name}); run npm install and build again`);
            continue;
        }
        const isOwn = REQUIRED_PEERS.includes(name);
        if (!isOwn && !expected.includes(name)) fail(subpath, `reaches '${name}', which it is not allowed to load`);
    }
    for (const name of expected) {
        if (!reached.has(name)) fail(subpath, `no longer reaches '${name}'; remove it from EXPECTED_PEERS and the README`);
    }

    if (expected.length === 0) {
        const result = importWithoutPeers(entryFile);
        if (result.status !== 0) fail(subpath, `does not load in plain Node without the optional peers:\n${result.stderr.trim()}`);
    }

    const peers = expected.length > 0 ? expected.join(', ') : 'no optional peers, imported in plain Node';
    console.log(`${failures.some((f) => f.startsWith(`${subpath}:`)) ? 'FAIL' : 'ok  '} ${subpath} (${peers})`);
}

for (const subpath of Object.keys(EXPECTED_PEERS)) {
    if (!(subpath in pkg.exports)) fail(subpath, 'listed in EXPECTED_PEERS but not in package.json exports');
}

if (failures.length > 0) {
    console.error(`\n${failures.length} entry point check(s) failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('\nEvery entry point loads only the optional peers it is allowed to.');
