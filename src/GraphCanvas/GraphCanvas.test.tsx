/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for GraphCanvas host messaging and keyboard selection
// Checks the ready handshake and that Ctrl+A / Escape drive the graph selection

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';
import type { GraphDocument } from './types';

// jsdom has no canvas: run Cytoscape headless, with the real graph model underneath
vi.mock('cytoscape', async (importOriginal) => {
    const actual = ((await importOriginal()) as { default: typeof import('cytoscape') }).default;
    const headless = Object.assign(
        (options?: import('cytoscape').CytoscapeOptions) => actual({ ...options, headless: true }),
        actual
    );
    return { default: headless };
});

if (typeof ResizeObserver === 'undefined') {
    vi.stubGlobal('ResizeObserver', class {
        observe(): void {}
        disconnect(): void {}
    });
}

const DOC: GraphDocument = {
    version: '1.0',
    nodes: [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'ab', source: 'a', target: 'b' }],
};

/** Last selection the canvas reported to its port */
function lastSelection(postMessage: ReturnType<typeof vi.fn>): unknown {
    const calls = postMessage.mock.calls.filter(([m]) => (m as { type: string }).type === 'selectionChanged');
    return (calls[calls.length - 1]?.[0] as { elements: unknown } | undefined)?.elements;
}

describe('GraphCanvas', () => {
    it('posts ready on the port it is given', () => {
        const api = { postMessage: vi.fn() };
        render(<GraphCanvas api={api} />);
        expect(api.postMessage).toHaveBeenCalledWith({ type: 'ready' });
    });

    it('selects all nodes on Ctrl+A and clears the graph selection on Escape', async () => {
        const api = { postMessage: vi.fn() };
        render(<GraphCanvas api={api} />);
        act(() => {
            window.dispatchEvent(new MessageEvent('message', { data: { type: 'setGraphData', data: DOC } }));
        });

        fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
        await waitFor(() => expect(lastSelection(api.postMessage)).toEqual([
            { type: 'node', id: 'a' },
            { type: 'node', id: 'b' },
        ]));

        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(lastSelection(api.postMessage)).toEqual([]));
    });
});
