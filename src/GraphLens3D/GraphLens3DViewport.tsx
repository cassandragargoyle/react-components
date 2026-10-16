/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// 3d-force-graph mount and interaction layer for the GraphLens 3D viewer
// Sizes nodes by degree, colors by kind, highlights neighbors, filters by
// visibility (search + kind filters), and focuses the camera on selection

import React, { useRef, useEffect } from 'react';
import ForceGraph3D from '3d-force-graph';
import {
    GraphLensNode,
    GraphLensLink,
    endId,
    linkKey,
    nodeKindColor,
    HUB_LINK_COLOR,
    RELATED_LINK_COLOR,
} from './types';

interface GraphLens3DViewportProps {
    nodes: GraphLensNode[];
    links: GraphLensLink[];
    degreeOf: (id: string) => number;
    selectedId: string | null;
    highlightNodes: Set<string>;
    highlightLinks: Set<string>;
    /** Whether a node passes the current search + kind filters */
    isVisible: (node: GraphLensNode) => boolean;
    /** Changes whenever the visibility predicate changes — triggers refresh + fit */
    visibilityKey: string;
    onNodeClick: (id: string) => void;
    onLinkClick: (source: string, target: string) => void;
    onBackgroundClick: () => void;
    /** Right-click (desktop) or long-press (touch) on a node — opens the radial menu there */
    onNodeContextMenu?: (id: string, clientX: number, clientY: number) => void;
}

// Long-press gesture tuning for touch (mouse uses the native right-click instead)
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOL = 10;

const BACKGROUND = '#1e1e1e';
const SELECTED_NODE = '#ffffff';
const DIM_NODE = '#2a2f37';
const HIGHLIGHT_LINK = '#ffd166';
const DIM_LINK = '#22262d';

