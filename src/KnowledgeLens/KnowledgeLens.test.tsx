/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the KnowledgeLens component: host messaging, the error state, the left panel
// filters, the property panel links and saving the layout

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KnowledgeLens } from './KnowledgeLens';
import { wrapTitle } from './KnowledgeViewport';
import type { KnowledgeLensLayout } from './types';

// jsdom has no canvas: run Cytoscape headless, with the real graph model underneath
vi.mock('cytoscape', async (importOriginal) => {
    const actual = ((await importOriginal()) as { default: typeof import('cytoscape') }).default;
    const headless = Object.assign(
        (options?: import('cytoscape').CytoscapeOptions) => actual({ ...options, headless: true }),
        actual
    );
    return { default: headless };
});

// AG Grid needs layout APIs jsdom lacks; the table is covered by NodeTablePanel's own tests
vi.mock('../NodeTablePanel', () => ({
    NodeTablePanel: ({ rows }: { rows: unknown[] }) => <div data-testid="node-table">{rows.length} rows</div>,
}));

if (typeof ResizeObserver === 'undefined') {
    vi.stubGlobal('ResizeObserver', class {
        observe(): void {}
        disconnect(): void {}
    });
}

const SAMPLE = readFileSync(resolve(__dirname, 'samples/sz-4.ttl'), 'utf8');
const SZ = 'https://example.org/stavebni-zakon/par-4#';

function send(data: unknown): void {
    act(() => {
        window.dispatchEvent(new MessageEvent('message', { data }));
    });
}

function sendSample(layout?: KnowledgeLensLayout): void {
    send({ type: 'setTurtleData', text: SAMPLE, fileName: 'sz-4.ttl', options: { language: 'cs' }, layout });
}

describe('KnowledgeLens', () => {
    it('posts ready on the port it is given', () => {
        const api = { postMessage: vi.fn() };
        render(<KnowledgeLens api={api} />);
        expect(api.postMessage).toHaveBeenCalledWith({ type: 'ready' });
    });

    it('shows the classes, predicates and header of the sample', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        const classes = await screen.findByRole('region', { name: 'Classes' });
        expect(within(classes).getByText('LegalConcept')).toBeInTheDocument();
        expect(within(classes).getByText('Evidence')).toBeInTheDocument();
        const predicates = screen.getByRole('region', { name: 'Predicates' });
        expect(within(predicates).getByText('broader')).toBeInTheDocument();
        expect(screen.getByText('Znalostní model § 4 zákona č. 283/2021 Sb.')).toBeInTheDocument();
        expect(screen.getByText('25 nodes · 43 edges')).toBeInTheDocument();
    });

    it('hides the nodes of a class turned off in the left panel', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        const classes = await screen.findByRole('region', { name: 'Classes' });
        const row = within(classes).getByText('LegalProvision').closest('label')!;
        fireEvent.click(within(row).getByRole('checkbox'));
        expect(screen.getByText(/^18 nodes · /)).toBeInTheDocument();
        expect(screen.getByTestId('node-table')).toHaveTextContent('18 rows');
    });

    it('shows a syntax error with line and column', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        send({ type: 'setTurtleData', text: '<http://a> <http://b> <http://c> .\n<http://d> <http://e> ;; .', fileName: 'bad.ttl' });
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Turtle syntax error');
        expect(alert).toHaveTextContent('bad.ttl:2:23');
    });

    it('lists the triples of the selected node and selects a node from an IRI link', async () => {
        const api = { postMessage: vi.fn() };
        render(<KnowledgeLens api={api} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });

        send({ type: 'selectNode', ids: [`${SZ}zamerEIA`] });
        const panel = await screen.findByRole('complementary', { name: 'Properties' });
        await waitFor(() => expect(panel.querySelector('.knowledge-lens-properties-title')).toHaveTextContent('Záměr EIA'));
        expect(within(panel).getByText('czv:281533')).toBeInTheDocument();
        expect(within(panel).getAllByText('cs', { exact: false }).length).toBeGreaterThan(0);

        // The broader edge leads to záměr, which the link selects
        fireEvent.click(within(panel).getByRole('button', { name: /^→\s*Záměr$/ }));
        await waitFor(() => expect(within(panel).getByText('czv:281471')).toBeInTheDocument());

        // An external IRI asks the host to open it
        fireEvent.click(within(panel).getByText('czv:281471'));
        expect(api.postMessage).toHaveBeenCalledWith({
            type: 'openExternal',
            iri: 'https://e-sbirka.gov.cz/czechvoc/POJMREJ/termin/281471',
        });
    });

    it('saves positions and filters, and restores them from the layout', async () => {
        const api = { postMessage: vi.fn() };
        const { unmount } = render(<KnowledgeLens api={api} canSave />);
        sendSample();
        const classes = await screen.findByRole('region', { name: 'Classes' });
        const save = screen.getByRole('button', { name: 'Save' });
        expect(save).toBeDisabled();

        fireEvent.click(within(within(classes).getByText('Evidence').closest('label')!).getByRole('checkbox'));
        expect(save).toBeEnabled();
        fireEvent.keyDown(window, { key: 's', ctrlKey: true });

        const call = api.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'requestSave');
        const saved = (call?.[0] as { layout: KnowledgeLensLayout }).layout;
        expect(saved.version).toBe(1);
        expect(saved.hiddenClasses).toEqual(['https://example.org/legal-knowledge#Evidence']);
        expect(Object.keys(saved.positions ?? {})).toHaveLength(25);
        expect(save).toBeDisabled();
        unmount();

        render(<KnowledgeLens api={{ postMessage: vi.fn() }} canSave />);
        sendSample(saved);
        const restored = await screen.findByRole('region', { name: 'Classes' });
        const evidence = within(within(restored).getByText('Evidence').closest('label')!).getByRole('checkbox');
        expect(evidence).not.toBeChecked();
    });

    it('has no Save button when the host cannot save', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });
});

describe('wrapTitle', () => {
    it('wraps at words and cuts after three lines', () => {
        expect(wrapTitle('Záměr')).toEqual(['Záměr']);
        expect(wrapTitle('Záměr podléhá posouzení vlivů na životní prostředí')).toEqual([
            'Záměr podléhá posouzení',
            'vlivů na životní prostředí',
        ]);
        expect(wrapTitle('a '.repeat(60), 10)).toHaveLength(3);
    });
});
