/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Main Graph Canvas component — three-panel layout with state management
// Orchestrates graph viewport, property panel, node table, and toolbar

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GraphViewport, GraphViewportHandle } from './GraphViewport';
import { GraphPropertyPanel } from './GraphPropertyPanel';
import { GraphNodeTable } from './GraphNodeTable';
import { GraphToolbar } from './GraphToolbar';
import {
    GraphFile,
    GraphNode,
    GraphEdge,
    LayoutAlgorithm,
    SelectedElement,
    TableFilter,
} from './types';
import './GraphCanvas.css';

/** VS Code API interface injected into webview */
export interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

/** Acquire VS Code API — available only inside webview */
declare function acquireVsCodeApi(): VsCodeApi;

/** Props for hosting GraphCanvas outside a VS Code webview (e.g. the Electron viewer) */
export interface GraphCanvasProps {
    /** Message port to use instead of the global acquireVsCodeApi() (VS Code webview default) */
    api?: VsCodeApi;
}

export function GraphCanvas({ api }: GraphCanvasProps = {}): JSX.Element {
    const viewportRef = useRef<GraphViewportHandle>(null);
    const [vscodeApi] = useState<VsCodeApi>(() => api ?? acquireVsCodeApi());

    // Graph data
    const [graphData, setGraphData] = useState<GraphFile | null>(null);
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
                    setGraphData(message.data as GraphFile);
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
        vscodeApi.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handler);
    }, []);

    // Find handler — auto-select and pan to matching node
    useEffect(() => {
        if (!findQuery || !graphData || !viewportRef.current) return;
        const query = findQuery.toLowerCase();
        const match = graphData.nodes.find(
            (n) => (n.label || n.id).toLowerCase().includes(query)
        );
        if (match) {
            viewportRef.current.selectAndPanTo(match.id);
        }
    }, [findQuery, graphData]);

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
        vscodeApi.postMessage({
            type: 'selectionChanged',
            elements,
        });
    }, []);

    // Node drag repositioning
    const handleNodeDragEnd = useCallback((nodeId: string, x: number, y: number) => {
        setGraphData((prev) => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === nodeId ? { ...n, position: { x: Math.round(x), y: Math.round(y) } } : n
                ),
            };
            vscodeApi.postMessage({ type: 'graphDataChanged', data: updated });
            return updated;
        });
    }, []);

    // Table node click — select and pan in graph
    const handleTableNodeClick = useCallback((nodeId: string, ctrlKey: boolean) => {
        if (ctrlKey) {
            setSelectedElements((prev) => {
                const exists = prev.find((e) => e.id === nodeId && e.type === 'node');
                if (exists) {
                    return prev.filter((e) => !(e.id === nodeId && e.type === 'node'));
                }
                return [...prev, { type: 'node', id: nodeId }];
            });
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
        const updated: GraphFile = {
            ...graphData,
            nodes: graphData.nodes.map((n) => {
                const pos = positions.get(n.id);
                return pos ? { ...n, position: pos } : n;
            }),
        };
        setGraphData(updated);
        vscodeApi.postMessage({ type: 'requestSave', data: updated });
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
