/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// React Flow wrapper component for rendering the interactive workflow graph
// Handles node rendering, edge creation, zoom, pan, selection, and drag

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
    ReactFlow,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    type OnNodeDrag,
    type NodeMouseHandler,
    type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TaskNode } from './nodes/TaskNode';
import { TriggerNode } from './nodes/TriggerNode';
import { GatewayNode } from './nodes/GatewayNode';
import { WorkflowNode, WorkflowEdge, SelectedElement } from './types';

const nodeTypes = {
    task: TaskNode,
    trigger: TriggerNode,
    gateway: GatewayNode,
};

export interface WorkflowViewportHandle {
    fitView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    selectAndPanTo: (nodeId: string) => void;
}

interface WorkflowViewportProps {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    onSelectionChange: (elements: SelectedElement[]) => void;
    onNodesChange: (nodes: WorkflowNode[]) => void;
    onEdgesChange: (edges: WorkflowEdge[]) => void;
    onNodeDragEnd: (nodeId: string, x: number, y: number) => void;
    onPaneDoubleClick: (x: number, y: number) => void;
}

/** Convert workflow node to React Flow node */
function toFlowNode(node: WorkflowNode): Node {
    return {
        id: node.id,
        type: node.type || 'task',
        position: node.position,
        data: { label: node.label || node.id, type: node.type },
        ...(node.size ? { style: { width: node.size.width, height: node.size.height } } : {}),
    };
}

/** Convert workflow edge to React Flow edge */
function toFlowEdge(edge: WorkflowEdge): Edge {
    return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: edge.type || 'default',
        style: { stroke: 'var(--vscode-foreground, #cccccc)', strokeOpacity: 0.5 },
        labelStyle: { fill: 'var(--vscode-foreground, #cccccc)', fontSize: 11 },
    };
}

