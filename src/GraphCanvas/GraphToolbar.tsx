/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */
// Toolbar for Graph Canvas — layout selector, zoom controls, find input
// Top bar with grouped controls separated by vertical dividers

import React from 'react';
import { LayoutAlgorithm } from './types';

interface GraphToolbarProps {
    layout: LayoutAlgorithm;
    onLayoutChange: (layout: LayoutAlgorithm) => void;
    onFit: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    findQuery: string;
    onFindChange: (query: string) => void;
    nodeCount: number;
    edgeCount: number;
}

const LAYOUTS: { value: LayoutAlgorithm; label: string }[] = [
    { value: 'dagre', label: 'Dagre (hierarchical)' },
    { value: 'cose', label: 'CoSE (force-directed)' },
    { value: 'breadthfirst', label: 'Breadthfirst' },
    { value: 'circle', label: 'Circle' },
    { value: 'grid', label: 'Grid' },
];

export function GraphToolbar({
    layout,
    onLayoutChange,
    onFit,
    onZoomIn,
    onZoomOut,
    findQuery,
    onFindChange,
    nodeCount,
    edgeCount,
}: GraphToolbarProps): JSX.Element {
    return (
        <div className="graph-toolbar">
            <div className="graph-toolbar-group">
                <button className="graph-toolbar-btn" onClick={onFit} title="Fit graph to view">
                    &#x2922;
                </button>
                <button className="graph-toolbar-btn" onClick={onZoomIn} title="Zoom in">
                    +
                </button>
                <button className="graph-toolbar-btn" onClick={onZoomOut} title="Zoom out">
                    &minus;
                </button>
            </div>

            <div className="graph-toolbar-separator" />

            <div className="graph-toolbar-group">
                <span className="graph-toolbar-label">Layout:</span>
                <select
                    className="graph-toolbar-select"
                    value={layout}
                    onChange={(e) => onLayoutChange(e.target.value as LayoutAlgorithm)}
                >
                    {LAYOUTS.map((l) => (
                        <option key={l.value} value={l.value}>
                            {l.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="graph-toolbar-separator" />

            <div className="graph-toolbar-group">
                <input
                    className="graph-find-input"
                    type="text"
                    placeholder="Find node..."
                    value={findQuery}
                    onChange={(e) => onFindChange(e.target.value)}
                />
            </div>

            <span className="graph-toolbar-status">
                {nodeCount} nodes, {edgeCount} edges
            </span>
        </div>
    );
}
