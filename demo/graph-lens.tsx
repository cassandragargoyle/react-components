/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The GraphLens3D demo at /demo/graph-lens.html: a graph that defines its own groups and colors
// ?plain removes meta.groups, which shows the default styling of the same graph

import React from 'react';
import { createRoot } from 'react-dom/client';

import { GraphLens3D, type GraphLensDocument, type GraphLensNode } from '../src';

const PLAIN = new URLSearchParams(window.location.search).has('plain');

const LANGUAGES: Record<string, string[]> = {
    Go: ['go.mod', 'go.sum'],
    Rust: ['Cargo.toml', 'Cargo.lock'],
    TypeScript: ['package.json', 'tsconfig.json'],
    Python: ['pyproject.toml', 'requirements.txt'],
};

const nodes: GraphLensNode[] = [];
const links: GraphLensDocument['links'] = [];
for (const [language, manifests] of Object.entries(LANGUAGES)) {
    nodes.push({ id: `language:${language}`, type: 'language', label: language, group: 'language' });
    for (const manifest of manifests) {
        nodes.push({ id: `manifest:${manifest}`, type: 'manifest', label: manifest, group: 'manifest' });
        links.push({ source: `language:${language}`, target: `manifest:${manifest}` });
    }
}

const graph: GraphLensDocument = {
    meta: {
        title: 'Software manifests by programming language',
        ...(PLAIN
            ? {}
            : {
                  groups: {
                      language: { label: 'Programming language', color: '#d29922' },
                      manifest: { label: 'Manifest', color: '#58a6ff' },
                  },
              }),
    },
    nodes,
    links,
};

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GraphLens3D data={graph} />
    </React.StrictMode>
);
