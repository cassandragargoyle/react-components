/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the GraphLens detail panel: the group row and badge color of a node
// A document without groups must show the same rows as before

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GraphLensDetailPanel } from './GraphLensDetailPanel';
import type { GraphLensDocument } from './types';

const showNode = (data: GraphLensDocument): HTMLElement => {
    const { container } = render(
        <GraphLensDetailPanel
            selection={{ kind: 'node', id: 'n1' }}
            data={data}
            degreeOf={() => 0}
            onNodeClick={vi.fn()}
        />
    );
    return container.querySelector<HTMLElement>('.graphlens-detail-badge')!;
};

describe('GraphLensDetailPanel', () => {
    it('shows the group label and color from the document', () => {
        const badge = showNode({
            meta: { groups: { language: { label: 'Programming language', color: '#112233' } } },
            nodes: [{ id: 'n1', type: 'language', label: 'C', group: 'language' }],
            links: [],
        });

        expect(screen.getByText('Group')).toBeInTheDocument();
        expect(screen.getByText('Programming language')).toBeInTheDocument();
        expect(badge).toHaveStyle({ background: '#112233' });
    });

    it('shows the group key when the group has no definition', () => {
        showNode({ nodes: [{ id: 'n1', type: 'language', label: 'C', group: 'compiled' }], links: [] });

        expect(screen.getByText('Group')).toBeInTheDocument();
        expect(screen.getByText('compiled')).toBeInTheDocument();
    });

    it('shows no group row for a group that is not text', () => {
        const group = { a: 1 } as unknown as string;
        showNode({ nodes: [{ id: 'n1', type: 'language', label: 'C', group }], links: [] });

        expect(screen.queryByText('Group')).not.toBeInTheDocument();
    });

    it('shows no group row for a document without groups', () => {
        showNode({ nodes: [{ id: 'n1', type: 'voice', label: 'Too expensive', voice: 'VoC' }], links: [] });

        expect(screen.queryByText('Group')).not.toBeInTheDocument();
    });
});
