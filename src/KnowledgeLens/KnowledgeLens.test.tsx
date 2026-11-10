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
import cytoscape from 'cytoscape';
import { applyEdgeLabels, applyRoutes, defaultEdgeStyle, edgeGeometry, wheelZoomFactor, wrapTitle } from './KnowledgeViewport';
import { DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH } from './PanelSplitter';
import type { KnowledgeLensLayout } from './types';

// jsdom has no canvas: run Cytoscape headless, with the real graph model underneath
vi.mock('cytoscape', async (importOriginal) => {
    const actual = ((await importOriginal()) as { default: typeof import('cytoscape') }).default;
    const headless = Object.assign(
        (options?: import('cytoscape').CytoscapeOptions) => actual({ ...options, headless: true, styleEnabled: true }),
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

describe('file comments', () => {
    it('opens the head comment from the header and saves that it is open', async () => {
        const api = { postMessage: vi.fn() };
        render(<KnowledgeLens api={api} canSave />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const toggle = screen.getByRole('button', { name: /About this file/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByLabelText('File comment')).toBeNull();

        fireEvent.click(toggle);
        const about = screen.getByLabelText('File comment');
        expect(about).toHaveTextContent('Znalostní model § 4 – Záměr');
        expect(about.textContent).not.toMatch(/====/);

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        const call = api.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'requestSave');
        expect((call?.[0] as { layout: KnowledgeLensLayout }).layout.aboutOpen).toBe(true);
    });

    it('shows the section comment of the selected node', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        send({ type: 'selectNode', ids: [`${SZ}zamer`] });
        const panel = screen.getByRole('complementary', { name: 'Properties' });
        await waitFor(() => expect(within(panel).getByText('Definované pojmy')).toBeInTheDocument());
    });

    it('has no About toggle for a file without a head comment', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        send({ type: 'setTurtleData', text: '<http://a> <http://b> "c" .', fileName: 'plain.ttl' });
        await screen.findByRole('region', { name: 'Classes' });
        expect(screen.queryByRole('button', { name: /About this file/ })).toBeNull();
    });
});

describe('property panel splitter', () => {
    it('resizes the panel with the arrow keys, keeps the limits and saves the width', async () => {
        const api = { postMessage: vi.fn() };
        render(<KnowledgeLens api={api} canSave />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const splitter = screen.getByRole('separator', { name: 'Resize properties panel' });
        const panel = screen.getByRole('complementary', { name: 'Properties' });
        expect(splitter).toHaveAttribute('aria-valuenow', String(DEFAULT_PANEL_WIDTH));

        fireEvent.keyDown(splitter, { key: 'ArrowLeft' });
        fireEvent.keyDown(splitter, { key: 'ArrowLeft' });
        expect(panel.style.width).toBe(`${DEFAULT_PANEL_WIDTH + 32}px`);

        for (let i = 0; i < 20; i++) fireEvent.keyDown(splitter, { key: 'ArrowRight' });
        expect(splitter).toHaveAttribute('aria-valuenow', String(MIN_PANEL_WIDTH));

        fireEvent.doubleClick(splitter);
        fireEvent.keyDown(splitter, { key: 'ArrowLeft' });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        const call = api.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'requestSave');
        expect((call?.[0] as { layout: KnowledgeLensLayout }).layout.propertyPanelWidth).toBe(DEFAULT_PANEL_WIDTH + 16);
    });

    it('drags the panel wider when the splitter moves left', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const splitter = screen.getByRole('separator');
        fireEvent.mouseDown(splitter, { clientX: 500 });
        fireEvent.mouseMove(window, { clientX: 400 });
        fireEvent.mouseUp(window);
        expect(splitter).toHaveAttribute('aria-valuenow', String(DEFAULT_PANEL_WIDTH + 100));
    });

    it('opens with the saved width', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample({ version: 1, propertyPanelWidth: 320 });
        await screen.findByRole('region', { name: 'Classes' });
        expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '320');
    });
});

