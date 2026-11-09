/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// KnowledgeLens: read-only viewer of a Turtle document as a knowledge graph
// Parses the text, projects it, and lays out toolbar, panels, viewport and node table

import React, { type JSX, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TableFilter } from '../NodeTablePanel';
import graphCanvasStyles from '../GraphCanvas/GraphCanvas.css';
import knowledgeLensStyles from './KnowledgeLens.css';
import { defaultEdgeStyle, KnowledgeViewport, type KnowledgeViewportHandle } from './KnowledgeViewport';
import { clampPanelWidth, DEFAULT_PANEL_WIDTH, PanelSplitter } from './PanelSplitter';
import { KnowledgeToolbar } from './KnowledgeToolbar';
import { ClassSwatch, KnowledgeSidePanel } from './KnowledgeSidePanel';
import { KnowledgePropertyPanel } from './KnowledgePropertyPanel';
import { KnowledgeNodeTable } from './KnowledgeNodeTable';
import { parseTurtle } from './parseTurtle';
import { defaultSubtitleAttributes, projectGraph } from './projectGraph';
import { createIriShortener } from './iri';
import { classPalette, resolveKnowledgeTheme, type KnowledgeTheme } from './palette';
import type {
    KnowledgeEdgeStyle,
    KnowledgeLayoutAlgorithm,
    KnowledgeLensHostMessage,
    KnowledgeLensLayout,
    KnowledgeLensOptions,
    KnowledgeSelectedElement,
    TurtleParseResult,
} from './types';

// Inject the styles once under the 'text' loader; the GraphCanvas sheet gives the shared
// toolbar, property panel and splitter classes, this one adds the KnowledgeLens parts
for (const [id, css] of [
    ['graph-canvas-styles', graphCanvasStyles],
    ['knowledge-lens-styles', knowledgeLensStyles],
] as const) {
    if (typeof document !== 'undefined' && typeof css === 'string' && css && !document.getElementById(id)) {
        const styleEl = document.createElement('style');
        styleEl.id = id;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }
}

/** Message port the component posts to; a VS Code webview API satisfies it */
export interface KnowledgeLensPort {
    postMessage(message: unknown): void;
}

export interface KnowledgeLensProps {
    /** Where ready, selection, open-link and save messages go */
    api: KnowledgeLensPort;
    /** Show the Save button; the host then answers `requestSave` by writing the layout file */
    canSave?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

interface LoadedDocument {
    text: string;
    fileName: string;
    options: KnowledgeLensOptions;
    layout: KnowledgeLensLayout | null;
}

/** Whether a key event comes from a text field, where Ctrl+A keeps its usual meaning */
function isTextEntry(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Primary subtag of the editor language, e.g. `cs` from `cs-CZ` */
function primaryLanguage(tag: string | undefined): string {
    return (tag ?? '').split('-')[0].toLowerCase();
}

const toggle = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
};

export function KnowledgeLens({ api, canSave = false, className, style }: KnowledgeLensProps): JSX.Element {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<KnowledgeViewportHandle>(null);
    const [port] = useState<KnowledgeLensPort>(() => api);

    const [doc, setDoc] = useState<LoadedDocument | null>(null);
    const [parsed, setParsed] = useState<TurtleParseResult | null>(null);
    const [theme, setTheme] = useState<KnowledgeTheme>(() => resolveKnowledgeTheme(null));

    // View state, restored from the layout file
    const [layout, setLayout] = useState<KnowledgeLayoutAlgorithm>('dagre');
    // Null follows the layout: orthogonal for dagre, straight for the others
    const [edgeStyleChoice, setEdgeStyleChoice] = useState<KnowledgeEdgeStyle | null>(null);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const [language, setLanguage] = useState('');
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());
    const [hiddenPredicates, setHiddenPredicates] = useState<Set<string>>(new Set());
    const [subtitleChoice, setSubtitleChoice] = useState<string[] | null>(null);
    const [storedPositions, setStoredPositions] = useState<Record<string, { x: number; y: number }> | undefined>();
    const [dirty, setDirty] = useState(false);
    const appliedLayoutRef = useRef<string>('');

    const [selected, setSelected] = useState<KnowledgeSelectedElement[]>([]);
    const [findQuery, setFindQuery] = useState('');
    const [tableFilter, setTableFilter] = useState<TableFilter>('all');
    const [tableHeight, setTableHeight] = useState(180);
    const [tableCollapsed, setTableCollapsed] = useState(false);

