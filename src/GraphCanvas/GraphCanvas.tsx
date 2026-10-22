/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Main Graph Canvas component — three-panel layout with state management
// Orchestrates graph viewport, property panel, node table, and toolbar

import React, { type JSX, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GraphViewport, GraphViewportHandle } from './GraphViewport';
import { GraphPropertyPanel } from './GraphPropertyPanel';
import { GraphNodeTable } from './GraphNodeTable';
import { GraphToolbar } from './GraphToolbar';
import {
    GraphDocument,
    GraphNode,
    GraphEdge,
    LayoutAlgorithm,
    SelectedElement,
    TableFilter,
} from './types';
import graphCanvasStyles from './GraphCanvas.css';

// Inject styles once when bundled with the 'text' loader (single-file bundle, the
// published package). Under the 'css' loader the import resolves to a non-string and
// a sibling stylesheet is emitted instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof graphCanvasStyles === 'string' &&
    graphCanvasStyles &&
    !document.getElementById('graph-canvas-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'graph-canvas-styles';
    styleEl.textContent = graphCanvasStyles;
    document.head.appendChild(styleEl);
}

/** Message port the canvas posts its events to; a VS Code webview API satisfies it */
export interface GraphCanvasPort {
    postMessage(message: unknown): void;
}

/** Props for GraphCanvas; the host binds the port, the canvas never looks one up itself */
export interface GraphCanvasProps {
    /** Where the canvas posts ready, selection, change and save messages */
    api: GraphCanvasPort;
}

