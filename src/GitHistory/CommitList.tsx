/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The commit list of GitHistory: a keyboard-navigable grid of graph, refs + subject, author,
// date, age, SHA and status columns, each resizable on its own; long lists render visible rows

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '../Avatar';
import { CommitGraphCell, LANE_WIDTH } from './CommitGraphCell';
import { CommitMenu } from './CommitMenu';
import { RefLabels } from './RefLabels';
import type { GraphRow } from './layoutCommitGraph';
import type { GitCommit, GitCommitAction, GitCommitStatus } from './types';

/** Height of one commit row, in pixels; windowing depends on it being fixed */
export const ROW_HEIGHT = 26;
// Rows rendered above and below the visible ones
const OVERSCAN = 10;
// Lists up to this length render every row
const WINDOW_MIN_ROWS = 200;
// Distance from the bottom, in pixels, at which the next page is requested
const LOAD_MORE_THRESHOLD = 48;

/** The columns of the list, from left to right */
export type GitHistoryColumn = 'graph' | 'message' | 'author' | 'date' | 'age' | 'sha' | 'status';

export const COLUMN_ORDER: readonly GitHistoryColumn[] = ['graph', 'message', 'author', 'date', 'age', 'sha', 'status'];

/** Widths set by the user, in pixels; a missing column keeps its default */
export type GitHistoryColumnWidths = Partial<Record<GitHistoryColumn, number>>;

// Default widths; the graph defaults to its lanes and the message column to the free space
const DEFAULT_WIDTHS: Record<Exclude<GitHistoryColumn, 'graph' | 'message'>, number> = {
    author: 160,
    date: 128,
    age: 104,
    sha: 76,
    status: 24,
};
// The message column while it is flexible never gets narrower than this
const FLEX_MESSAGE_MIN = 120;
export const MIN_COLUMN_WIDTH = 16;
export const MAX_COLUMN_WIDTH = 1600;
// Width change of one arrow key press on a column border
const RESIZE_STEP = 10;

export const clampColumnWidth = (width: number): number =>
    Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));

export interface CommitListLabels {
    commits: string;
    loadMore: string;
    loadingMore: string;
    columnGraph: string;
    columnMessage: string;
    columnAuthor: string;
    columnDate: string;
    columnAge: string;
    columnSha: string;
    columnStatus: string;
    commitActions: string;
    resizeColumn: string;
    merge: string;
    status: Record<GitCommitStatus, string>;
}

export interface CommitListProps {
    commits: readonly GitCommit[];
    /** Graph cells, aligned with `commits`; null hides the graph */
    graph: readonly GraphRow[] | null;
    columns: ReadonlySet<GitHistoryColumn>;
    selectedSha: string | null;
    /** Author key of the selected commit; its other commits are highlighted */
    highlightAuthor: string | null;
    hasMore: boolean;
    loadingMore: boolean;
    /** Error of the last page request, shown under the rows */
    moreError: string | null;
    onSelect: (commit: GitCommit) => void;
    onLoadMore: () => void;
    /** Relative form, for the Age column */
    formatDate: (iso: string) => string;
    /** Exact form, for the Date column */
    formatColumnDate: (iso: string) => string;
    /** Tooltip of both date columns */
    describeDate: (commit: GitCommit) => string;
    commitActions?: (commit: GitCommit) => GitCommitAction[];
    resolveAvatarUrl?: (email: string, commit: GitCommit) => string | undefined;
    widths: GitHistoryColumnWidths;
    /** A border was dragged or moved by key (`width`), or reset by a double click
     *  (`undefined`); `done` is true when the change is complete */
    onResizeColumn: (column: GitHistoryColumn, width: number | undefined, done: boolean) => void;
    labels: CommitListLabels;
}

/** Key that identifies an author across commits */
export function authorKey(commit: GitCommit): string {
    return (commit.authorEmail ?? commit.author).toLowerCase();
}

/**
 * The draggable border on the right of a column header. It changes that column alone; the
 * columns after it move along. The drag starts from the width the column has on screen, so
 * a flexible message column becomes fixed at the size it is dragged to. Left/Right move the
 * border by RESIZE_STEP, a double click restores the default width
 */
