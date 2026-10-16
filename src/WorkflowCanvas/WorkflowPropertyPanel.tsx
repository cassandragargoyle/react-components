/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Right sidebar panel showing properties of selected workflow node or edge
// Displays ID, type, label, custom properties, and connections

import React, { type JSX } from 'react';
import { WorkflowNode, WorkflowEdge } from './types';

interface WorkflowPropertyPanelProps {
    selectedNode: WorkflowNode | null;
    selectedEdge: WorkflowEdge | null;
    incomingEdges: WorkflowEdge[];
    outgoingEdges: WorkflowEdge[];
    nodes: WorkflowNode[];
    onNodeClick: (nodeId: string) => void;
}

/** Color assigned to node types for the indicator dot */
function typeColor(type: string | undefined): string {
    if (!type) return '#858585';
    const typeColors: Record<string, string> = {
        task: '#4a9eff',
        trigger: '#4ae699',
        gateway: '#e6994a',
    };
    return typeColors[type] || '#858585';
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function WorkflowPropertyPanel({
    selectedNode,
    selectedEdge,
    incomingEdges,
    outgoingEdges,
    nodes,
    onNodeClick,
}: WorkflowPropertyPanelProps): JSX.Element {
    if (!selectedNode && !selectedEdge) {
        return (
            <div className="workflow-property-panel">
                <div className="workflow-property-panel-empty">
                    Click a node or edge to view properties
                </div>
            </div>
        );
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    if (selectedEdge) {
        const sourceNode = nodeMap.get(selectedEdge.source);
        const targetNode = nodeMap.get(selectedEdge.target);
        return (
            <div className="workflow-property-panel">
                <div className="workflow-property-header">
                    <span
                        className="workflow-property-dot"
                        style={{ background: '#858585' }}
                    />
                    Edge: {selectedEdge.label || selectedEdge.id}
                </div>
                <div className="workflow-property-section">
                    <div className="workflow-property-row">
                        <span className="workflow-property-key">ID</span>
                        <span className="workflow-property-value">{selectedEdge.id}</span>
                    </div>
                    {selectedEdge.type && (
                        <div className="workflow-property-row">
                            <span className="workflow-property-key">Type</span>
                            <span className="workflow-property-value">{selectedEdge.type}</span>
                        </div>
                    )}
                    {selectedEdge.label && (
                        <div className="workflow-property-row">
                            <span className="workflow-property-key">Label</span>
                            <span className="workflow-property-value">{selectedEdge.label}</span>
                        </div>
                    )}
                    <div className="workflow-property-row">
                        <span className="workflow-property-key">Source</span>
                        <span
                            className="workflow-property-value workflow-property-connection"
                            onClick={() => onNodeClick(selectedEdge.source)}
                        >
                            {sourceNode?.label || selectedEdge.source}
                        </span>
                    </div>
                    <div className="workflow-property-row">
                        <span className="workflow-property-key">Target</span>
                        <span
                            className="workflow-property-value workflow-property-connection"
                            onClick={() => onNodeClick(selectedEdge.target)}
                        >
                            {targetNode?.label || selectedEdge.target}
                        </span>
                    </div>
                </div>
                {selectedEdge.properties && Object.keys(selectedEdge.properties).length > 0 && (
                    <div className="workflow-property-section">
                        <div className="workflow-property-section-title">Properties</div>
                        {Object.entries(selectedEdge.properties).map(([key, val]) => (
                            <div className="workflow-property-row" key={key}>
                                <span className="workflow-property-key">{key}</span>
                                <span className="workflow-property-value">{formatValue(val)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Node selected
    const node = selectedNode!;
    return (
        <div className="workflow-property-panel">
            <div className="workflow-property-header">
                <span
                    className="workflow-property-dot"
                    style={{ background: typeColor(node.type) }}
                />
                Node: {node.label || node.id}
            </div>
            <div className="workflow-property-section">
                <div className="workflow-property-row">
                    <span className="workflow-property-key">ID</span>
                    <span className="workflow-property-value">{node.id}</span>
                </div>
                {node.type && (
                    <div className="workflow-property-row">
                        <span className="workflow-property-key">Type</span>
                        <span className="workflow-property-value">{node.type}</span>
                    </div>
                )}
                {node.label && (
                    <div className="workflow-property-row">
                        <span className="workflow-property-key">Label</span>
                        <span className="workflow-property-value">{node.label}</span>
                    </div>
                )}
                <div className="workflow-property-row">
                    <span className="workflow-property-key">Position</span>
                    <span className="workflow-property-value">
                        {node.position.x}, {node.position.y}
                    </span>
                </div>
            </div>
            {node.properties && Object.keys(node.properties).length > 0 && (
                <div className="workflow-property-section">
                    <div className="workflow-property-section-title">Properties</div>
                    {Object.entries(node.properties).map(([key, val]) => (
                        <div className="workflow-property-row" key={key}>
                            <span className="workflow-property-key">{key}</span>
                            <span className="workflow-property-value">{formatValue(val)}</span>
                        </div>
                    ))}
                </div>
            )}
            {(outgoingEdges.length > 0 || incomingEdges.length > 0) && (
                <div className="workflow-property-section">
                    <div className="workflow-property-section-title">Connections</div>
                    {outgoingEdges.map((edge) => {
                        const target = nodeMap.get(edge.target);
                        return (
                            <div
                                key={edge.id}
                                className="workflow-property-connection"
                                onClick={() => onNodeClick(edge.target)}
                            >
                                <span className="workflow-property-connection-arrow">&rarr;</span>
                                {target?.label || edge.target}
                                {edge.label && (
                                    <span className="workflow-property-connection-type">
                                        ({edge.label})
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {incomingEdges.map((edge) => {
                        const source = nodeMap.get(edge.source);
                        return (
                            <div
                                key={edge.id}
                                className="workflow-property-connection"
                                onClick={() => onNodeClick(edge.source)}
                            >
                                <span className="workflow-property-connection-arrow">&larr;</span>
                                {source?.label || edge.source}
                                {edge.label && (
                                    <span className="workflow-property-connection-type">
                                        ({edge.label})
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