/** Whether a key event comes from a text field, where Ctrl+A keeps its usual meaning */
function isTextEntry(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function GraphCanvas({ api }: GraphCanvasProps): JSX.Element {
    const viewportRef = useRef<GraphViewportHandle>(null);
    // First port wins, like the previous one-time acquisition; a new prop does not rewire listeners
    const [port] = useState<GraphCanvasPort>(() => api);

    // Graph data
    const [graphData, setGraphData] = useState<GraphDocument | null>(null);
    const [layout, setLayout] = useState<LayoutAlgorithm>('dagre');

    // Selection state
    const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
    const selectedNodeIds = useMemo(
        () => new Set(selectedElements.filter((e) => e.type === 'node').map((e) => e.id)),
        [selectedElements]
    );

    // Table state
    const [tableFilter, setTableFilter] = useState<TableFilter>('all');
    const [tableHeight, setTableHeight] = useState(180);
    const [tableCollapsed, setTableCollapsed] = useState(false);

    // Find state
    const [findQuery, setFindQuery] = useState('');

    // Resize drag state
    const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

    // Listen for messages from extension
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'setGraphData':
                    setGraphData(message.data as GraphDocument);
                    break;
                case 'selectNode':
                    if (viewportRef.current && message.ids?.length > 0) {
                        viewportRef.current.selectAndPanTo(message.ids[0]);
                    }
                    break;
            }
        };
        window.addEventListener('message', handler);

        // Signal readiness
        port.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handler);
    }, []);

    // Find handler — auto-select and pan to matching node; only a new query pans,
    // so dragging a node while a query is typed does not jump back to the match
    useEffect(() => {
        if (!findQuery || !graphData || !viewportRef.current) return;
        const query = findQuery.toLowerCase();
        const match = graphData.nodes.find(
            (n) => (n.label || n.id).toLowerCase().includes(query)
        );
        if (match) {
            viewportRef.current.selectAndPanTo(match.id);
        }
    }, [findQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const input = document.querySelector<HTMLInputElement>('.graph-find-input');
                input?.focus();
            }
            if (e.key === 'Escape') {
                setFindQuery('');
                setSelectedElements([]);
                viewportRef.current?.clearSelection();
            }
            if (e.key === 'a' && (e.ctrlKey || e.metaKey) && !isTextEntry(e.target)) {
                e.preventDefault();
                viewportRef.current?.selectAllNodes();
            }
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Selection change from viewport
    const handleSelectionChange = useCallback((elements: SelectedElement[]) => {
        setSelectedElements(elements);
        port.postMessage({
            type: 'selectionChanged',
            elements,
        });
    }, []);

    // Node drag repositioning — records every node's position, so the whole arrangement
    // is restored on reopen instead of the layout algorithm running over it
    const handleNodeDragEnd = useCallback((nodeId: string, x: number, y: number) => {
        const positions = viewportRef.current?.getNodePositions() ?? new Map<string, { x: number; y: number }>();
        positions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
        setGraphData((prev) => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                nodes: prev.nodes.map((n) => {
                    const pos = positions.get(n.id);
                    return pos ? { ...n, position: pos } : n;
                }),
            };
            port.postMessage({ type: 'graphDataChanged', data: updated });
            return updated;
        });
    }, []);

    // Table node click — select and pan in graph
    const handleTableNodeClick = useCallback((nodeId: string, ctrlKey: boolean) => {
        if (ctrlKey) {
            // Toggle in the graph; its selection events update the state and the table
            viewportRef.current?.toggleSelect(nodeId);
        } else {
            viewportRef.current?.selectAndPanTo(nodeId);
        }
    }, []);

    // Property panel connection click
    const handlePropertyNodeClick = useCallback((nodeId: string) => {
        viewportRef.current?.selectAndPanTo(nodeId);
    }, []);

    // Layout change
    const handleLayoutChange = useCallback((newLayout: LayoutAlgorithm) => {
        setLayout(newLayout);
    }, []);

    // Save — write positions back to file
    const handleSave = useCallback(() => {
        if (!graphData || !viewportRef.current) return;
        const positions = viewportRef.current.getNodePositions();
        const updated: GraphDocument = {
            ...graphData,
            nodes: graphData.nodes.map((n) => {
                const pos = positions.get(n.id);
                return pos ? { ...n, position: pos } : n;
            }),
        };
        setGraphData(updated);
        port.postMessage({ type: 'requestSave', data: updated });
    }, [graphData]);

    // Resize handle for table
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizeRef.current = { startY: e.clientY, startHeight: tableHeight };

        const handleMove = (ev: MouseEvent) => {
            if (!resizeRef.current) return;
            const delta = resizeRef.current.startY - ev.clientY;
            const newHeight = Math.max(80, Math.min(500, resizeRef.current.startHeight + delta));
            setTableHeight(newHeight);
        };

        const handleUp = () => {
            resizeRef.current = null;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [tableHeight]);

    // Derived state for property panel
    const selectedNode: GraphNode | null = useMemo(() => {
        const nodeEl = selectedElements.find((e) => e.type === 'node');
        if (!nodeEl || !graphData) return null;
        return graphData.nodes.find((n) => n.id === nodeEl.id) ?? null;
    }, [selectedElements, graphData]);

    const selectedEdge: GraphEdge | null = useMemo(() => {
        const edgeEl = selectedElements.find((e) => e.type === 'edge');
        if (!edgeEl || !graphData) return null;
        return graphData.edges.find((e) => e.id === edgeEl.id) ?? null;
    }, [selectedElements, graphData]);

    const incomingEdges = useMemo(() => {
        if (!selectedNode || !graphData) return [];
        return graphData.edges.filter((e) => e.target === selectedNode.id);
    }, [selectedNode, graphData]);

    const outgoingEdges = useMemo(() => {
        if (!selectedNode || !graphData) return [];
        return graphData.edges.filter((e) => e.source === selectedNode.id);
    }, [selectedNode, graphData]);

    if (!graphData) {
        return (
            <div className="graph-canvas">
                <div className="graph-viewport-empty">Loading graph data...</div>
            </div>
        );
    }

    return (
        <div className="graph-canvas">
            <GraphToolbar
                layout={layout}
                onLayoutChange={handleLayoutChange}
                onFit={() => viewportRef.current?.fit()}
                onZoomIn={() => viewportRef.current?.zoomIn()}
                onZoomOut={() => viewportRef.current?.zoomOut()}
                findQuery={findQuery}
                onFindChange={setFindQuery}
                nodeCount={graphData.nodes.length}
                edgeCount={graphData.edges.length}
            />
            <div className="graph-content">
                <div className="graph-center">
                    <GraphViewport
                        ref={viewportRef}
                        nodes={graphData.nodes}
                        edges={graphData.edges}
                        layout={layout}
                        onSelectionChange={handleSelectionChange}
                        onNodeDragEnd={handleNodeDragEnd}
                    />
                    {!tableCollapsed && (
                        <div
                            className="graph-resize-handle"
                            onMouseDown={handleResizeStart}
                        />
                    )}
                    <GraphNodeTable
                        nodes={graphData.nodes}
                        selectedNodeIds={selectedNodeIds}
                        filter={tableFilter}
                        onFilterChange={setTableFilter}
                        onNodeClick={handleTableNodeClick}
                        height={tableHeight}
                        collapsed={tableCollapsed}
                        onCollapsedChange={setTableCollapsed}
                    />
                </div>
                <GraphPropertyPanel
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    incomingEdges={incomingEdges}
                    outgoingEdges={outgoingEdges}
                    nodes={graphData.nodes}
                    onNodeClick={handlePropertyNodeClick}
                />
            </div>
        </div>
    );
}