    // Host messages
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data as KnowledgeLensHostMessage;
            if (!message || typeof message !== 'object') return;
            switch (message.type) {
                case 'setTurtleData': {
                    const saved = message.layout ?? null;
                    setDoc({ text: message.text, fileName: message.fileName, options: message.options ?? {}, layout: saved });
                    // A layout file is applied when it changes, so a reload keeps unsaved toggles
                    const key = JSON.stringify(saved);
                    if (key !== appliedLayoutRef.current) {
                        appliedLayoutRef.current = key;
                        setLayout(saved?.layout ?? 'dagre');
                        setEdgeStyleChoice(saved?.edgeStyle ?? null);
                        setPanelWidth(clampPanelWidth(saved?.propertyPanelWidth ?? DEFAULT_PANEL_WIDTH));
                        setLanguage(saved?.language ?? primaryLanguage(message.options?.language ?? (typeof navigator !== 'undefined' ? navigator.language : '')));
                        setHiddenClasses(new Set(saved?.hiddenClasses ?? []));
                        setHiddenPredicates(new Set(saved?.hiddenPredicates ?? []));
                        setSubtitleChoice(saved?.subtitleAttributes ?? null);
                        setStoredPositions(saved?.positions);
                        setDirty(false);
                    }
                    break;
                }
                case 'selectNode':
                    if (message.ids?.length) viewportRef.current?.selectAndPanTo(message.ids[0]);
                    break;
                case 'layoutSaved':
                    setDirty(false);
                    break;
            }
        };
        window.addEventListener('message', handler);
        port.postMessage({ type: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Parse after the loading state has painted, so a large file does not freeze the first frame
    useEffect(() => {
        if (!doc) return;
        setParsed(null);
        const timer = setTimeout(() => setParsed(parseTurtle(doc.text)), 0);
        return () => clearTimeout(timer);
    }, [doc?.text]); // eslint-disable-line react-hooks/exhaustive-deps

    // Theme: read the VS Code variables now and whenever the body theme class changes
    useLayoutEffect(() => {
        const update = () => setTheme((prev) => {
            const next = resolveKnowledgeTheme(rootRef.current);
            return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
        update();
        if (typeof MutationObserver === 'undefined') return;
        const observer = new MutationObserver(update);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        return () => observer.disconnect();
    }, [parsed]);

    const graph = useMemo(() => {
        if (!parsed?.ok || !doc) return null;
        return projectGraph(parsed.triples, {
            prefixes: parsed.prefixes,
            base: parsed.base,
            language,
            palette: classPalette(theme.mode),
            classStyles: doc.options.classStyles,
            flagPredicates: doc.options.flagPredicates,
            nodeLimit: doc.options.nodeLimit,
        });
    }, [parsed, doc, language, theme.mode]);

    const shortener = useMemo(
        () => createIriShortener(parsed?.ok ? parsed.prefixes : {}, parsed?.ok ? parsed.base : undefined),
        [parsed]
    );
    const shortIri = useCallback((iri: string) => shortener.short(iri), [shortener]);

    const defaultSubtitles = useMemo(() => (graph ? defaultSubtitleAttributes(graph) : []), [graph?.nodes]); // eslint-disable-line react-hooks/exhaustive-deps
    const subtitleAttributes = subtitleChoice ?? defaultSubtitles;
    const nodesById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);
    const classesByIri = useMemo(() => new Map((graph?.classes ?? []).map((c) => [c.iri, c])), [graph]);
    const attributeColumns = useMemo(
        () => subtitleAttributes.map((iri) => graph?.attributes.find((a) => a.iri === iri)).filter((a) => a !== undefined),
        [subtitleAttributes, graph]
    );
    const selectedNodeIds = useMemo(() => new Set(selected.filter((e) => e.type === 'node').map((e) => e.id)), [selected]);

    const visibleNodes = useMemo(() => (graph?.nodes ?? []).filter((n) => !hiddenClasses.has(n.classIri)), [graph, hiddenClasses]);
    const visibleEdgeCount = useMemo(() => {
        if (!graph) return 0;
        const visible = new Set(visibleNodes.map((n) => n.id));
        return graph.edges.filter((e) => !hiddenPredicates.has(e.predicate) && visible.has(e.source) && visible.has(e.target)).length;
    }, [graph, visibleNodes, hiddenPredicates]);

    const markDirty = useCallback(() => setDirty(true), []);

    const handleSave = useCallback(() => {
        if (!canSave || !viewportRef.current) return;
        const saved: KnowledgeLensLayout = {
            version: 1,
            layout,
            edgeStyle: edgeStyleChoice ?? undefined,
            propertyPanelWidth: panelWidth,
            language: language || undefined,
            hiddenClasses: [...hiddenClasses],
            hiddenPredicates: [...hiddenPredicates],
            subtitleAttributes: subtitleChoice ?? undefined,
            positions: viewportRef.current.getNodePositions(),
        };
        appliedLayoutRef.current = JSON.stringify(saved);
        setStoredPositions(saved.positions);
        port.postMessage({ type: 'requestSave', layout: saved });
        setDirty(false);
    }, [canSave, layout, edgeStyleChoice, panelWidth, language, hiddenClasses, hiddenPredicates, subtitleChoice, port]);

    const handleSelectionChange = useCallback((elements: KnowledgeSelectedElement[]) => {
        setSelected(elements);
        port.postMessage({ type: 'selectionChanged', elements });
    }, [port]);

    const selectNode = useCallback((id: string) => viewportRef.current?.selectAndPanTo(id), []);
    const openExternal = useCallback((iri: string) => port.postMessage({ type: 'openExternal', iri }), [port]);

    // Find: select the first node whose title or IRI matches; only a new query pans
    useEffect(() => {
        if (!findQuery || !graph) return;
        const q = findQuery.toLowerCase();
        const match = graph.nodes.find((n) => !hiddenClasses.has(n.classIri)
            && (n.title.toLowerCase().includes(q) || n.short.toLowerCase().includes(q)));
        if (match) viewportRef.current?.selectAndPanTo(match.id);
    }, [findQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (e.key === 'f' && mod) {
                e.preventDefault();
                rootRef.current?.querySelector<HTMLInputElement>('.knowledge-lens-find')?.focus();
            } else if (e.key === 'Escape') {
                setFindQuery('');
                viewportRef.current?.clearSelection();
            } else if (e.key === 'a' && mod && !isTextEntry(e.target)) {
                e.preventDefault();
                viewportRef.current?.selectAllNodes();
            } else if (e.key === 's' && mod && canSave) {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [canSave, handleSave]);

    // Splitter between viewport and table
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = tableHeight;
        const move = (ev: MouseEvent) => setTableHeight(Math.max(80, Math.min(500, startHeight + startY - ev.clientY)));
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }, [tableHeight]);

    const edgeStyle = edgeStyleChoice ?? defaultEdgeStyle(layout);
    const handlePanelWidth = useCallback((width: number) => {
        setPanelWidth(width);
        setDirty(true);
    }, []);

    const rootClass = `knowledge-lens${className ? ` ${className}` : ''}`;

    if (!doc || !parsed) {
        return (
            <div ref={rootRef} className={rootClass} style={style}>
                <div className="graph-viewport-empty">{doc ? `Parsing ${doc.fileName}...` : 'Loading knowledge graph...'}</div>
            </div>
        );
    }

    if (!parsed.ok) {
        const { line, column, message } = parsed.error;
        return (
            <div ref={rootRef} className={rootClass} style={style}>
                <div className="knowledge-lens-error" role="alert">
                    <div className="knowledge-lens-error-title">Turtle syntax error</div>
                    <div className="knowledge-lens-error-location">
                        {doc.fileName}
                        {line > 0 && `:${line}`}
                        {line > 0 && column > 0 && `:${column}`}
                    </div>
                    <div className="knowledge-lens-error-message">{message}</div>
                    <div className="knowledge-lens-error-hint">Fix the file and save it; the graph reloads by itself.</div>
                </div>
            </div>
        );
    }

    if (!graph) return <div ref={rootRef} className={rootClass} style={style} />;

    const selectedNode = selected.find((e) => e.type === 'node');
    const selectedEdge = selected.find((e) => e.type === 'edge');
    const legendClasses = graph.classes.filter((c) => !hiddenClasses.has(c.iri));

    return (
        <div ref={rootRef} className={rootClass} style={style}>
            <KnowledgeToolbar
                layout={layout}
                onLayoutChange={(l) => {
                    setLayout(l);
                    setDirty(true);
                }}
                edgeStyle={edgeStyle}
                onEdgeStyleChange={(style) => {
                    setEdgeStyleChoice(style);
                    setDirty(true);
                }}
                language={language}
                languages={graph.languages}
                onLanguageChange={(l) => {
                    setLanguage(l);
                    setDirty(true);
                }}
                onFit={() => viewportRef.current?.fit()}
                onZoomIn={() => viewportRef.current?.zoomIn()}
                onZoomOut={() => viewportRef.current?.zoomOut()}
                findQuery={findQuery}
                onFindChange={setFindQuery}
                canSave={canSave}
                dirty={dirty}
                onSave={handleSave}
                nodeCount={visibleNodes.length}
                edgeCount={visibleEdgeCount}
            />
            <div className="graph-content">
                <KnowledgeSidePanel
                    classes={graph.classes}
                    predicates={graph.predicates}
                    attributes={graph.attributes}
                    flags={graph.flags}
                    hiddenClasses={hiddenClasses}
                    hiddenPredicates={hiddenPredicates}
                    subtitleAttributes={subtitleAttributes}
                    onToggleClass={(iri) => {
                        setHiddenClasses((s) => toggle(s, iri));
                        setDirty(true);
                    }}
                    onTogglePredicate={(iri) => {
                        setHiddenPredicates((s) => toggle(s, iri));
                        setDirty(true);
                    }}
                    onToggleSubtitle={(iri) => {
                        const current = subtitleAttributes;
                        setSubtitleChoice(current.includes(iri) ? current.filter((p) => p !== iri) : [...current, iri]);
                        setDirty(true);
                    }}
                    shortIri={shortIri}
                />
                <div className="graph-center">
                    <div className="knowledge-lens-stage">
                        <div className="knowledge-lens-header">
                            <span className="knowledge-lens-header-title">{graph.header.title ?? doc.fileName}</span>
                            {graph.header.source && (
                                <button type="button" className="knowledge-lens-link" onClick={() => openExternal(graph.header.source!)} title={graph.header.source}>
                                    {shortIri(graph.header.source)}
                                </button>
                            )}
                        </div>
                        {graph.truncated && (
                            <div className="knowledge-lens-warning" role="status">
                                Showing the first {graph.nodes.length} of {graph.totalNodes} nodes.
                            </div>
                        )}
                        <KnowledgeViewport
                            ref={viewportRef}
                            graph={graph}
                            theme={theme}
                            subtitleAttributes={subtitleAttributes}
                            hiddenClasses={hiddenClasses}
                            hiddenPredicates={hiddenPredicates}
                            layout={layout}
                            edgeStyle={edgeStyle}
                            storedPositions={storedPositions}
                            onSelectionChange={handleSelectionChange}
                            onPositionsChanged={markDirty}
                        />
                        {(legendClasses.length > 0 || graph.flags.length > 0) && (
                            <div className="knowledge-lens-legend" aria-label="Legend">
                                {legendClasses.map((c) => (
                                    <span key={c.iri || 'untyped'} className="knowledge-lens-legend-item">
                                        <ClassSwatch fill={c.style.fill} border={c.style.border} />
                                        {c.name}
                                    </span>
                                ))}
                                {graph.flags.map((f) => (
                                    <span key={f.iri} className="knowledge-lens-legend-item">
                                        <ClassSwatch fill="transparent" border={theme.subtleText} dashed />
                                        {f.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {!tableCollapsed && <div className="graph-resize-handle" onMouseDown={handleResizeStart} />}
                    <KnowledgeNodeTable
                        nodes={visibleNodes}
                        classesByIri={classesByIri}
                        attributeColumns={attributeColumns}
                        selectedNodeIds={selectedNodeIds}
                        filter={tableFilter}
                        onFilterChange={setTableFilter}
                        onNodeClick={(id, ctrl) => (ctrl ? viewportRef.current?.toggleSelect(id) : selectNode(id))}
                        height={tableHeight}
                        collapsed={tableCollapsed}
                        onCollapsedChange={setTableCollapsed}
                    />
                </div>
                <PanelSplitter width={panelWidth} onWidthChange={handlePanelWidth} label="properties panel" />
                <KnowledgePropertyPanel
                    width={panelWidth}
                    node={selectedNode ? nodesById.get(selectedNode.id) ?? null : null}
                    edge={selectedEdge ? graph.edges.find((e) => e.id === selectedEdge.id) ?? null : null}
                    nodesById={nodesById}
                    classesByIri={classesByIri}
                    edges={graph.edges}
                    shortIri={shortIri}
                    onSelectNode={selectNode}
                    onOpenExternal={openExternal}
                />
            </div>
        </div>
    );
}
