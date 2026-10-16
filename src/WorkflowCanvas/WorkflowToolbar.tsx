/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Toolbar for Workflow Canvas — zoom controls, undo/redo, find input, status
// Top bar with grouped controls separated by vertical dividers

import React, { type JSX } from 'react';

interface WorkflowToolbarProps {
    onFit: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    findQuery: string;
    onFindChange: (query: string) => void;
    nodeCount: number;
    edgeCount: number;
}

export function WorkflowToolbar({
    onFit,
    onZoomIn,
    onZoomOut,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    findQuery,
    onFindChange,
    nodeCount,
    edgeCount,
}: WorkflowToolbarProps): JSX.Element {
    return (
        <div className="workflow-toolbar">
            <div className="workflow-toolbar-group">
                <button className="workflow-toolbar-btn" onClick={onFit} title="Fit to view">
                    &#x2922;
                </button>
                <button className="workflow-toolbar-btn" onClick={onZoomIn} title="Zoom in">
                    +
                </button>
                <button className="workflow-toolbar-btn" onClick={onZoomOut} title="Zoom out">
                    &minus;
                </button>
            </div>

            <div className="workflow-toolbar-separator" />

            <div className="workflow-toolbar-group">
                <button
                    className="workflow-toolbar-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                >
                    &#x21B6;
                </button>
                <button
                    className="workflow-toolbar-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    &#x21B7;
                </button>
            </div>

            <div className="workflow-toolbar-separator" />

            <div className="workflow-toolbar-group">
                <input
                    className="workflow-find-input"
                    type="text"
                    placeholder="Find node..."
                    value={findQuery}
                    onChange={(e) => onFindChange(e.target.value)}
                />
            </div>

            <span className="workflow-toolbar-status">
                {nodeCount} nodes, {edgeCount} edges
            </span>
        </div>
    );
}
