/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Cytoscape.js wrapper component for rendering the interactive graph
// Handles layout, zoom, pan, selection, and node drag repositioning

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import { GraphNode, GraphEdge, LayoutAlgorithm, SelectedElement } from './types';

// Register dagre layout extension
cytoscape.use(cytoscapeDagre);

export interface GraphViewportHandle {
    fit: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    selectAndPanTo: (nodeId: string) => void;
    applyLayout: (algorithm: LayoutAlgorithm) => void;
    getNodePositions: () => Map<string, { x: number; y: number }>;
}

interface GraphViewportProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
    layout: LayoutAlgorithm;
    onSelectionChange: (elements: SelectedElement[]) => void;
    onNodeDragEnd: (nodeId: string, x: number, y: number) => void;
}

/** Build Cytoscape stylesheet using VS Code theme-compatible colors */
function buildStylesheet(): cytoscape.StylesheetJsonBlock[] {
    return [
        {
            selector: 'node',
            style: {
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'background-color': '#4a9eff',
                'color': '#ffffff',
                'font-size': '11px',
                'text-wrap': 'ellipsis',
                'text-max-width': '80px',
                'width': 40,
                'height': 40,
                'border-width': 2,
                'border-color': '#3a7ecc',
                'text-outline-color': '#1e1e1e',
                'text-outline-width': 1,
            },
        },
        {
            selector: 'node[type = "database"]',
            style: {
                'shape': 'diamond',
                'background-color': '#e6994a',
                'border-color': '#cc8833',
            },
        },
        {
            selector: 'node[type = "network"]',
            style: {
                'shape': 'hexagon',
                'background-color': '#4ae699',
                'border-color': '#33cc77',
            },
        },
        {
            selector: 'node[type = "compute"]',
            style: {
                'shape': 'round-rectangle',
                'background-color': '#4a9eff',
                'border-color': '#3a7ecc',
            },
        },
        {
            selector: 'node:selected',
            style: {
                'border-width': 3,
                'border-color': '#75beff',
                'width': 48,
                'height': 48,
                'overlay-color': '#75beff',
                'overlay-opacity': 0.15,
            },
        },
        {
            selector: 'edge',
            style: {
                'width': 2,
                'line-color': '#555555',
                'target-arrow-color': '#555555',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '10px',
                'color': '#858585',
                'text-rotation': 'autorotate',
                'text-outline-color': '#1e1e1e',
                'text-outline-width': 1,
            },
        },
        {
            selector: 'edge[type = "dashed"]',
            style: {
                'line-style': 'dashed',
            },
        },
        {
            selector: 'edge:selected',
            style: {
                'width': 3,
                'line-color': '#75beff',
                'target-arrow-color': '#75beff',
                'overlay-color': '#75beff',
                'overlay-opacity': 0.15,
            },
        },
    ];
}

/** Map layout algorithm name to Cytoscape layout options */
function layoutOptions(algorithm: LayoutAlgorithm): cytoscape.LayoutOptions {
    const common = { animate: true, animationDuration: 300 };
    switch (algorithm) {
        case 'dagre':
            return { name: 'dagre', rankDir: 'TB', nodeSep: 50, rankSep: 80, ...common } as any;
        case 'cose':
            return { name: 'cose', idealEdgeLength: () => 100, nodeOverlap: 20, ...common };
        case 'breadthfirst':
            return { name: 'breadthfirst', spacingFactor: 1.5, directed: true, ...common };
        case 'circle':
            return { name: 'circle', spacingFactor: 1.2, ...common };
        case 'grid':
            return { name: 'grid', spacingFactor: 1.5, ...common };
    }
}

/** Build a structural fingerprint — only node/edge IDs, not positions */
function structuralKey(nodes: GraphNode[], edges: GraphEdge[]): string {
    const nk = nodes.map((n) => n.id).sort().join(',');
    const ek = edges.map((e) => `${e.source}-${e.target}`).sort().join(',');
    return `${nk}|${ek}`;
}

