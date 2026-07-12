/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Container component for the GraphLens 3D viewer — state, adjacency, selection
// Orchestrates the left toolbar, the 3D viewport, and the node/link detail panel

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { GraphLens3DViewport } from './GraphLens3DViewport';
import { GraphLensDetailPanel } from './GraphLensDetailPanel';
import { GraphLensNodeTable } from './GraphLensNodeTable';
import { GraphLensToolbar, KindFilter, StatRow } from './GraphLensToolbar';
import { ProgressPanel, ProgressPanelProps, ProgressStep } from '../Progress';
import { useRadialMenu } from '../RadialMenu';
import type { RadialMenuAction } from '../RadialMenu';
import { nodeIcons } from './nodeActionIcons';
import {
    GraphLensFile,
    GraphLensNode,
    GraphLensSelection,
    GraphLensStatus,
    GraphLensSource,
    GraphLensPhase,
    TableFilter,
    endId,
    linkKey,
    kindOf,
    kindColor,
} from './types';
import graphLensStyles from './GraphLens3D.css';

// Human-readable label for each data source / runtime
function sourceLabel(source: GraphLensSource): string {
    switch (source) {
        case 'electron':
            return 'Electron app (IPC bridge)';
        case 'webview':
            return 'VS Code webview (postMessage)';
        case 'standalone':
            return 'Standalone bundle (/data.json)';
        default:
            return 'Detecting runtime...';
    }
}

// Map the graphlens load status onto the generic ProgressPanel configuration
function loadingProps(status?: GraphLensStatus): ProgressPanelProps {
    const s = status ?? { source: 'unknown', phase: 'detecting', message: 'Loading graph data...' };
    const order: GraphLensPhase[] = ['detecting', 'connecting', 'receiving'];
    const labels: Record<GraphLensPhase, string> = {
        detecting: 'Detect runtime',
        connecting: 'Connect to data source',
        receiving: 'Receive & render document',
    };
    const active = order.indexOf(s.phase);
    const steps: ProgressStep[] = order.map((phase, i) => ({
        label: labels[phase],
        state: s.error && i === active ? 'error' : i < active ? 'done' : i === active ? 'active' : 'pending',
    }));
    return {
        title: 'GraphLens 3D',
        message: s.error ? 'Could not load the graph' : s.message,
        fields: [{ key: 'Source', value: sourceLabel(s.source) }],
        steps,
        error: s.error,
        hint: s.hint,
        spinner: 'orbit',
    };
}

