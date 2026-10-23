/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The commit list of GitHistory: a keyboard-navigable grid of graph, refs + subject, author,
// date, SHA and status columns; long lists render only the visible rows

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

/** The columns of the list */
export type GitHistoryColumn = 'graph' | 'message' | 'author' | 'date' | 'sha' | 'status';

export interface CommitListLabels {
    commits: string;
    loadMore: string;
    loadingMore: string;
    columnGraph: string;
    columnMessage: string;
    columnAuthor: string;
    columnDate: string;
    columnSha: string;
    columnStatus: string;
    commitActions: string;
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
    formatDate: (iso: string) => string;
    commitActions?: (commit: GitCommit) => GitCommitAction[];
    resolveAvatarUrl?: (email: string, commit: GitCommit) => string | undefined;
    labels: CommitListLabels;
}

/** Key that identifies an author across commits */
export function authorKey(commit: GitCommit): string {
    return (commit.authorEmail ?? commit.author).toLowerCase();
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
    commitActions,
    resolveAvatarUrl,
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
    const template = [
        show('graph') ? `${graphLanes * LANE_WIDTH + 8}px` : null,
        'minmax(120px, 1fr)',
        show('author') ? 'minmax(96px, 180px)' : null,
        show('date') ? '112px' : null,
        show('sha') ? '76px' : null,
        show('status') ? '24px' : null,
    ]
        .filter(Boolean)
        .join(' ');
    const gridStyle = { '--git-history-columns': template } as React.CSSProperties;

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
                        {show('graph') && <span role="columnheader" className="git-history-cell is-graph" aria-label={labels.columnGraph} />}
                        <span role="columnheader" className="git-history-cell">{labels.columnMessage}</span>
                        {show('author') && <span role="columnheader" className="git-history-cell">{labels.columnAuthor}</span>}
                        {show('date') && <span role="columnheader" className="git-history-cell">{labels.columnDate}</span>}
                        {show('sha') && <span role="columnheader" className="git-history-cell">{labels.columnSha}</span>}
                        {show('status') && <span role="columnheader" className="git-history-cell" aria-label={labels.columnStatus} />}
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
                                    <span role="gridcell" className="git-history-cell is-date" title={commit.date}>
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