export const GraphViewport = forwardRef<GraphViewportHandle, GraphViewportProps>(
    function GraphViewport({ nodes, edges, layout, onSelectionChange, onNodeDragEnd }, ref) {
        const containerRef = useRef<HTMLDivElement>(null);
        const cyRef = useRef<Core | null>(null);
        const initialFitDone = useRef(false);
        const prevStructureRef = useRef('');

        // Initialize Cytoscape instance
        useEffect(() => {
            if (!containerRef.current) return;

            const cy = cytoscape({
                container: containerRef.current,
                style: buildStylesheet(),
                minZoom: 0.1,
                maxZoom: 5,
                wheelSensitivity: 0.3,
            });

            cyRef.current = cy;

            // Selection events
            const handleSelect = () => {
                const selected: SelectedElement[] = [];
                cy.$(':selected').forEach((ele) => {
                    selected.push({
                        type: ele.isNode() ? 'node' : 'edge',
                        id: ele.id(),
                    });
                });
                onSelectionChange(selected);
            };

            cy.on('select', handleSelect);
            cy.on('unselect', handleSelect);

            // Node drag end — report position without triggering re-layout
            cy.on('dragfree', 'node', (evt: EventObject) => {
                const node = evt.target as NodeSingular;
                const pos = node.position();
                onNodeDragEnd(node.id(), pos.x, pos.y);
            });

            // Double-click to center on node
            cy.on('dbltap', 'node', (evt: EventObject) => {
                const node = evt.target as NodeSingular;
                cy.animate({
                    center: { eles: node },
                    zoom: 2,
                    duration: 300,
                });
            });

            // Resize observer — only resize, fit only once on first valid size
            const ro = new ResizeObserver(() => {
                cy.resize();
                if (!initialFitDone.current && cy.nodes().length > 0) {
                    initialFitDone.current = true;
                    cy.fit(undefined, 40);
                }
            });
            ro.observe(containerRef.current);

            return () => {
                ro.disconnect();
                cy.destroy();
                cyRef.current = null;
            };
        }, []); // eslint-disable-line react-hooks/exhaustive-deps

        // Load graph data — only rebuild when structure changes (node/edge IDs)
        useEffect(() => {
            const cy = cyRef.current;
            if (!cy) return;

            const newStructure = structuralKey(nodes, edges);
            if (newStructure === prevStructureRef.current) {
                // Structure unchanged (position-only update from drag) — skip rebuild
                return;
            }
            prevStructureRef.current = newStructure;
            initialFitDone.current = false;

            cy.batch(() => {
                cy.elements().remove();

                for (const node of nodes) {
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: node.id,
                            label: node.label || node.id,
                            type: node.type || '',
                        },
                        position: node.position ? { x: node.position.x, y: node.position.y } : undefined,
                    });
                }

                for (const edge of edges) {
                    cy.add({
                        group: 'edges',
                        data: {
                            id: edge.id,
                            source: edge.source,
                            target: edge.target,
                            label: edge.label || '',
                            type: edge.type || '',
                        },
                    });
                }
            });

            cy.resize();

            // Run layout, then fit
            const opts = layoutOptions(layout);
            const layoutInstance = cy.layout(opts);
            layoutInstance.on('layoutstop', () => {
                cy.fit(undefined, 40);
                initialFitDone.current = true;
            });
            layoutInstance.run();
        }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

        // Apply layout when algorithm changes explicitly
        const applyLayout = useCallback((algorithm: LayoutAlgorithm) => {
            const cy = cyRef.current;
            if (!cy || cy.nodes().length === 0) return;
            const layoutInstance = cy.layout(layoutOptions(algorithm));
            layoutInstance.on('layoutstop', () => {
                cy.fit(undefined, 40);
            });
            layoutInstance.run();
        }, []);

        useEffect(() => {
            applyLayout(layout);
        }, [layout, applyLayout]);

        // Expose imperative methods
        useImperativeHandle(ref, () => ({
            fit: () => {
                cyRef.current?.fit(undefined, 40);
            },
            zoomIn: () => {
                const cy = cyRef.current;
                if (!cy) return;
                cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
            },
            zoomOut: () => {
                const cy = cyRef.current;
                if (!cy) return;
                cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
            },
            selectAndPanTo: (nodeId: string) => {
                const cy = cyRef.current;
                if (!cy) return;
                const node = cy.getElementById(nodeId);
                if (node.length === 0) return;
                cy.$(':selected').unselect();
                node.select();
                cy.animate({
                    center: { eles: node },
                    duration: 300,
                });
            },
            applyLayout,
            getNodePositions: () => {
                const cy = cyRef.current;
                const positions = new Map<string, { x: number; y: number }>();
                if (!cy) return positions;
                cy.nodes().forEach((n) => {
                    const pos = n.position();
                    positions.set(n.id(), { x: Math.round(pos.x), y: Math.round(pos.y) });
                });
                return positions;
            },
        }), [applyLayout]);

        return (
            <div className="graph-viewport">
                <div ref={containerRef} className="graph-viewport-container" />
            </div>
        );
    }
);