function ColumnResizer({
    column,
    width,
    label,
    onResize,
}: {
    column: GitHistoryColumn;
    /** The column's current width, or null for the flexible message column */
    width: number | null;
    label: string;
    onResize: CommitListProps['onResizeColumn'];
}): React.ReactElement {
    const ref = useRef<HTMLSpanElement>(null);
    // A flexible column starts from the width it has on screen
    const currentWidth = (): number => {
        if (width !== null) return width;
        const measured = ref.current?.parentElement?.getBoundingClientRect().width ?? 0;
        return measured > 0 ? measured : FLEX_MESSAGE_MIN;
    };
    const startDrag = (e: React.PointerEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const start = currentWidth();
        let latest = start;
        const onMove = (ev: PointerEvent): void => {
            if (!Number.isFinite(ev.clientX - startX)) return;
            latest = clampColumnWidth(start + (ev.clientX - startX));
            onResize(column, latest, false);
        };
        const onUp = (): void => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            onResize(column, clampColumnWidth(latest), true);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };
    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        onResize(column, clampColumnWidth(currentWidth() + (e.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP)), true);
    };
    return (
        <span
            ref={ref}
            className="git-history-col-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-valuenow={width ?? undefined}
            aria-valuemin={MIN_COLUMN_WIDTH}
            aria-valuemax={MAX_COLUMN_WIDTH}
            tabIndex={0}
            onPointerDown={startDrag}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => onResize(column, undefined, true)}
            onClick={(e) => e.stopPropagation()}
        />
    );
}

function StatusDot({ status, label }: { status: GitCommitStatus; label: string }): React.ReactElement {
    return <span className={`git-history-status is-${status}`} role="img" aria-label={label} title={label} />;
}