export function GraphLens3DViewport(props: GraphLens3DViewportProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null);

    // Keep latest props available to the stable accessors without re-creating the graph
    const propsRef = useRef(props);
    propsRef.current = props;

    // id -> node, for resolving link endpoints to nodes during visibility checks
    const nodeByIdRef = useRef<Map<string, GraphLensNode>>(new Map());

    // Node currently under the pointer (from onNodeHover) — the long-press target on touch
    const hoveredNodeRef = useRef<string | null>(null);

    // Create the 3d-force-graph instance once
    useEffect(() => {
        if (!containerRef.current) return;

        const graph = ForceGraph3D()(containerRef.current);
        graphRef.current = graph;

        const resolve = (endpoint: unknown): GraphLensNode | undefined =>
            nodeByIdRef.current.get(endId(endpoint));

        const degreeVal = (n: any): number => propsRef.current.degreeOf(endId(n.id)) + 1;

        const nodeColorOf = (n: any): string => {
            const p = propsRef.current;
            if (!p.selectedId) return nodeKindColor(n);
            if (endId(n.id) === p.selectedId) return SELECTED_NODE;
            return p.highlightNodes.has(endId(n.id)) ? nodeKindColor(n) : DIM_NODE;
        };

        const linkColorOf = (l: any): string => {
            const p = propsRef.current;
            if (p.selectedId) {
                return p.highlightLinks.has(linkKey(l.source, l.target)) ? HIGHLIGHT_LINK : DIM_LINK;
            }
            return l.rel === 'related' ? RELATED_LINK_COLOR : HUB_LINK_COLOR;
        };

        const linkWidthOf = (l: any): number => {
            const p = propsRef.current;
            return p.selectedId && p.highlightLinks.has(linkKey(l.source, l.target)) ? 1.2 : 0;
        };

        // Curve "related" voice-to-voice links into arcs so they read distinctly
        const linkCurvatureOf = (l: any): number => (l.rel === 'related' ? 0.3 : 0);

        const nodeVisibilityOf = (n: any): boolean => propsRef.current.isVisible(n);
        const linkVisibilityOf = (l: any): boolean => {
            const s = resolve(l.source);
            const t = resolve(l.target);
            return (!s || propsRef.current.isVisible(s)) && (!t || propsRef.current.isVisible(t));
        };

        graph
            .backgroundColor(BACKGROUND)
            .nodeId('id')
            .nodeLabel((n: any) => String(n.title || n.label || n.id))
            .nodeRelSize(4)
            .nodeVal(degreeVal)
            .nodeColor(nodeColorOf)
            .nodeOpacity(0.92)
            .nodeVisibility(nodeVisibilityOf)
            .linkColor(linkColorOf)
            .linkWidth(linkWidthOf)
            .linkCurvature(linkCurvatureOf)
            .linkOpacity(0.5)
            .linkVisibility(linkVisibilityOf)
            .linkLabel((l: any) => String(l.description || ''))
            .onNodeClick((n: any) => propsRef.current.onNodeClick(endId(n.id)))
            .onNodeHover((n: any) => {
                hoveredNodeRef.current = n ? endId(n.id) : null;
            })
            .onNodeRightClick((n: any, event: MouseEvent) => {
                event.preventDefault();
                propsRef.current.onNodeContextMenu?.(endId(n.id), event.clientX, event.clientY);
            })
            .onLinkClick((l: any) => propsRef.current.onLinkClick(endId(l.source), endId(l.target)))
            .onBackgroundClick(() => propsRef.current.onBackgroundClick());

        // Suppress the native context menu so the radial menu is the only one shown
        const onContextMenu = (e: Event) => e.preventDefault();
        containerRef.current.addEventListener('contextmenu', onContextMenu);

        // Long-press → open the radial menu on the hovered node (touch/pen; mouse uses right-click)
        let pressTimer: ReturnType<typeof setTimeout> | null = null;
        let startX = 0;
        let startY = 0;
        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };
        const onPointerDown = (e: PointerEvent) => {
            if (e.pointerType === 'mouse') return;
            startX = e.clientX;
            startY = e.clientY;
            clearPress();
            pressTimer = setTimeout(() => {
                const id = hoveredNodeRef.current;
                if (id) propsRef.current.onNodeContextMenu?.(id, startX, startY);
            }, LONG_PRESS_MS);
        };
        const onPointerMove = (e: PointerEvent) => {
            if (
                pressTimer &&
                (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_TOL ||
                    Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_TOL)
            ) {
                clearPress(); // moved too far — treat as a pan/scroll, not an open
            }
        };
        const el = containerRef.current;
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', clearPress);
        el.addEventListener('pointercancel', clearPress);

        const resize = () => {
            const el = containerRef.current;
            if (!el) return;
            graph.width(el.clientWidth).height(el.clientHeight);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            clearPress();
            el.removeEventListener('contextmenu', onContextMenu);
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', clearPress);
            el.removeEventListener('pointercancel', clearPress);
            graph._destructor?.();
            graphRef.current = null;
        };
    }, []);

    // Load graph data when nodes/links change — clone so the engine mutates copies, not props
    useEffect(() => {
        const graph = graphRef.current;
        if (!graph) return;
        nodeByIdRef.current = new Map(props.nodes.map((n) => [n.id, n]));
        graph.graphData({
            nodes: props.nodes.map((n) => ({ ...n })),
            links: props.links.map((l) => ({ ...l })),
        });
    }, [props.nodes, props.links]);

    // Re-apply visual accessors when selection/highlight changes
    useEffect(() => {
        const graph = graphRef.current;
        if (!graph) return;
        graph.nodeColor(graph.nodeColor());
        graph.linkColor(graph.linkColor());
        graph.linkWidth(graph.linkWidth());
    }, [props.selectedId, props.highlightNodes, props.highlightLinks]);

    // Re-evaluate visibility and fit the visible subset when search/filters change
    useEffect(() => {
        const graph = graphRef.current;
        if (!graph) return;
        graph.nodeVisibility(graph.nodeVisibility()).linkVisibility(graph.linkVisibility());
        const anyVisible = props.nodes.some((n) => props.isVisible(n));
        if (anyVisible) {
            graph.zoomToFit(700, 60, (n: any) => propsRef.current.isVisible(n));
        }
    }, [props.visibilityKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Focus the camera on the selected node
    useEffect(() => {
        const graph = graphRef.current;
        if (!graph || !props.selectedId) return;
        const node = (graph.graphData().nodes || []).find((n: any) => endId(n.id) === props.selectedId);
        if (!node) return;
        const dist = 120;
        const hyp = Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        const ratio = hyp > 0 ? 1 + dist / hyp : 1;
        graph.cameraPosition(
            { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
            node,
            800
        );
    }, [props.selectedId]);

    return <div ref={containerRef} className="graphlens-viewport" />;
}