// Format a free-form meta value for the search haystack
function valueToText(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

// Inject styles once when bundled with the 'text' loader (standalone single-file bundle).
// Under the 'css' loader (Electron/webview) the import resolves to a non-string and the
// stylesheet is emitted as a sibling file instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof graphLensStyles === 'string' &&
    graphLensStyles &&
    !document.getElementById('graphlens-3d-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'graphlens-3d-styles';
    styleEl.textContent = graphLensStyles;
    document.head.appendChild(styleEl);
}

export interface GraphLens3DProps {
    /** Graphlens document to render, or null while loading */
    data: GraphLensFile | null;
    /** Optional detailed load status shown (with progress + errors) until data arrives */
    status?: GraphLensStatus;
}

// Container for the GraphLens 3D viewer. Pure and prop-driven: the entry point owns
// data acquisition (IPC / fetch / postMessage) and passes the document in via `data`.
// It derives adjacency, manages selection + search/filter state, and lays out the
// left toolbar, the 3D viewport, and the detail panel. While `data` is null it shows
// the detailed loading screen.
export function GraphLens3D({ data, status }: GraphLens3DProps): JSX.Element {
    // Current node/link selection, or null when nothing is selected
    const [selection, setSelection] = useState<GraphLensSelection | null>(null);
    // Search query and per-kind filter toggles (a kind missing here is enabled)
    const [query, setQuery] = useState('');
    const [enabledKinds, setEnabledKinds] = useState<Record<string, boolean>>({});
    // Selection history for the back/forward buttons
    const [nav, setNav] = useState<{ history: string[]; cursor: number }>({ history: [], cursor: -1 });
    // Node table filter + resizable height
    const [tableFilter, setTableFilter] = useState<TableFilter>('all');
    const [tableHeight, setTableHeight] = useState(180);
    const [tableCollapsed, setTableCollapsed] = useState(false);
    const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

    // id -> node lookup
    const nodeById = useMemo(() => {
        const map = new Map<string, GraphLensNode>();
        if (data) for (const n of data.nodes) map.set(n.id, n);
        return map;
    }, [data]);

    // Precompute adjacency: degree per node and neighbor sets
    const adjacency = useMemo(() => {
        const degree = new Map<string, number>();
        const neighbors = new Map<string, Set<string>>();
        if (data) {
            for (const n of data.nodes) {
                degree.set(n.id, 0);
                neighbors.set(n.id, new Set());
            }
            for (const l of data.links) {
                const s = endId(l.source);
                const t = endId(l.target);
                degree.set(s, (degree.get(s) ?? 0) + 1);
                degree.set(t, (degree.get(t) ?? 0) + 1);
                if (!neighbors.has(s)) neighbors.set(s, new Set());
                if (!neighbors.has(t)) neighbors.set(t, new Set());
                neighbors.get(s)!.add(t);
                neighbors.get(t)!.add(s);
            }
        }
        return { degree, neighbors };
    }, [data]);

    // Stable accessor for a node's degree (number of connecting links), used for node sizing
    const degreeOf = useCallback((id: string) => adjacency.degree.get(id) ?? 0, [adjacency]);

    // Distinct kinds present + per-kind totals
    const { kindList, globalCounts } = useMemo(() => {
        const counts: Record<string, number> = {};
        if (data) for (const n of data.nodes) counts[kindOf(n)] = (counts[kindOf(n)] || 0) + 1;
        return { kindList: Object.keys(counts).sort(), globalCounts: counts };
    }, [data]);

    // Kind filter rows for the toolbar
    const kinds: KindFilter[] = useMemo(
        () => kindList.map((k) => ({ kind: k, color: kindColor(k), enabled: enabledKinds[k] !== false })),
        [kindList, enabledKinds]
    );

    // A node passes when its kind is enabled and (no query OR it matches the text)
    const isVisible = useCallback(
        (node: GraphLensNode) => {
            if (enabledKinds[kindOf(node)] === false) return false;
            if (query) {
                let hay = `${node.id} ${node.label || ''} ${node.title || ''}`;
                if (node.meta && node.meta.tags != null) hay += ' ' + valueToText(node.meta.tags);
                if (!hay.toLowerCase().includes(query.toLowerCase())) return false;
            }
            return true;
        },
        [enabledKinds, query]
    );

    // Key that changes whenever visibility changes — drives the viewport refresh + fit
    const visibilityKey = useMemo(() => {
        const off = Object.entries(enabledKinds)
            .filter(([, v]) => v === false)
            .map(([k]) => k)
            .sort()
            .join(',');
        return `${query}|${off}`;
    }, [query, enabledKinds]);

    const visibleCount = useMemo(
        () => (data ? data.nodes.filter(isVisible).length : 0),
        [data, isVisible]
    );

    // Nodes passing the current search + kind filters, for the node table (matches the 3D view)
    const visibleNodes = useMemo(() => (data ? data.nodes.filter(isVisible) : []), [data, isVisible]);

    // Which link styles are present, for the legend
    const { hasHubLinks, hasRelatedLinks } = useMemo(() => {
        let hub = false;
        let related = false;
        if (data) for (const l of data.links) (l.rel === 'related' ? (related = true) : (hub = true));
        return { hasHubLinks: hub, hasRelatedLinks: related };
    }, [data]);

    // Highlight sets derived from the current selection
    const { highlightNodes, highlightLinks } = useMemo(() => {
        const hn = new Set<string>();
        const hl = new Set<string>();
        if (selection && data) {
            if (selection.kind === 'node') {
                hn.add(selection.id);
                adjacency.neighbors.get(selection.id)?.forEach((nb) => hn.add(nb));
                for (const l of data.links) {
                    const s = endId(l.source);
                    const t = endId(l.target);
                    if (s === selection.id || t === selection.id) hl.add(linkKey(s, t));
                }
            } else {
                hn.add(selection.source);
                hn.add(selection.target);
                hl.add(linkKey(selection.source, selection.target));
            }
        }
        return { highlightNodes: hn, highlightLinks: hl };
    }, [selection, data, adjacency]);

    // Statistics: selected-node breakdown, or graph totals when nothing is selected
    const { statsTitle, stats } = useMemo(() => {
        if (data && selection?.kind === 'node') {
            const node = nodeById.get(selection.id);
            if (node) {
                const byKind: Record<string, number> = {};
                adjacency.neighbors.get(node.id)?.forEach((id) => {
                    const n = nodeById.get(id);
                    if (n) byKind[kindOf(n)] = (byKind[kindOf(n)] || 0) + 1;
                });
                const rows: StatRow[] = [
                    { key: 'id', value: node.id },
                    { key: 'kind', value: kindOf(node) },
                    { key: 'degree', value: adjacency.degree.get(node.id) ?? 0 },
                    ...Object.keys(byKind)
                        .sort()
                        .map((k) => ({ key: `${k} neighbors`, value: byKind[k] })),
                ];
                return { statsTitle: 'Selected node', stats: rows };
            }
        }
        const rows: StatRow[] = data
            ? [
                  { key: 'nodes', value: data.nodes.length },
                  { key: 'links', value: data.links.length },
                  ...kindList.map((k) => ({ key: k, value: globalCounts[k] })),
              ]
            : [];
        return { statsTitle: 'Graph totals', stats: rows };
    }, [data, selection, nodeById, adjacency, kindList, globalCounts]);

    // Select a node and record it in the navigation history
    const handleNodeClick = useCallback((id: string) => {
        setNav((prev) => {
            const base = prev.history.slice(0, prev.cursor + 1);
            const history = base[base.length - 1] === id ? base : [...base, id];
            return { history, cursor: history.length - 1 };
        });
        setSelection({ kind: 'node', id });
    }, []);

    // Select a link by its endpoints — fired by viewport link clicks (not recorded in history)
    const handleLinkClick = useCallback((source: string, target: string) => {
        setSelection({ kind: 'link', source, target });
    }, []);

    // Clear selection when the empty background is clicked (history is preserved)
    const handleBackgroundClick = useCallback(() => setSelection(null), []);

    const handleBack = useCallback(() => {
        setNav((prev) => {
            if (prev.cursor <= 0) return prev;
            const cursor = prev.cursor - 1;
            setSelection({ kind: 'node', id: prev.history[cursor] });
            return { ...prev, cursor };
        });
    }, []);

    const handleForward = useCallback(() => {
        setNav((prev) => {
            if (prev.cursor >= prev.history.length - 1) return prev;
            const cursor = prev.cursor + 1;
            setSelection({ kind: 'node', id: prev.history[cursor] });
            return { ...prev, cursor };
        });
    }, []);

    const handleToggleKind = useCallback((kind: string) => {
        setEnabledKinds((prev) => ({ ...prev, [kind]: prev[kind] === false }));
    }, []);

    // Show only the given kind by disabling every other kind present in the graph
    const handleIsolateKind = useCallback(
        (kind: string) => {
            setEnabledKinds(Object.fromEntries(kindList.map((k) => [k, k === kind])));
        },
        [kindList]
    );

    // Clear all filters — re-enable every kind and drop the search query
    const handleShowAll = useCallback(() => {
        setEnabledKinds({});
        setQuery('');
    }, []);

    // Radial node menu — opened on right-click / long-press, backed by the handlers above
    const radial = useRadialMenu();
    const openNodeMenu = useCallback(
        (id: string, clientX: number, clientY: number) => {
            const node = nodeById.get(id);
            const kind = node ? kindOf(node) : '';
            const canBack = nav.cursor > 0;
            const canForward = nav.cursor < nav.history.length - 1;
            const actions: RadialMenuAction[] = [
                {
                    id: 'isolate',
                    icon: nodeIcons.isolate,
                    label: 'Isolate',
                    tooltip: kind ? `Show only "${kind}" nodes` : 'Show only this kind',
                    disabled: !kind,
                    onSelect: () => handleIsolateKind(kind),
                },
                {
                    id: 'filter',
                    icon: nodeIcons.filter,
                    label: 'Filter',
                    tooltip: 'Filter the graph by this node',
                    children: [
                        {
                            id: 'hide',
                            icon: nodeIcons.hide,
                            label: 'Hide',
                            tooltip: kind ? `Hide "${kind}" nodes` : 'Hide this kind',
                            disabled: !kind,
                            onSelect: () => handleToggleKind(kind),
                        },
                        {
                            id: 'search',
                            icon: nodeIcons.search,
                            label: 'Search',
                            tooltip: kind ? `Search for "${kind}"` : 'Search for this kind',
                            disabled: !kind,
                            onSelect: () => setQuery(kind),
                        },
                        {
                            id: 'show-all',
                            icon: nodeIcons.showAll,
                            label: 'Show all',
                            tooltip: 'Clear all filters',
                            onSelect: handleShowAll,
                        },
                    ],
                },
                {
                    id: 'back',
                    icon: nodeIcons.back,
                    label: 'Back',
                    tooltip: 'Previous node',
                    disabled: !canBack,
                    onSelect: handleBack,
                },
                {
                    id: 'forward',
                    icon: nodeIcons.forward,
                    label: 'Forward',
                    tooltip: 'Next node',
                    disabled: !canForward,
                    onSelect: handleForward,
                },
            ];
            radial.open({
                position: { x: clientX, y: clientY },
                hub: {
                    id: 'focus',
                    icon: nodeIcons.focus,
                    label: 'Focus',
                    tooltip: node ? `Focus "${node.label || node.id}"` : 'Focus node',
                    onSelect: () => handleNodeClick(id),
                },
                actions,
            });
        },
        [
            nodeById,
            nav,
            radial,
            handleIsolateKind,
            handleToggleKind,
            handleShowAll,
            handleBack,
            handleForward,
            handleNodeClick,
        ]
    );

    // Resize handle for the node table, dragged along the vertical axis
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

    // No document yet — show the detailed loading screen (progress, source, errors)
    if (!data) {
        return (
            <div className="graphlens">
                <ProgressPanel {...loadingProps(status)} />
            </div>
        );
    }

    // Document title from meta, with a sensible fallback
    const title = data.meta?.title || 'GraphLens 3D';
    const selectedId = selection?.kind === 'node' ? selection.id : null;

    return (
        <div className="graphlens">
            <div className="graphlens-header">{title}</div>
            <div className="graphlens-content">
                <div className="graphlens-center">
                    <div className="graphlens-viewport-wrap">
                        <GraphLens3DViewport
                            nodes={data.nodes}
                            links={data.links}
                            degreeOf={degreeOf}
                            selectedId={selectedId}
                            highlightNodes={highlightNodes}
                            highlightLinks={highlightLinks}
                            isVisible={isVisible}
                            visibilityKey={visibilityKey}
                            onNodeClick={handleNodeClick}
                            onLinkClick={handleLinkClick}
                            onBackgroundClick={handleBackgroundClick}
                            onNodeContextMenu={openNodeMenu}
                        />
                        <GraphLensToolbar
                            canBack={nav.cursor > 0}
                            canForward={nav.cursor < nav.history.length - 1}
                            onBack={handleBack}
                            onForward={handleForward}
                            query={query}
                            onQueryChange={setQuery}
                            kinds={kinds}
                            onToggleKind={handleToggleKind}
                            visibleCount={visibleCount}
                            totalCount={data.nodes.length}
                            hasHubLinks={hasHubLinks}
                            hasRelatedLinks={hasRelatedLinks}
                            statsTitle={statsTitle}
                            stats={stats}
                        />
                    </div>
                    {!tableCollapsed && (
                        <div className="graphlens-resize-handle" onMouseDown={handleResizeStart} />
                    )}
                    <GraphLensNodeTable
                        nodes={visibleNodes}
                        selectedId={selectedId}
                        filter={tableFilter}
                        onFilterChange={setTableFilter}
                        onNodeClick={handleNodeClick}
                        degreeOf={degreeOf}
                        height={tableHeight}
                        collapsed={tableCollapsed}
                        onCollapsedChange={setTableCollapsed}
                    />
                </div>
                <GraphLensDetailPanel
                    selection={selection}
                    data={data}
                    degreeOf={degreeOf}
                    onNodeClick={handleNodeClick}
                />
            </div>
            {radial.menu}
        </div>
    );
}