export function CommitList({
    commits,
    graph,
    columns,
    selectedSha,
    highlightAuthor,
    hasMore,
    loadingMore,
    moreError,
    onSelect,
    onLoadMore,
    formatDate,
    formatColumnDate,
    describeDate,
    commitActions,
    resolveAvatarUrl,
    widths,
    onResizeColumn,
    labels,
}: CommitListProps): React.ReactElement {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewport, setViewport] = useState(0);
    const [menu, setMenu] = useState<{ commit: GitCommit; x: number; y: number } | null>(null);
    const selectedIndex = commits.findIndex((c) => c.sha === selectedSha);
    const rowId = (sha: string): string => `git-history-commit-${sha}`;

    // Track the viewport height for windowing; jsdom and hidden panes report 0 and render all
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return undefined;
        const measure = (): void => setViewport(el.clientHeight);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const windowed = viewport > 0 && commits.length > WINDOW_MIN_ROWS;
    const first = windowed ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
    const last = windowed
        ? Math.min(commits.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)
        : commits.length;

    // Keep the selected row visible while moving through the list with the keyboard
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || selectedIndex < 0 || el.clientHeight === 0) return;
        const top = selectedIndex * ROW_HEIGHT;
        const header = ROW_HEIGHT;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + ROW_HEIGHT + header > el.scrollTop + el.clientHeight) {
            el.scrollTop = top + ROW_HEIGHT + header - el.clientHeight;
        }
    }, [selectedIndex]);

    const requestMore = useCallback(() => {
        if (hasMore && !loadingMore && !moreError) onLoadMore();
    }, [hasMore, loadingMore, moreError, onLoadMore]);

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            setScrollTop(el.scrollTop);
            if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD) requestMore();
        },
        [requestMore]
    );

    // Open the row menu at a point inside the scroll container
    const openMenu = useCallback(
        (commit: GitCommit, clientX?: number, clientY?: number) => {
            if (!commitActions || commitActions(commit).length === 0) return;
            const el = scrollRef.current;
            const rect = el?.getBoundingClientRect();
            const index = commits.indexOf(commit);
            const x = clientX !== undefined && rect ? clientX - rect.left : 48;
            const y =
                clientY !== undefined && rect && el
                    ? clientY - rect.top + el.scrollTop
                    : (index + 2) * ROW_HEIGHT;
            setMenu({ commit, x, y });
        },
        [commitActions, commits]
    );

    // Close the row menu and give the focus back to the grid
    const closeMenu = useCallback(() => {
        setMenu(null);
        scrollRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus();
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (commits.length === 0) return;
            if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                e.preventDefault();
                if (selectedIndex >= 0) openMenu(commits[selectedIndex]);
                return;
            }
            const page = Math.max(1, Math.floor(viewport / ROW_HEIGHT) - 1);
            let next = -1;
            if (e.key === 'ArrowDown') {
                if (selectedIndex >= commits.length - 1) requestMore();
                next = Math.min(selectedIndex + 1, commits.length - 1);
            } else if (e.key === 'ArrowUp') {
                next = Math.max(selectedIndex - 1, 0);
            } else if (e.key === 'PageDown') {
                next = Math.min(selectedIndex + page, commits.length - 1);
            } else if (e.key === 'PageUp') {
                next = Math.max(selectedIndex - page, 0);
            } else if (e.key === 'Home') {
                next = 0;
            } else if (e.key === 'End') {
                next = commits.length - 1;
            } else {
                return;
            }
            e.preventDefault();
            if (next !== selectedIndex) onSelect(commits[next]);
        },
        [commits, selectedIndex, onSelect, requestMore, openMenu, viewport]
    );

    const graphLanes = graph ? Math.max(1, ...graph.map((r) => r.width)) : 0;
    const show = (column: GitHistoryColumn): boolean => columns.has(column) && (column !== 'graph' || graph !== null);
    const visible = COLUMN_ORDER.filter(show);
    // Fixed width of a column, or null for the message column while it is flexible
    const widthOf = (column: GitHistoryColumn): number | null => {
        const set = widths[column];
        if (set !== undefined) return set;
        if (column === 'graph') return graphLanes * LANE_WIDTH + 8;
        if (column === 'message') return null;
        return DEFAULT_WIDTHS[column];
    };
    const messageFixed = widthOf('message') !== null;
    // Every column keeps its own width; once the message column is fixed too, a filler track
    // takes the free space, so the rows and the selection still span the whole pane
    const template = [
        ...visible.map((column) => {
            const width = widthOf(column);
            return width === null ? `minmax(${FLEX_MESSAGE_MIN}px, 1fr)` : `${width}px`;
        }),
        ...(messageFixed ? ['minmax(0, 1fr)'] : []),
    ].join(' ');
    const minWidth = visible.reduce((sum, column) => sum + (widthOf(column) ?? FLEX_MESSAGE_MIN), 0);
    const gridStyle = { '--git-history-columns': template, minWidth } as React.CSSProperties;
    const headerText: Record<GitHistoryColumn, string> = {
        graph: labels.columnGraph,
        message: labels.columnMessage,
        author: labels.columnAuthor,
        date: labels.columnDate,
        age: labels.columnAge,
        sha: labels.columnSha,
        status: labels.columnStatus,
    };
    // The graph and the status column carry no visible title, only an accessible one
    const silentHeader = (column: GitHistoryColumn): boolean => column === 'graph' || column === 'status';

    return (
        <div className="git-history-commits" ref={scrollRef} onScroll={handleScroll}>
            <div
                className="git-history-grid"
                role="grid"
                aria-label={labels.commits}
                aria-rowcount={commits.length + 1}
                aria-readonly="true"
                tabIndex={0}
                aria-activedescendant={selectedSha ? rowId(selectedSha) : undefined}
                onKeyDown={handleKeyDown}
                style={gridStyle}
            >
                <div role="rowgroup" className="git-history-grid-head">
                    <div role="row" className="git-history-row" aria-rowindex={1}>
                        {visible.map((column) => (
                            <span
                                key={column}
                                role="columnheader"
                                className={`git-history-cell is-resizable is-${column}`}
                                aria-label={headerText[column]}
                            >
                                {!silentHeader(column) && <span className="git-history-header-text">{headerText[column]}</span>}
                                <ColumnResizer
                                    column={column}
                                    width={widthOf(column)}
                                    label={labels.resizeColumn.replace('{column}', headerText[column])}
                                    onResize={onResizeColumn}
                                />
                            </span>
                        ))}
                    </div>
                </div>
                <div role="rowgroup">
                    {first > 0 && <div style={{ height: first * ROW_HEIGHT }} aria-hidden="true" />}
                    {commits.slice(first, last).map((commit, offset) => {
                        const index = first + offset;
                        const selected = commit.sha === selectedSha;
                        const sameAuthor = highlightAuthor !== null && authorKey(commit) === highlightAuthor;
                        const merge = (commit.parents?.length ?? 0) > 1;
                        const refNames = commit.refs?.map((r) => r.name).join(', ');
                        const ariaLabel = [
                            commit.subject,
                            commit.author,
                            formatDate(commit.date),
                            refNames,
                            merge ? labels.merge : undefined,
                            commit.status ? labels.status[commit.status] : undefined,
                        ]
                            .filter(Boolean)
                            .join(', ');
                        return (
                            <div
                                key={commit.sha}
                                id={rowId(commit.sha)}
                                data-sha={commit.sha}
                                role="row"
                                aria-rowindex={index + 2}
                                aria-selected={selected}
                                aria-label={ariaLabel}
                                className={`git-history-row git-history-commit${selected ? ' is-selected' : ''}${sameAuthor ? ' is-same-author' : ''}`}
                                onClick={() => onSelect(commit)}
                                onContextMenu={(e) => {
                                    if (!commitActions) return;
                                    e.preventDefault();
                                    onSelect(commit);
                                    openMenu(commit, e.clientX, e.clientY);
                                }}
                            >
                                {show('graph') && graph && (
                                    <span role="gridcell" className="git-history-cell is-graph">
                                        <CommitGraphCell row={graph[index]} lanes={graphLanes} height={ROW_HEIGHT} selected={selected} />
                                    </span>
                                )}
                                <span role="gridcell" className="git-history-cell is-message">
                                    {commit.refs && <RefLabels refs={commit.refs} />}
                                    <span className="git-history-commit-subject" title={commit.subject}>
                                        {commit.subject}
                                    </span>
                                    {commitActions && (
                                        <button
                                            type="button"
                                            className="git-history-row-actions"
                                            tabIndex={-1}
                                            aria-label={labels.commitActions}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(commit);
                                                openMenu(commit, e.clientX, e.clientY);
                                            }}
                                        >
                                            ⋯
                                        </button>
                                    )}
                                </span>
                                {show('author') && (
                                    <span role="gridcell" className="git-history-cell is-author">
                                        <Avatar
                                            id={authorKey(commit)}
                                            displayName={commit.author}
                                            kind="user"
                                            size={18}
                                            interactive={false}
                                            ring={false}
                                            avatarUrl={commit.authorEmail ? resolveAvatarUrl?.(commit.authorEmail, commit) : undefined}
                                        />
                                        <span className="git-history-commit-author">{commit.author}</span>
                                    </span>
                                )}
                                {show('date') && (
                                    <span role="gridcell" className="git-history-cell is-date" title={describeDate(commit)}>
                                        {formatColumnDate(commit.date)}
                                    </span>
                                )}
                                {show('age') && (
                                    <span role="gridcell" className="git-history-cell is-age" title={describeDate(commit)}>
                                        {formatDate(commit.date)}
                                    </span>
                                )}
                                {show('sha') && (
                                    <span role="gridcell" className="git-history-cell is-sha">
                                        <span className="git-history-commit-sha">{commit.shortSha}</span>
                                    </span>
                                )}
                                {show('status') && (
                                    <span role="gridcell" className="git-history-cell is-status">
                                        {commit.status && <StatusDot status={commit.status} label={labels.status[commit.status]} />}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {last < commits.length && <div style={{ height: (commits.length - last) * ROW_HEIGHT }} aria-hidden="true" />}
                </div>
            </div>
            {moreError && <div className="git-history-commits-error" role="alert">{moreError}</div>}
            {hasMore && (
                <button type="button" className="git-history-load-more" onClick={onLoadMore} disabled={loadingMore}>
                    {loadingMore ? labels.loadingMore : labels.loadMore}
                </button>
            )}
            {menu && commitActions && (
                <CommitMenu
                    actions={commitActions(menu.commit)}
                    x={menu.x}
                    y={menu.y}
                    label={labels.commitActions}
                    onClose={closeMenu}
                />
            )}
        </div>
    );
}
