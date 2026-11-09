/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Toolbar of KnowledgeLens: zoom and fit, layout, title language, find, saving the view
// and the counts of the visible nodes and edges

import React, { type JSX } from 'react';
import type { KnowledgeLayoutAlgorithm } from './types';

interface KnowledgeToolbarProps {
    layout: KnowledgeLayoutAlgorithm;
    onLayoutChange: (layout: KnowledgeLayoutAlgorithm) => void;
    language: string;
    languages: string[];
    onLanguageChange: (language: string) => void;
    onFit: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    findQuery: string;
    onFindChange: (query: string) => void;
    /** Show the Save button; a host that cannot write the layout file leaves it out */
    canSave: boolean;
    dirty: boolean;
    onSave: () => void;
    nodeCount: number;
    edgeCount: number;
}

const LAYOUTS: { value: KnowledgeLayoutAlgorithm; label: string }[] = [
    { value: 'dagre', label: 'Dagre (hierarchical)' },
    { value: 'cose', label: 'CoSE (force-directed)' },
    { value: 'breadthfirst', label: 'Breadthfirst' },
];

export function KnowledgeToolbar({
    layout,
    onLayoutChange,
    language,
    languages,
    onLanguageChange,
    onFit,
    onZoomIn,
    onZoomOut,
    findQuery,
    onFindChange,
    canSave,
    dirty,
    onSave,
    nodeCount,
    edgeCount,
}: KnowledgeToolbarProps): JSX.Element {
    const languageOptions = language && !languages.includes(language) ? [language, ...languages] : languages;
    return (
        <div className="graph-toolbar" role="toolbar" aria-label="Knowledge graph toolbar">
            <div className="graph-toolbar-group">
                <button type="button" className="graph-toolbar-btn" onClick={onFit} title="Fit graph to view" aria-label="Fit graph to view">
                    &#x2922;
                </button>
                <button type="button" className="graph-toolbar-btn" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
                    +
                </button>
                <button type="button" className="graph-toolbar-btn" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
                    &minus;
                </button>
            </div>

            <div className="graph-toolbar-separator" />

            <div className="graph-toolbar-group">
                <label className="graph-toolbar-label" htmlFor="knowledge-lens-layout">Layout:</label>
                <select
                    id="knowledge-lens-layout"
                    className="graph-toolbar-select"
                    value={layout}
                    onChange={(e) => onLayoutChange(e.target.value as KnowledgeLayoutAlgorithm)}
                >
                    {LAYOUTS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                </select>
            </div>

            {languageOptions.length > 0 && (
                <>
                    <div className="graph-toolbar-separator" />
                    <div className="graph-toolbar-group">
                        <label className="graph-toolbar-label" htmlFor="knowledge-lens-language">Language:</label>
                        <select
                            id="knowledge-lens-language"
                            className="graph-toolbar-select"
                            value={language}
                            onChange={(e) => onLanguageChange(e.target.value)}
                        >
                            {languageOptions.map((l) => (
                                <option key={l} value={l}>{l}</option>
                            ))}
                        </select>
                    </div>
                </>
            )}

            <div className="graph-toolbar-separator" />

            <div className="graph-toolbar-group">
                <input
                    className="graph-find-input knowledge-lens-find"
                    type="text"
                    placeholder="Find node..."
                    aria-label="Find node"
                    value={findQuery}
                    onChange={(e) => onFindChange(e.target.value)}
                />
            </div>

            {canSave && (
                <>
                    <div className="graph-toolbar-separator" />
                    <div className="graph-toolbar-group">
                        <button
                            type="button"
                            className="graph-toolbar-btn knowledge-lens-save"
                            onClick={onSave}
                            disabled={!dirty}
                            title={dirty ? 'Save the layout next to the file (Ctrl+S)' : 'The layout is saved'}
                        >
                            Save
                        </button>
                    </div>
                </>
            )}

            <span className="graph-toolbar-status">
                {nodeCount} nodes · {edgeCount} edges
            </span>
        </div>
    );
}
