/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Left overlay toolbar for the GraphLens 3D viewer
// Ports the original app.js panels: nav history, search, kind filters,
// visible-node count, line legend, and the statistics panel

import React from 'react';

/** One selectable kind filter (e.g. a VoX type or 'tag') */
export interface KindFilter {
    kind: string;
    color: string;
    enabled: boolean;
}

/** One key/value row in the statistics panel */
export interface StatRow {
    key: string;
    value: string | number;
}

interface GraphLensToolbarProps {
    // Nav history
    canBack: boolean;
    canForward: boolean;
    onBack: () => void;
    onForward: () => void;
    // Search
    query: string;
    onQueryChange: (value: string) => void;
    // Kind filters
    kinds: KindFilter[];
    onToggleKind: (kind: string) => void;
    // Visible count
    visibleCount: number;
    totalCount: number;
    // Line legend
    hasHubLinks: boolean;
    hasRelatedLinks: boolean;
    // Statistics
    statsTitle: string;
    stats: StatRow[];
}

export function GraphLensToolbar({
    canBack,
    canForward,
    onBack,
    onForward,
    query,
    onQueryChange,
    kinds,
    onToggleKind,
    visibleCount,
    totalCount,
    hasHubLinks,
    hasRelatedLinks,
    statsTitle,
    stats,
}: GraphLensToolbarProps): JSX.Element {
    return (
        <div className="graphlens-toolbar">
            <div className="graphlens-nav">
                <button
                    className="graphlens-nav-btn"
                    title="Previous selection"
                    disabled={!canBack}
                    onClick={onBack}
                >
                    &#9664;
                </button>
                <button
                    className="graphlens-nav-btn"
                    title="Next selection"
                    disabled={!canForward}
                    onClick={onForward}
                >
                    &#9654;
                </button>
            </div>

            <input
                className="graphlens-search"
                type="search"
                placeholder="Search nodes..."
                autoComplete="off"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
            />

            {kinds.length > 0 && (
                <div className="graphlens-filters">
                    {kinds.map((k) => (
                        <label className="graphlens-filter" key={k.kind}>
                            <input
                                type="checkbox"
                                checked={k.enabled}
                                onChange={() => onToggleKind(k.kind)}
                            />
                            <span className="graphlens-swatch" style={{ background: k.color }} />
                            {k.kind}
                        </label>
                    ))}
                </div>
            )}

            <div className="graphlens-filter-count">
                {visibleCount} / {totalCount} nodes
            </div>

            {(hasHubLinks || hasRelatedLinks) && (
                <div className="graphlens-legend">
                    <div className="graphlens-legend-title">Lines</div>
                    {hasHubLinks && (
                        <div className="graphlens-legend-row">
                            <svg width="30" height="12" aria-hidden="true">
                                <line x1="2" y1="6" x2="28" y2="6" stroke="#9aa4af" strokeWidth="2" />
                            </svg>
                            <span>hub &rarr; voice</span>
                        </div>
                    )}
                    {hasRelatedLinks && (
                        <div className="graphlens-legend-row">
                            <svg width="30" height="12" aria-hidden="true">
                                <path d="M2,10 Q15,0 28,10" fill="none" stroke="#fb923c" strokeWidth="2" />
                            </svg>
                            <span>related (voice &harr; voice)</span>
                        </div>
                    )}
                </div>
            )}

            <div className="graphlens-stats">
                <div className="graphlens-stats-title">{statsTitle}</div>
                {stats.map((row) => (
                    <div className="graphlens-stat-row" key={row.key}>
                        <span className="graphlens-stat-k">{row.key}</span>
                        <span className="graphlens-stat-v">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