describe('edge style', () => {
    it('is orthogonal for dagre and straight for the other layouts', () => {
        expect(defaultEdgeStyle('dagre')).toBe('orthogonal');
        expect(defaultEdgeStyle('cose')).toBe('straight');
        expect(edgeGeometry('orthogonal')['curve-style']).toBe('taxi');
        expect(edgeGeometry('curved')['curve-style']).toBe('bezier');
    });

    it('is chosen in the toolbar and saved with the layout', async () => {
        const api = { postMessage: vi.fn() };
        render(<KnowledgeLens api={api} canSave />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const select = screen.getByLabelText('Edges:') as HTMLSelectElement;
        expect(select.value).toBe('orthogonal');
        fireEvent.change(select, { target: { value: 'curved' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        const call = api.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'requestSave');
        expect((call?.[0] as { layout: KnowledgeLensLayout }).layout.edgeStyle).toBe('curved');
    });

    it('shows a joined label once with orthogonal edges', () => {
        const cy = cytoscape({ headless: true });
        cy.add([
            { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'z' } },
            { data: { id: 'e1', source: 'a', target: 'z', predicate: 'p', label: 'broader' } },
            { data: { id: 'e2', source: 'b', target: 'z', predicate: 'p', label: 'broader' } },
        ]);
        applyEdgeLabels(cy, 'orthogonal');
        expect([cy.$id('e1').data('shownLabel'), cy.$id('e2').data('shownLabel')]).toEqual(['broader', '']);
        applyEdgeLabels(cy, 'straight');
        expect(cy.$id('e2').data('shownLabel')).toBe('broader');
        // A hidden edge passes its label on to the next one
        cy.$id('e1').addClass('kl-hidden');
        applyEdgeLabels(cy, 'orthogonal');
        expect(cy.$id('e2').data('shownLabel')).toBe('broader');
        cy.destroy();
    });
});

/** Cytoscape instance the viewport registered on its container */
function cyOf(): import('cytoscape').Core {
    const el = document.querySelector('.graph-viewport-container') as unknown as { _cyreg: { cy: import('cytoscape').Core } };
    return el._cyreg.cy;
}

describe('wheel zoom (QA round 1, D1)', () => {
    it('zooms about ×1.15 per mouse-wheel notch and at least 2× in ten notches', () => {
        expect(wheelZoomFactor(-100)).toBeCloseTo(1.149, 2);
        expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.149, 2);
        expect(wheelZoomFactor(-100) ** 10).toBeGreaterThan(2);
        // Firefox reports lines, a page is far more; both are limited
        expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-120), 6);
        expect(wheelZoomFactor(-5, 2)).toBe(wheelZoomFactor(-600));
        // A touchpad step is small
        expect(wheelZoomFactor(-4)).toBeLessThan(1.01);
    });

    it('applies the factor on every wheel event over the canvas, with no warm-up', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const cy = cyOf();
        const container = document.querySelector('.graph-viewport-container')!;
        const before = cy.zoom();
        for (let i = 0; i < 3; i++) fireEvent.wheel(container, { deltaY: -100 });
        expect(cy.zoom() / before).toBeCloseTo(wheelZoomFactor(-100) ** 3, 3);
    });
});

describe('saved layout with unknown values (QA round 1, D2 and D3)', () => {
    it('opens with defaults when the layout name, edge style and width are unknown', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample({ version: 1, layout: 'unknown', edgeStyle: 'evil', propertyPanelWidth: 'wide' } as unknown as KnowledgeLensLayout);
        await screen.findByRole('region', { name: 'Classes' });
        expect((screen.getByLabelText('Layout:') as HTMLSelectElement).value).toBe('dagre');
        expect((screen.getByLabelText('Edges:') as HTMLSelectElement).value).toBe('orthogonal');
        expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', String(DEFAULT_PANEL_WIDTH));
        expect(cyOf().nodes()).toHaveLength(25);
    });
});

describe('edge routing (QA round 1, D4)', () => {
    it('routes orthogonal edges as segments and drops the routes for other styles', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const cy = cyOf();
        await waitFor(() => expect(cy.edges().filter((e) => e.style('curve-style') === 'segments').length).toBe(43));
        applyRoutes(cy, 'straight');
        expect(cy.edges().filter((e) => e.style('curve-style') === 'segments').length).toBe(0);
    });

    it('reroutes the visible edges when a filter changes (QA round 2, O-R2-2)', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        const classes = await screen.findByRole('region', { name: 'Classes' });
        const cy = cyOf();
        await waitFor(() => expect(cy.edges().filter((e) => e.style('curve-style') === 'segments').length).toBe(43));
        // A marker the router overwrites when it runs again
        const edge = cy.edges().filter((e) => e.data('predicate').endsWith('broader'))[0];
        edge.style('segment-distances', '999');
        fireEvent.click(within(within(classes).getByText('LegalReference').closest('label')!).getByRole('checkbox'));
        expect(edge.style('segment-distances')).not.toBe('999px');
        expect(edge.style('curve-style')).toBe('segments');
    });

    it('reroutes the edges of a dragged node in the drag event, before the next frame (QA round 2, O-R2-1)', async () => {
        render(<KnowledgeLens api={{ postMessage: vi.fn() }} />);
        sendSample();
        await screen.findByRole('region', { name: 'Classes' });
        const cy = cyOf();
        await waitFor(() => expect(cy.edges().filter((e) => e.style('curve-style') === 'segments').length).toBe(43));
        const node = cy.getElementById('https://example.org/stavebni-zakon/par-4#zamer');
        const edges = node.connectedEdges();
        const before = edges.map((e) => `${e.style('source-endpoint')}|${e.style('target-endpoint')}|${e.style('segment-distances')}`);
        const raf = vi.spyOn(window, 'requestAnimationFrame');
        node.position({ x: node.position('x') + 300, y: node.position('y') + 500 });
        node.emit('drag');
        const after = edges.map((e) => `${e.style('source-endpoint')}|${e.style('target-endpoint')}|${e.style('segment-distances')}`);
        expect(after.filter((v, i) => v !== before[i]).length).toBe(edges.length);
        expect(raf).not.toHaveBeenCalled();
        raf.mockRestore();
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
