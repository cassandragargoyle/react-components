/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Right sidebar panel showing details of the selected node or link
// Ports showDetail (node) and showLinkDetail (link) from the original app.js

import React from 'react';
import {
    GraphLensDocument,
    GraphLensSelection,
    endId,
    nodeKindColor,
} from './types';

interface GraphLensDetailPanelProps {
    selection: GraphLensSelection | null;
    data: GraphLensDocument;
    degreeOf: (id: string) => number;
    onNodeClick: (id: string) => void;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function GraphLensDetailPanel({
    selection,
    data,
    degreeOf,
    onNodeClick,
}: GraphLensDetailPanelProps): JSX.Element {
    if (!selection) {
        return (
            <div className="graphlens-detail">
                <div className="graphlens-detail-empty">
                    Click a node or link to view details
                </div>
            </div>
        );
    }

    // Link selected — port of showLinkDetail
    if (selection.kind === 'link') {
        const link = data.links.find(
            (l) => endId(l.source) === selection.source && endId(l.target) === selection.target
        );
        const sourceNode = data.nodes.find((n) => n.id === selection.source);
        const targetNode = data.nodes.find((n) => n.id === selection.target);
        return (
            <div className="graphlens-detail">
                <div className="graphlens-detail-header">
                    <span className="graphlens-detail-badge" style={{ background: '#858585' }} />
                    Link
                </div>
                <div className="graphlens-detail-section">
                    <div className="graphlens-detail-row">
                        <span className="graphlens-detail-key">Source</span>
                        <span
                            className="graphlens-detail-value graphlens-detail-link"
                            onClick={() => onNodeClick(selection.source)}
                        >
                            {sourceNode?.label || selection.source}
                        </span>
                    </div>
                    <div className="graphlens-detail-row">
                        <span className="graphlens-detail-key">Target</span>
                        <span
                            className="graphlens-detail-value graphlens-detail-link"
                            onClick={() => onNodeClick(selection.target)}
                        >
                            {targetNode?.label || selection.target}
                        </span>
                    </div>
                    {link?.rel && (
                        <div className="graphlens-detail-row">
                            <span className="graphlens-detail-key">Relation</span>
                            <span className="graphlens-detail-value">{link.rel}</span>
                        </div>
                    )}
                </div>
                {link?.description && (
                    <div className="graphlens-detail-section">
                        <div className="graphlens-detail-section-title">Description</div>
                        <div className="graphlens-detail-text">{link.description}</div>
                    </div>
                )}
            </div>
        );
    }

    // Node selected — port of showDetail
    const node = data.nodes.find((n) => n.id === selection.id);
    if (!node) {
        return (
            <div className="graphlens-detail">
                <div className="graphlens-detail-empty">Node not found</div>
            </div>
        );
    }

    const isTag = node.type === 'tag';
    const neighbors = data.links
        .map((l) => {
            const s = endId(l.source);
            const t = endId(l.target);
            if (s === node.id) return t;
            if (t === node.id) return s;
            return null;
        })
        .filter((x): x is string => x !== null);
    const uniqueNeighbors = Array.from(new Set(neighbors));

    return (
        <div className="graphlens-detail">
            <div className="graphlens-detail-header">
                <span
                    className="graphlens-detail-badge"
                    style={{ background: nodeKindColor(node) }}
                />
                {node.label || node.id}
            </div>
            <div className="graphlens-detail-section">
                <div className="graphlens-detail-row">
                    <span className="graphlens-detail-key">ID</span>
                    <span className="graphlens-detail-value">{node.id}</span>
                </div>
                {node.type && (
                    <div className="graphlens-detail-row">
                        <span className="graphlens-detail-key">Type</span>
                        <span className="graphlens-detail-value">{node.type}</span>
                    </div>
                )}
                {node.voice && (
                    <div className="graphlens-detail-row">
                        <span className="graphlens-detail-key">Voice</span>
                        <span className="graphlens-detail-value">{node.voice}</span>
                    </div>
                )}
                {isTag && (
                    <div className="graphlens-detail-row">
                        <span className="graphlens-detail-key">Connections</span>
                        <span className="graphlens-detail-value">{degreeOf(node.id)}</span>
                    </div>
                )}
            </div>
            {node.title && (
                <div className="graphlens-detail-section">
                    <div className="graphlens-detail-section-title">Title</div>
                    <div className="graphlens-detail-text">{node.title}</div>
                </div>
            )}
            {node.description && (
                <div className="graphlens-detail-section">
                    <div className="graphlens-detail-section-title">Description</div>
                    <div className="graphlens-detail-text">{node.description}</div>
                </div>
            )}
            {node.meta && Object.keys(node.meta).length > 0 && (
                <div className="graphlens-detail-section">
                    <div className="graphlens-detail-section-title">Meta</div>
                    {Object.entries(node.meta).map(([key, val]) => (
                        <div className="graphlens-detail-row" key={key}>
                            <span className="graphlens-detail-key">{key}</span>
                            <span className="graphlens-detail-value">{formatValue(val)}</span>
                        </div>
                    ))}
                </div>
            )}
            {uniqueNeighbors.length > 0 && (
                <div className="graphlens-detail-section">
                    <div className="graphlens-detail-section-title">
                        Connections ({uniqueNeighbors.length})
                    </div>
                    {uniqueNeighbors.map((id) => {
                        const nb = data.nodes.find((n) => n.id === id);
                        return (
                            <div
                                key={id}
                                className="graphlens-detail-connection"
                                onClick={() => onNodeClick(id)}
                            >
                                <span className="graphlens-detail-connection-arrow">&rarr;</span>
                                {nb?.label || id}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