/** Inner component with access to React Flow hooks */
const WorkflowViewportInner = forwardRef<WorkflowViewportHandle, WorkflowViewportProps>(
    function WorkflowViewportInner(
        { nodes: wfNodes, edges: wfEdges, onSelectionChange, onNodesChange, onEdgesChange, onNodeDragEnd, onPaneDoubleClick },
        ref
    ) {
        const reactFlow = useReactFlow();
        const selectionRef = useRef<Set<string>>(new Set());

        const initialNodes = useMemo(() => wfNodes.map(toFlowNode), [wfNodes]);
        const initialEdges = useMemo(() => wfEdges.map(toFlowEdge), [wfEdges]);

        const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
        const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

        // Sync external data changes into React Flow state, preserving selection
        React.useEffect(() => {
            const selected = selectionRef.current;
            setNodes(wfNodes.map((n) => {
                const flowNode = toFlowNode(n);
                if (selected.has(n.id)) {
                    flowNode.selected = true;
                }
                return flowNode;
            }));
        }, [wfNodes, setNodes]);

        React.useEffect(() => {
            setEdges(wfEdges.map(toFlowEdge));
        }, [wfEdges, setEdges]);

        // Handle new connections via drag-from-handle
        const onConnect = useCallback(
            (connection: Connection) => {
                const newEdge: Edge = {
                    ...connection,
                    id: `e-${connection.source}-${connection.sourceHandle || 'out'}-${connection.target}-${connection.targetHandle || 'in'}-${Date.now()}`,
                    style: { stroke: 'var(--vscode-foreground, #cccccc)', strokeOpacity: 0.5 },
                } as Edge;
                setEdges((eds) => addEdge(newEdge, eds));

                // Notify parent about new edge
                const wfEdge: WorkflowEdge = {
                    id: newEdge.id,
                    source: connection.source!,
                    sourceHandle: connection.sourceHandle || undefined,
                    target: connection.target!,
                    targetHandle: connection.targetHandle || undefined,
                };
                onEdgesChange([...wfEdges, wfEdge]);
            },
            [setEdges, wfEdges, onEdgesChange]
        );

        // Node click — select node, report to parent
        const handleNodeClick: NodeMouseHandler = useCallback(
            (event, node) => {
                const ctrlKey = event.ctrlKey || event.metaKey;
                if (ctrlKey) {
                    // Toggle selection
                    if (selectionRef.current.has(node.id)) {
                        selectionRef.current.delete(node.id);
                    } else {
                        selectionRef.current.add(node.id);
                    }
                } else {
                    selectionRef.current = new Set([node.id]);
                }
                const selected: SelectedElement[] = Array.from(selectionRef.current).map(
                    (id) => ({ type: 'node' as const, id })
                );
                onSelectionChange(selected);
            },
            [onSelectionChange]
        );

        // Edge click — select edge, report to parent
        const handleEdgeClick: EdgeMouseHandler = useCallback(
            (_event, edge) => {
                selectionRef.current = new Set();
                onSelectionChange([{ type: 'edge', id: edge.id }]);
            },
            [onSelectionChange]
        );

        // Pane click — deselect all
        const handlePaneClick = useCallback(() => {
            selectionRef.current = new Set();
            onSelectionChange([]);
        }, [onSelectionChange]);

        // Pane double-click — create new node at flow-space position
        const handlePaneDoubleClick = useCallback(
            (event: React.MouseEvent) => {
                const position = reactFlow.screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                onPaneDoubleClick(Math.round(position.x), Math.round(position.y));
            },
            [reactFlow, onPaneDoubleClick]
        );

        // Node drag end — report position
        const handleNodeDragStop: OnNodeDrag = useCallback(
            (_event, node) => {
                onNodeDragEnd(node.id, Math.round(node.position.x), Math.round(node.position.y));
            },
            [onNodeDragEnd]
        );

        // Delete handler — remove selected nodes and edges
        const onNodesDelete = useCallback(
            (deleted: Node[]) => {
                const deletedIds = new Set(deleted.map((n) => n.id));
                const remaining = wfNodes.filter((n) => !deletedIds.has(n.id));
                const remainingEdges = wfEdges.filter(
                    (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
                );
                onNodesChange(remaining);
                onEdgesChange(remainingEdges);
            },
            [wfNodes, wfEdges, onNodesChange, onEdgesChange]
        );

        const onEdgesDelete = useCallback(
            (deleted: Edge[]) => {
                const deletedIds = new Set(deleted.map((e) => e.id));
                onEdgesChange(wfEdges.filter((e) => !deletedIds.has(e.id)));
            },
            [wfEdges, onEdgesChange]
        );

        // Expose imperative methods
        useImperativeHandle(ref, () => ({
            fitView: () => reactFlow.fitView({ padding: 0.2, duration: 300 }),
            zoomIn: () => reactFlow.zoomIn({ duration: 200 }),
            zoomOut: () => reactFlow.zoomOut({ duration: 200 }),
            selectAndPanTo: (nodeId: string) => {
                const node = reactFlow.getNode(nodeId);
                if (!node) return;
                selectionRef.current = new Set([nodeId]);
                setNodes((nds) =>
                    nds.map((n) => ({ ...n, selected: n.id === nodeId }))
                );
                setEdges((eds) =>
                    eds.map((e) => ({ ...e, selected: false }))
                );
                onSelectionChange([{ type: 'node', id: nodeId }]);
                reactFlow.setCenter(
                    node.position.x + (node.width || 150) / 2,
                    node.position.y + (node.height || 40) / 2,
                    { duration: 300, zoom: reactFlow.getZoom() }
                );
            },
        }));

        return (
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                onDoubleClick={handlePaneDoubleClick}
                zoomOnDoubleClick={false}
                onNodeDragStop={handleNodeDragStop}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={4}
                deleteKeyCode={['Backspace', 'Delete']}
                multiSelectionKeyCode="Control"
                selectionOnDrag={false}
                proOptions={{ hideAttribution: true }}
                className="workflow-reactflow"
            >
                <Background gap={16} size={1} color="var(--vscode-editorIndentGuide-background, #404040)" />
                <MiniMap
                    nodeColor={() => 'var(--vscode-foreground, #cccccc)'}
                    maskColor="rgba(0, 0, 0, 0.6)"
                    style={{ background: 'var(--vscode-editor-background, #1e1e1e)' }}
                />
            </ReactFlow>
        );
    }
);

/** Wrapped component providing ReactFlowProvider context */
export const WorkflowViewport = forwardRef<WorkflowViewportHandle, WorkflowViewportProps>(
    function WorkflowViewport(props, ref) {
        return (
            <ReactFlowProvider>
                <WorkflowViewportInner ref={ref} {...props} />
            </ReactFlowProvider>
        );
    }
);
