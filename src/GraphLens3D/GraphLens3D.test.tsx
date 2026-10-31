/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the GraphLens3D container with the 3D viewport and the grid replaced by stubs
// They cover what the helpers cannot: statistics across selections, and invalid documents

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GraphLens3D } from './GraphLens3D';
import { kindColumnWidth } from './GraphLensNodeTable';
import type { GraphLensDocument, GraphLensGroups, GraphLensNode } from './types';

vi.mock('./GraphLens3DViewport', () => ({ GraphLens3DViewport: () => null }));

vi.mock('./GraphLensNodeTable', async (importActual) => ({
    ...(await importActual<typeof import('./GraphLensNodeTable')>()),
    GraphLensNodeTable: ({ nodes, onNodeClick }: { nodes: GraphLensNode[]; onNodeClick: (id: string) => void }) => (
        <div>
            {nodes.map((node) => (
                <button key={node.id} onClick={() => onNodeClick(node.id)}>
                    select {node.id}
                </button>
            ))}
        </div>
    ),
}));

const nodes: GraphLensNode[] = [
    { id: 'a', type: 'x', label: 'A' },
    { id: 'b', type: 'y', label: 'B' },
    { id: 'c', type: 'x', label: 'C' },
];
const links = [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
];

const statRows = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll('.graphlens-stat-row')).map((row) => row.textContent ?? '');

const documentWith = (groups: GraphLensGroups): GraphLensDocument => ({ meta: { groups }, nodes, links });

describe('GraphLens3D', () => {
    it.each([
        ['equal labels', { x: { label: 'Same' }, y: { label: 'Same' } }],
        ['labels equal to statistics keys', { x: { label: 'nodes' }, y: { label: 'links' } }],
        ['types equal to statistics keys', {}],
    ])('keeps the statistics correct across selections with %s', (name, groups) => {
        const data = documentWith(groups);
        if (name.startsWith('types')) {
            data.nodes = [
                { id: 'a', type: 'nodes', label: 'A' },
                { id: 'b', type: 'links', label: 'B' },
                { id: 'c', type: 'nodes', label: 'C' },
            ];
        }
        const { container } = render(<GraphLens3D data={data} />);
        expect(statRows(container)).toHaveLength(4);

        fireEvent.click(screen.getByText('select a'));
        expect(statRows(container)).toHaveLength(5);
        fireEvent.click(screen.getByText('select b'));
        expect(statRows(container)).toHaveLength(4);
        fireEvent.click(screen.getByTitle('Previous selection'));
        expect(statRows(container)).toHaveLength(5);
    });

    it('renders a document whose groups, voices and types are not text', () => {
        const invalid = { a: 1 } as unknown as string;
        const { container } = render(
            <GraphLens3D
                data={{
                    nodes: [
                        { id: 'a', type: 'x', label: 'A', group: invalid },
                        { id: 'b', type: 'x', label: 'B', voice: invalid },
                        { id: 'c', type: invalid, label: 'C' },
                    ],
                    links: [],
                }}
            />
        );

        const filters = Array.from(container.querySelectorAll('.graphlens-filter')).map((f) => f.textContent);
        expect(filters).toEqual(['voice', 'x']);
    });

    it.each(['type', 'voice', 'title', 'label', 'description'])('selects a node with an object as %s', (field) => {
        const node = { id: 'a', type: 'x', label: 'A', [field]: { a: 1 } } as GraphLensNode;
        const { container } = render(<GraphLens3D data={{ nodes: [node], links: [] }} />);

        fireEvent.click(screen.getByText('select a'));

        expect(container.querySelector('.graphlens-detail-header')).toHaveTextContent(/^a$/i);
    });

    it('counts links to missing nodes in the statistics', () => {
        const { container } = render(
            <GraphLens3D data={{ nodes, links: [...links, { source: 'a', target: 'ghost' }] }} />
        );

        const rows = statRows(container);
        expect(rows).toContain('links2');
        expect(rows).toContain('links to missing nodes1');
    });

    it('shows no count when every link is valid', () => {
        const { container } = render(<GraphLens3D data={{ nodes, links }} />);

        expect(statRows(container).join()).not.toContain('missing');
    });

    it('renders an object in meta.title, link.rel and link.description', () => {
        const object = { a: 1 } as unknown as string;
        render(
            <GraphLens3D
                data={{
                    meta: { title: object },
                    nodes,
                    links: [{ source: 'a', target: 'b', rel: object, description: object }],
                }}
            />
        );

        expect(screen.getByText('GraphLens 3D')).toBeInTheDocument();
    });

    it.each([
        ['an empty object', {}],
        ['an array', []],
        ['null nodes', { nodes: null, links: [] }],
    ])('shows an error for %s', (_name, input) => {
        render(<GraphLens3D data={input as GraphLensDocument} />);

        expect(screen.getByText('Could not load the graph')).toBeInTheDocument();
        expect(screen.getByText('The document is not a valid graph.')).toBeInTheDocument();
    });

    it('keeps the loading screen while there is no document', () => {
        render(<GraphLens3D data={null} />);

        expect(screen.queryByText('Could not load the graph')).not.toBeInTheDocument();
    });

    it.each([
        ['with groups', { x: { label: 'X' } }, true],
        ['with empty groups', {}, false],
        ['with an array as groups', [{ label: 'X' }], false],
        ['with text as groups', 'groups', false],
    ])('puts the filters in a column only for a document %s', (_name, groups, column) => {
        const data = documentWith(groups as unknown as GraphLensGroups);
        const { container } = render(<GraphLens3D data={data} />);

        expect(container.querySelector('.graphlens-filters-column') !== null).toBe(column);
        expect(container.querySelector('.graphlens-filters')).toBeInTheDocument();
    });

    it('keeps the wrapped filters for a document without meta', () => {
        const { container } = render(<GraphLens3D data={{ nodes, links }} />);

        expect(container.querySelector('.graphlens-filters-column')).toBeNull();
    });

    it('keeps a label from the document as written, and built-in keys capitalized', () => {
        const { container } = render(<GraphLens3D data={documentWith({ x: { label: 'iOS app' } })} />);

        const literal = Array.from(container.querySelectorAll('.graphlens-stat-k-literal'));
        expect(literal.map((key) => key.textContent)).toEqual(['iOS app']);
        expect(container.querySelectorAll('.graphlens-stat-k')).toHaveLength(4);
    });
});

describe('kindColumnWidth', () => {
    it('keeps the default width for short kinds', () => {
        expect(kindColumnWidth([{ kind: 'VoC' }, { kind: 'tag' }])).toBe(100);
        expect(kindColumnWidth([])).toBe(100);
    });

    it('fits a longer label', () => {
        expect(kindColumnWidth([{ kind: 'Programming language' }])).toBe(184);
    });

    it('stops at a maximum width', () => {
        expect(kindColumnWidth([{ kind: 'L'.repeat(300) }])).toBe(260);
    });

    it('handles more rows than a call can take as arguments', () => {
        const rows = new Array(500_000).fill({ kind: 'Manifest' });
        expect(kindColumnWidth(rows)).toBe(100);
    });
});
