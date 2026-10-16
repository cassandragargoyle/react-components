/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Right sidebar panel showing properties of selected node or edge
// Displays ID, type, label, custom properties, and connections

import React from 'react';
import { GraphNode, GraphEdge } from './types';

interface GraphPropertyPanelProps {
    selectedNode: GraphNode | null;
    selectedEdge: GraphEdge | null;
    incomingEdges: GraphEdge[];
    outgoingEdges: GraphEdge[];
    nodes: GraphNode[];
    onNodeClick: (nodeId: string) => void;
}

/** Color assigned to node types for the indicator dot */
function typeColor(type: string | undefined): string {
    if (!type) return '#858585';
    // Deterministic hue from type string
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
        hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 55%)`;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function GraphPropertyPanel({
    selectedNode,
    selectedEdge,
    incomingEdges,
    outgoingEdges,
    nodes,
    onNodeClick,
}: GraphPropertyPanelProps): JSX.Element {
    if (!selectedNode && !selectedEdge) {
        return (
            <div className="graph-property-panel">
                <div className="graph-property-panel-empty">
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
            <div className="graph-property-panel">
                <div className="graph-property-header">
                    <span
                        className="graph-property-dot"
                        style={{ background: typeColor(selectedEdge.type) }}
                    />
                    Edge: {selectedEdge.label || selectedEdge.id}
                </div>
                <div className="graph-property-section">
                    <div className="graph-property-row">
                        <span className="graph-property-key">ID</span>
                        <span className="graph-property-value">{selectedEdge.id}</span>
                    </div>
                    {selectedEdge.type && (
                        <div className="graph-property-row">
                            <span className="graph-property-key">Type</span>
                            <span className="graph-property-value">{selectedEdge.type}</span>
                        </div>
                    )}
                    {selectedEdge.label && (
                        <div className="graph-property-row">
                            <span className="graph-property-key">Label</span>
                            <span className="graph-property-value">{selectedEdge.label}</span>
                        </div>
                    )}
                    <div className="graph-property-row">
                        <span className="graph-property-key">Source</span>
                        <span
                            className="graph-property-value graph-property-connection"
                            onClick={() => onNodeClick(selectedEdge.source)}
                        >
                            {sourceNode?.label || selectedEdge.source}
                        </span>
                    </div>
                    <div className="graph-property-row">
                        <span className="graph-property-key">Target</span>
                        <span
                            className="graph-property-value graph-property-connection"
                            onClick={() => onNodeClick(selectedEdge.target)}
                        >
                            {targetNode?.label || selectedEdge.target}
                        </span>
                    </div>
                </div>
                {selectedEdge.properties && Object.keys(selectedEdge.properties).length > 0 && (
                    <div className="graph-property-section">
                        <div className="graph-property-section-title">Properties</div>
                        {Object.entries(selectedEdge.properties).map(([key, val]) => (
                            <div className="graph-property-row" key={key}>
                                <span className="graph-property-key">{key}</span>
                                <span className="graph-property-value">{formatValue(val)}</span>
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
        <div className="graph-property-panel">
            <div className="graph-property-header">
                <span
                    className="graph-property-dot"
                    style={{ background: typeColor(node.type) }}
                />
                Node: {node.label || node.id}
            </div>
            <div className="graph-property-section">
                <div className="graph-property-row">
                    <span className="graph-property-key">ID</span>
                    <span className="graph-property-value">{node.id}</span>
                </div>
                {node.type && (
                    <div className="graph-property-row">
                        <span className="graph-property-key">Type</span>
                        <span className="graph-property-value">{node.type}</span>
                    </div>
                )}
                {node.label && (
                    <div className="graph-property-row">
                        <span className="graph-property-key">Label</span>
                        <span className="graph-property-value">{node.label}</span>
                    </div>
                )}
            </div>
            {node.properties && Object.keys(node.properties).length > 0 && (
                <div className="graph-property-section">
                    <div className="graph-property-section-title">Properties</div>
                    {Object.entries(node.properties).map(([key, val]) => (
                        <div className="graph-property-row" key={key}>
                            <span className="graph-property-key">{key}</span>
                            <span className="graph-property-value">{formatValue(val)}</span>
                        </div>
                    ))}
                </div>
            )}
            {(outgoingEdges.length > 0 || incomingEdges.length > 0) && (
                <div className="graph-property-section">
                    <div className="graph-property-section-title">Connections</div>
                    {outgoingEdges.map((edge) => {
                        const target = nodeMap.get(edge.target);
                        return (
                            <div
                                key={edge.id}
                                className="graph-property-connection"
                                onClick={() => onNodeClick(edge.target)}
                            >
                                <span className="graph-property-connection-arrow">&rarr;</span>
                                {target?.label || edge.target}
                                {edge.label && (
                                    <span className="graph-property-connection-type">
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
                                className="graph-property-connection"
                                onClick={() => onNodeClick(edge.source)}
                            >
                                <span className="graph-property-connection-arrow">&larr;</span>
                                {source?.label || edge.source}
                                {edge.label && (
                                    <span className="graph-property-connection-type">
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
