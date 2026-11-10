/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Cytoscape viewport of KnowledgeLens: styled boxes with a title and subtitle lines,
// labelled edges, class and predicate filters, stored positions and selection

import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import { nodeSubtitles } from './projectGraph';
import { routeOrthogonal, toSegments, type Box } from './orthogonalRouter';
import type { KnowledgeTheme } from './palette';
import type {
    ClassStyle,
    KnowledgeEdgeStyle,
    KnowledgeGraph,
    KnowledgeLayoutAlgorithm,
    KnowledgeNode,
    KnowledgeSelectedElement,
} from './types';

cytoscape.use(cytoscapeDagre);

/** Imperative surface the main component drives */
export interface KnowledgeViewportHandle {
    fit: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    selectAndPanTo: (nodeId: string) => void;
    toggleSelect: (nodeId: string) => void;
    selectAllNodes: () => void;
    clearSelection: () => void;
    getNodePositions: () => Record<string, { x: number; y: number }>;
}

interface KnowledgeViewportProps {
    graph: KnowledgeGraph;
    theme: KnowledgeTheme;
    subtitleAttributes: string[];
    hiddenClasses: Set<string>;
    hiddenPredicates: Set<string>;
    layout: KnowledgeLayoutAlgorithm;
    edgeStyle: KnowledgeEdgeStyle;
    /** Positions saved with the view; used for nodes the viewport has not placed yet */
    storedPositions?: Record<string, { x: number; y: number }>;
    onSelectionChange: (elements: KnowledgeSelectedElement[]) => void;
    /** A node was moved by hand or a layout ran */
    onPositionsChanged: () => void;
}

/** Characters of a title line before it wraps */
const TITLE_WRAP = 26;
const MAX_TITLE_LINES = 3;
const CHAR_WIDTH = 6.4;
const LINE_HEIGHT = 14;

