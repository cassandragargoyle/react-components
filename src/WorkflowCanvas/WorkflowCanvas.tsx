/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Main Workflow Canvas component — three-panel layout with state management
// Orchestrates workflow viewport, property panel, node table, and toolbar

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { WorkflowViewport, WorkflowViewportHandle } from './WorkflowViewport';
import { WorkflowPropertyPanel } from './WorkflowPropertyPanel';
import { WorkflowNodeTable } from './WorkflowNodeTable';
import { WorkflowToolbar } from './WorkflowToolbar';
import {
    WorkflowFile,
    WorkflowNode,
    WorkflowEdge,
    SelectedElement,
    TableFilter,
} from './types';
import './WorkflowCanvas.css';

/** VS Code API interface injected into webview */
export interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

/** Acquire VS Code API — available only inside webview */
declare function acquireVsCodeApi(): VsCodeApi;

/** Props for hosting WorkflowCanvas outside a VS Code webview (e.g. the Electron viewer) */
export interface WorkflowCanvasProps {
    /** Message port to use instead of the global acquireVsCodeApi() (VS Code webview default) */
    api?: VsCodeApi;
}

const MAX_UNDO = 50;

export function WorkflowCanvas({ api }: WorkflowCanvasProps = {}): JSX.Element {
    const viewportRef = useRef<WorkflowViewportHandle>(null);
    const [vscodeApi] = useState<VsCodeApi>(() => api ?? acquireVsCodeApi());

    // Workflow data
    const [workflowData, setWorkflowData] = useState<WorkflowFile | null>(null);

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

    // Undo/redo stacks
    const undoStack = useRef<WorkflowFile[]>([]);
    const redoStack = useRef<WorkflowFile[]>([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Resize drag state
    const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

    /** Push current state to undo stack before making changes */
    const pushUndo = useCallback((data: WorkflowFile) => {
        undoStack.current.push(JSON.parse(JSON.stringify(data)));
        if (undoStack.current.length > MAX_UNDO) {
            undoStack.current.shift();
        }
        redoStack.current = [];
        setCanUndo(true);
        setCanRedo(false);
    }, []);

    /** Apply a workflow data change with undo tracking */
    const applyChange = useCallback((newData: WorkflowFile) => {
        setWorkflowData((prev) => {
            if (prev) pushUndo(prev);
            return newData;
        });
        vscodeApi.postMessage({ type: 'workflowDataChanged', data: newData });
    }, [pushUndo]);

    // Listen for messages from extension
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'setWorkflowData':
                    setWorkflowData(message.data as WorkflowFile);
                    undoStack.current = [];
                    redoStack.current = [];
                    setCanUndo(false);
                    setCanRedo(false);
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
        if (!findQuery || !workflowData || !viewportRef.current) return;
        const query = findQuery.toLowerCase();
        const match = workflowData.nodes.find(
            (n) => (n.label || n.id).toLowerCase().includes(query)
        );
        if (match) {
            viewportRef.current.selectAndPanTo(match.id);
        }
    }, [findQuery, workflowData]);

    // Undo
    const handleUndo = useCallback(() => {
        if (undoStack.current.length === 0) return;
        const prev = undoStack.current.pop()!;
        setWorkflowData((current) => {
            if (current) {
                redoStack.current.push(JSON.parse(JSON.stringify(current)));
            }
            return prev;
        });
        vscodeApi.postMessage({ type: 'workflowDataChanged', data: prev });
        setCanUndo(undoStack.current.length > 0);
        setCanRedo(true);
    }, []);

    // Redo
    const handleRedo = useCallback(() => {
        if (redoStack.current.length === 0) return;
        const next = redoStack.current.pop()!;
        setWorkflowData((current) => {
            if (current) {
                undoStack.current.push(JSON.parse(JSON.stringify(current)));
            }
            return next;
        });
        vscodeApi.postMessage({ type: 'workflowDataChanged', data: next });
        setCanUndo(true);
        setCanRedo(redoStack.current.length > 0);
    }, []);

    // Save — write workflow data back to file
    const handleSave = useCallback(() => {
        if (!workflowData) return;
        vscodeApi.postMessage({ type: 'requestSave', data: workflowData });
    }, [workflowData]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const input = document.querySelector<HTMLInputElement>('.workflow-find-input');
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
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSave, handleUndo, handleRedo]);

    // Selection change from viewport
    const handleSelectionChange = useCallback((elements: SelectedElement[]) => {
        setSelectedElements(elements);
        vscodeApi.postMessage({ type: 'selectionChanged', elements });
    }, []);

    // Node drag repositioning
    const handleNodeDragEnd = useCallback((nodeId: string, x: number, y: number) => {
        setWorkflowData((prev) => {
            if (!prev) return prev;
            if (prev) pushUndo(prev);
            const updated = {
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === nodeId ? { ...n, position: { x, y } } : n
                ),
            };
            vscodeApi.postMessage({ type: 'workflowDataChanged', data: updated });
            return updated;
        });
    }, [pushUndo]);

    // Nodes changed (deletion)
    const handleNodesChange = useCallback((newNodes: WorkflowNode[]) => {
        setWorkflowData((prev) => {
            if (!prev) return prev;
            if (prev) pushUndo(prev);
            const updated = { ...prev, nodes: newNodes };
            vscodeApi.postMessage({ type: 'workflowDataChanged', data: updated });
            return updated;
        });
    }, [pushUndo]);

    // Edges changed (creation/deletion)
    const handleEdgesChange = useCallback((newEdges: WorkflowEdge[]) => {
        setWorkflowData((prev) => {
            if (!prev) return prev;
            if (prev) pushUndo(prev);
            const updated = { ...prev, edges: newEdges };
            vscodeApi.postMessage({ type: 'workflowDataChanged', data: updated });
            return updated;
        });
    }, [pushUndo]);

    // Double-click on background — create new node at flow-space position
    const handlePaneDoubleClick = useCallback((x: number, y: number) => {
        setWorkflowData((prev) => {
            if (!prev) return prev;
            pushUndo(prev);
            const id = `node-${Date.now()}`;
            const newNode: WorkflowNode = {
                id,
                label: 'New Node',
                type: 'task',
                position: { x, y },
            };
            const updated = { ...prev, nodes: [...prev.nodes, newNode] };
            vscodeApi.postMessage({ type: 'workflowDataChanged', data: updated });
            return updated;
        });
    }, [pushUndo]);

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
    const selectedNode: WorkflowNode | null = useMemo(() => {
        const nodeEl = selectedElements.find((e) => e.type === 'node');
        if (!nodeEl || !workflowData) return null;
        return workflowData.nodes.find((n) => n.id === nodeEl.id) ?? null;
    }, [selectedElements, workflowData]);

    const selectedEdge: WorkflowEdge | null = useMemo(() => {
        const edgeEl = selectedElements.find((e) => e.type === 'edge');
        if (!edgeEl || !workflowData) return null;
        return workflowData.edges.find((e) => e.id === edgeEl.id) ?? null;
    }, [selectedElements, workflowData]);

    const incomingEdges = useMemo(() => {
        if (!selectedNode || !workflowData) return [];
        return workflowData.edges.filter((e) => e.target === selectedNode.id);
    }, [selectedNode, workflowData]);

    const outgoingEdges = useMemo(() => {
        if (!selectedNode || !workflowData) return [];
        return workflowData.edges.filter((e) => e.source === selectedNode.id);
    }, [selectedNode, workflowData]);

    if (!workflowData) {
        return (
            <div className="workflow-canvas">
                <div className="workflow-viewport-empty">Loading workflow data...</div>
            </div>
        );
    }

    return (
        <div className="workflow-canvas">
            <WorkflowToolbar
                onFit={() => viewportRef.current?.fitView()}
                onZoomIn={() => viewportRef.current?.zoomIn()}
                onZoomOut={() => viewportRef.current?.zoomOut()}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                findQuery={findQuery}
                onFindChange={setFindQuery}
                nodeCount={workflowData.nodes.length}
                edgeCount={workflowData.edges.length}
            />
            <div className="workflow-content">
                <div className="workflow-center">
                    <WorkflowViewport
                        ref={viewportRef}
                        nodes={workflowData.nodes}
                        edges={workflowData.edges}
                        onSelectionChange={handleSelectionChange}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={handleEdgesChange}
                        onNodeDragEnd={handleNodeDragEnd}
                        onPaneDoubleClick={handlePaneDoubleClick}
                    />
                    {!tableCollapsed && (
                        <div
                            className="workflow-resize-handle"
                            onMouseDown={handleResizeStart}
                        />
                    )}
                    <WorkflowNodeTable
                        nodes={workflowData.nodes}
                        selectedNodeIds={selectedNodeIds}
                        filter={tableFilter}
                        onFilterChange={setTableFilter}
                        onNodeClick={handleTableNodeClick}
                        height={tableHeight}
                        collapsed={tableCollapsed}
                        onCollapsedChange={setTableCollapsed}
                    />
                </div>
                <WorkflowPropertyPanel
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    incomingEdges={incomingEdges}
                    outgoingEdges={outgoingEdges}
                    nodes={workflowData.nodes}
                    onNodeClick={handlePropertyNodeClick}
                />
            </div>
        </div>
    );
}