/** Wrap a title into at most three lines at word boundaries */
export function wrapTitle(title: string, width = TITLE_WRAP, maxLines = MAX_TITLE_LINES): string[] {
    const words = title.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        if (!line) line = word;
        else if (line.length + 1 + word.length <= width) line += ` ${word}`;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, width - 1)}…`;
        return kept;
    }
    return lines;
}

/** Data of one node element: text, size and colours */
export function nodeElementData(node: KnowledgeNode, style: ClassStyle, subtitleAttributes: string[]) {
    const titleLines = wrapTitle(node.title);
    const subtitles = nodeSubtitles(node, subtitleAttributes);
    const lines = [...titleLines, ...subtitles];
    const longest = Math.max(...lines.map((l) => l.length), 8);
    return {
        id: node.id,
        label: lines.join('\n'),
        classIri: node.classIri,
        fill: style.fill,
        border: style.border,
        shape: style.shape ?? 'round-rectangle',
        dashed: node.flags.length > 0 ? 1 : 0,
        width: Math.round(Math.min(240, Math.max(100, longest * CHAR_WIDTH + 24))),
        height: lines.length * LINE_HEIGHT + 18,
    };
}

/** Cytoscape edge geometry of an edge style */
export function edgeGeometry(edgeStyle: KnowledgeEdgeStyle): Record<string, string | number> {
    switch (edgeStyle) {
        case 'orthogonal':
            // Right-angle bends along the rank direction. The turn sits a fixed distance before
            // the target, so edges into one node share the last horizontal segment and enter
            // it together, at a right angle to its border
            return {
                'curve-style': 'taxi',
                'taxi-direction': 'vertical',
                'taxi-turn': '-24px',
                'taxi-turn-min-distance': '8px',
                'source-endpoint': 'outside-to-node',
                'target-endpoint': 'outside-to-node',
            };
        case 'straight':
            return { 'curve-style': 'straight' };
        case 'curved':
            return { 'curve-style': 'bezier' };
    }
}

/** Default edge style of a layout: orthogonal follows the ranks of dagre only */
export function defaultEdgeStyle(layout: KnowledgeLayoutAlgorithm): KnowledgeEdgeStyle {
    return layout === 'dagre' ? 'orthogonal' : 'straight';
}

/**
 * Show each label once where edges join: with orthogonal edges, visible edges of one
 * predicate into one node share a segment, so only the first of them keeps its label
 */
export function applyEdgeLabels(cy: Core, edgeStyle: KnowledgeEdgeStyle): void {
    const seen = new Set<string>();
    cy.batch(() => {
        cy.edges().forEach((e) => {
            const key = `${e.data('target')}\u0000${e.data('predicate')}`;
            const visible = !e.hasClass('kl-hidden') && !e.source().hasClass('kl-hidden') && !e.target().hasClass('kl-hidden');
            const repeated = edgeStyle === 'orthogonal' && visible && seen.has(key);
            if (visible) seen.add(key);
            e.data('shownLabel', repeated ? '' : e.data('label'));
        });
    });
}

/** Bypass properties a routed edge carries; removed when the edge style is not orthogonal */
const ROUTE_PROPERTIES = 'curve-style edge-distances source-endpoint target-endpoint segment-distances segment-weights';
/** Most visible nodes routed around; above it orthogonal edges use the plain taxi shape */
export const ROUTE_NODE_LIMIT = 200;

/**
 * Route the visible edges around the boxes they do not connect (orthogonal style only);
 * every other style, or a graph above the limit, keeps the stylesheet geometry. `only`
 * limits the work to some edges, e.g. those of a node being dragged
 */
export function applyRoutes(cy: Core, edgeStyle: KnowledgeEdgeStyle, only?: cytoscape.EdgeCollection): void {
    const edges = only ?? cy.edges();
    if (edgeStyle !== 'orthogonal') {
        edges.removeStyle(ROUTE_PROPERTIES);
        return;
    }
    const nodes = cy.nodes().filter((n) => !n.hasClass('kl-hidden'));
    if (nodes.length > ROUTE_NODE_LIMIT) {
        edges.removeStyle(ROUTE_PROPERTIES);
        return;
    }
    const boxes = new Map<string, Box>();
    nodes.forEach((n) => {
        const p = n.position();
        const w = n.outerWidth() / 2;
        const h = n.outerHeight() / 2;
        boxes.set(n.id(), { x1: p.x - w, y1: p.y - h, x2: p.x + w, y2: p.y + h });
    });
    const visible = edges.filter((e) => !e.hasClass('kl-hidden') && boxes.has(e.data('source')) && boxes.has(e.data('target')));
    const routes = routeOrthogonal(boxes, visible.map((e) => ({ id: e.id(), source: e.data('source'), target: e.data('target') })));
    cy.batch(() => {
        visible.forEach((e) => {
            const route = routes.get(e.id());
            if (!route) {
                e.removeStyle(ROUTE_PROPERTIES);
                return;
            }
            const sp = e.source().position();
            const tp = e.target().position();
            const seg = toSegments(route, [sp.x, sp.y], [tp.x, tp.y]);
            e.style({
                'curve-style': 'segments',
                'edge-distances': 'endpoints',
                'source-endpoint': seg.sourceEndpoint,
                'target-endpoint': seg.targetEndpoint,
                'segment-weights': seg.weights.map((w) => w.toFixed(6)).join(' '),
                'segment-distances': seg.distances.map((d) => d.toFixed(4)).join(' '),
            });
        });
    });
}

/**
 * Zoom factor of one wheel event: about ×1.15 for a mouse-wheel notch (100 px), smooth for
 * the small steps of a touchpad. Cytoscape scales a notch down to ×1.03, which felt stuck
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
    const pixels = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * 800 : deltaY;
    const clamped = Math.max(-600, Math.min(600, pixels));
    return Math.pow(2, -clamped / 500);
}

export function buildStylesheet(theme: KnowledgeTheme, edgeStyle: KnowledgeEdgeStyle = 'orthogonal'): cytoscape.StylesheetJsonBlock[] {
    return [
        {
            selector: 'node',
            style: {
                'shape': 'data(shape)' as never,
                'label': 'data(label)',
                'text-wrap': 'wrap',
                'text-max-width': '400px',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '11px',
                'line-height': 1.25,
                'color': theme.text,
                'background-color': 'data(fill)',
                'border-color': 'data(border)',
                'border-width': 1.5,
                'width': 'data(width)',
                'height': 'data(height)',
            },
        },
        { selector: 'node[dashed = 1]', style: { 'border-style': 'dashed' } },
        {
            selector: '.hover',
            style: { 'underlay-color': theme.accent, 'underlay-opacity': 0.2, 'underlay-padding': 4 },
        },
        {
            selector: 'node:selected',
            style: { 'border-width': 3, 'border-color': theme.accent },
        },
        {
            selector: 'edge',
            style: {
                'width': 1.3,
                'line-color': theme.edgeLine,
                'target-arrow-color': theme.edgeLine,
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.9,
                ...edgeGeometry(edgeStyle),
                'label': 'data(shownLabel)',
                'font-size': '10px',
                'color': theme.edgeText,
                'text-background-color': theme.background,
                'text-background-opacity': 1,
                'text-background-padding': '2px',
            } as cytoscape.Css.Edge,
        },
        {
            selector: 'edge:selected',
            style: { 'width': 2.5, 'line-color': theme.accent, 'target-arrow-color': theme.accent },
        },
        { selector: '.kl-hidden', style: { display: 'none' } },
    ];
}

/** Cytoscape options of a layout algorithm; dagre places edge targets above their sources */
export function layoutOptions(algorithm: KnowledgeLayoutAlgorithm, animate = true): cytoscape.LayoutOptions {
    const common = { animate, animationDuration: 300, fit: false };
    switch (algorithm) {
        case 'dagre':
            return { name: 'dagre', rankDir: 'BT', nodeSep: 30, rankSep: 70, edgeSep: 10, ...common } as cytoscape.LayoutOptions;
        case 'cose':
            return { name: 'cose', idealEdgeLength: () => 140, nodeOverlap: 20, nodeRepulsion: () => 12000, ...common };
        case 'breadthfirst':
            return { name: 'breadthfirst', spacingFactor: 1.2, directed: true, ...common };
        default:
            // An unknown name (a layout file of another version) falls back to dagre
            return layoutOptions('dagre', animate);
    }
}

/** Fingerprint of the drawn elements, without text or colours */
function structuralKey(graph: KnowledgeGraph): string {
    return `${graph.nodes.map((n) => n.id).join('\u0001')}|${graph.edges.map((e) => `${e.source}>${e.predicate}>${e.target}`).join('\u0001')}`;
}

export const KnowledgeViewport = forwardRef<KnowledgeViewportHandle, KnowledgeViewportProps>(function KnowledgeViewport(
    {
        graph,
        theme,
        subtitleAttributes,
        hiddenClasses,
        hiddenPredicates,
        layout,
        edgeStyle,
        storedPositions,
        onSelectionChange,
        onPositionsChanged,
    },
    ref
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const edgeStyleRef = useRef(edgeStyle);
    edgeStyleRef.current = edgeStyle;
    const cyRef = useRef<Core | null>(null);
    const structureRef = useRef('');
    const appliedLayoutRef = useRef(layout);
    // Latest callbacks, so the Cytoscape listeners bound once always call the current ones
    const callbacks = useRef({ onSelectionChange, onPositionsChanged });
    callbacks.current = { onSelectionChange, onPositionsChanged };

    useEffect(() => {
        if (!containerRef.current) return;
        const cy = cytoscape({
            container: containerRef.current,
            style: buildStylesheet(theme, edgeStyle),
            minZoom: 0.1,
            maxZoom: 4,
        });
        cyRef.current = cy;

        // Wheel zoom handled here, before Cytoscape sees the event (see wheelZoomFactor)
        const wrapper = wrapperRef.current;
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY === 0) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = containerRef.current!.getBoundingClientRect();
            cy.zoom({
                level: cy.zoom() * wheelZoomFactor(e.deltaY, e.deltaMode),
                renderedPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top },
            });
        };
        wrapper?.addEventListener('wheel', handleWheel, { capture: true, passive: false });

        // Edges follow a dragged node. Rerouted in the drag event itself, which comes before
        // Cytoscape draws the frame, so no frame shows the old bends; only the edges of the
        // moving nodes, the rest is rerouted when the node is dropped
        cy.on('drag', 'node', (evt: EventObject) => {
            applyRoutes(cy, edgeStyleRef.current, (evt.target as NodeSingular).connectedEdges());
        });

        // Selection events — coalesced, so selecting many elements at once reports once
        let pending = false;
        const handleSelect = () => {
            if (pending) return;
            pending = true;
            queueMicrotask(() => {
                pending = false;
                if (cy.destroyed()) return;
                const selected: KnowledgeSelectedElement[] = [];
                cy.$(':selected').forEach((ele) => {
                    selected.push({ type: ele.isNode() ? 'node' : 'edge', id: ele.id() });
                });
                callbacks.current.onSelectionChange(selected);
            });
        };
        cy.on('select unselect', handleSelect);
        cy.on('dragfree', 'node', () => {
            applyRoutes(cy, edgeStyleRef.current);
            callbacks.current.onPositionsChanged();
        });
        cy.on('dbltap', 'node', (evt: EventObject) => {
            cy.animate({ center: { eles: evt.target as NodeSingular }, zoom: Math.max(cy.zoom(), 1.5), duration: 300 });
        });
        cy.on('mouseover', 'node, edge', (evt: EventObject) => evt.target.addClass('hover'));
        cy.on('mouseout', 'node, edge', (evt: EventObject) => evt.target.removeClass('hover'));

        let fitted = false;
        const ro = new ResizeObserver(() => {
            cy.resize();
            if (!fitted && cy.nodes().length > 0) {
                fitted = true;
                cy.fit(undefined, 40);
            }
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            wrapper?.removeEventListener('wheel', handleWheel, { capture: true });
            cy.destroy();
            cyRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Theme or edge style change: rebuild the stylesheet only; positions stay
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.style(buildStylesheet(theme, edgeStyle));
        applyEdgeLabels(cy, edgeStyle);
        applyRoutes(cy, edgeStyle);
    }, [theme, edgeStyle]);

    /** Run a layout over the visible elements, then fit */
    const runLayout = useCallback((algorithm: KnowledgeLayoutAlgorithm, animate: boolean) => {
        const cy = cyRef.current;
        if (!cy || cy.nodes().length === 0) return;
        const visible = cy.elements().not('.kl-hidden');
        // Plain geometry while nodes move; the routes are computed where they stop
        cy.edges().removeStyle(ROUTE_PROPERTIES);
        const instance = visible.layout(layoutOptions(algorithm, animate));
        instance.on('layoutstop', () => {
            applyRoutes(cy, edgeStyleRef.current);
            cy.fit(visible, 40);
        });
        instance.run();
    }, []);

    // Graph data: rebuild when the structure changes, otherwise update text and colours in place
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        const styles = new Map(graph.classes.map((c) => [c.iri, c.style]));
        const dataOf = (node: KnowledgeNode) => nodeElementData(node, styles.get(node.classIri) ?? graph.classes[0].style, subtitleAttributes);

        const structure = structuralKey(graph);
        if (structure === structureRef.current) {
            cy.batch(() => {
                for (const node of graph.nodes) cy.getElementById(node.id).data(dataOf(node));
                for (const edge of graph.edges) cy.getElementById(edge.id).data('label', edge.label);
            });
            applyEdgeLabels(cy, edgeStyle);
            // Box sizes may have changed with the text
            applyRoutes(cy, edgeStyle);
            return;
        }
        structureRef.current = structure;

        // Positions already on screen win over the saved ones (a reload after a file change)
        const known: Record<string, { x: number; y: number }> = { ...storedPositions };
        cy.nodes().forEach((n) => {
            known[n.id()] = { ...n.position() };
        });

        cy.batch(() => {
            cy.elements().remove();
            for (const node of graph.nodes) {
                cy.add({ group: 'nodes', data: dataOf(node), position: known[node.id] ? { ...known[node.id] } : undefined });
            }
            for (const edge of graph.edges) {
                cy.add({
                    group: 'edges',
                    data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, predicate: edge.predicate },
                });
            }
            cy.nodes().forEach((n) => {
                n.toggleClass('kl-hidden', hiddenClasses.has(n.data('classIri')));
            });
            cy.edges().forEach((e) => {
                e.toggleClass('kl-hidden', hiddenPredicates.has(e.data('predicate')));
            });
        });
        applyEdgeLabels(cy, edgeStyle);
        cy.resize();

        const unplaced = cy.nodes().filter((n) => !known[n.id()]);
        if (unplaced.length === cy.nodes().length) {
            runLayout(layout, false);
        } else if (unplaced.length > 0) {
            // New nodes go in a grid below the placed ones, so a hand-made layout survives
            const placed = cy.nodes().difference(unplaced).boundingBox();
            unplaced.layout({
                name: 'grid',
                boundingBox: { x1: placed.x1, y1: placed.y2 + 60, w: Math.max(placed.w, 400), h: 60 * Math.ceil(unplaced.length / 6) },
                avoidOverlap: true,
                fit: false,
            }).run();
            applyRoutes(cy, edgeStyle);
            cy.fit(undefined, 40);
        } else {
            applyRoutes(cy, edgeStyle);
            cy.fit(undefined, 40);
        }
    }, [graph, subtitleAttributes]); // eslint-disable-line react-hooks/exhaustive-deps

    // Filters: hide nodes of turned-off classes (their edges go with them) and turned-off predicates
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.batch(() => {
            cy.nodes().forEach((n) => {
                n.toggleClass('kl-hidden', hiddenClasses.has(n.data('classIri')));
            });
            cy.edges().forEach((e) => {
                e.toggleClass('kl-hidden', hiddenPredicates.has(e.data('predicate')));
            });
            cy.$('.kl-hidden:selected').unselect();
        });
        applyEdgeLabels(cy, edgeStyle);
        // Hidden boxes are no longer in the way
        applyRoutes(cy, edgeStyle);
    }, [hiddenClasses, hiddenPredicates]); // eslint-disable-line react-hooks/exhaustive-deps

    // Layout chosen in the toolbar
    useEffect(() => {
        if (appliedLayoutRef.current === layout) return;
        appliedLayoutRef.current = layout;
        runLayout(layout, true);
        callbacks.current.onPositionsChanged();
    }, [layout, runLayout]);

    useImperativeHandle(ref, () => ({
        fit: () => {
            const cy = cyRef.current;
            cy?.fit(cy.elements().not('.kl-hidden'), 40);
        },
        zoomIn: () => {
            const cy = cyRef.current;
            if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
        },
        zoomOut: () => {
            const cy = cyRef.current;
            if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
        },
        selectAndPanTo: (nodeId: string) => {
            const cy = cyRef.current;
            const node = cy?.getElementById(nodeId);
            if (!cy || !node || node.length === 0) return;
            cy.$(':selected').unselect();
            node.select();
            if (!node.hasClass('kl-hidden')) cy.animate({ center: { eles: node }, duration: 300 });
        },
        toggleSelect: (nodeId: string) => {
            const node = cyRef.current?.getElementById(nodeId);
            if (!node || node.length === 0) return;
            if (node.selected()) node.unselect();
            else node.select();
        },
        selectAllNodes: () => {
            cyRef.current?.nodes().not('.kl-hidden').select();
        },
        clearSelection: () => {
            cyRef.current?.$(':selected').unselect();
        },
        getNodePositions: () => {
            const positions: Record<string, { x: number; y: number }> = {};
            cyRef.current?.nodes().forEach((n) => {
                const p = n.position();
                positions[n.id()] = { x: Math.round(p.x), y: Math.round(p.y) };
            });
            return positions;
        },
    }), []);

    return (
        <div ref={wrapperRef} className="graph-viewport">
            <div ref={containerRef} className="graph-viewport-container" />
        </div>
    );
});
