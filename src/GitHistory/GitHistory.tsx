/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// File or folder history view: a commit grid with graph and refs, and a tabbed detail panel
// Host-neutral — commits, diffs and details come from an injected GitHistorySource

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProgressPanel } from '../Progress';
import {
    CommitList,
    DEFAULT_COLUMN_WIDTHS,
    authorKey,
    clampColumnWidth,
    type CommitListLabels,
    type GitHistoryColumn,
    type GitHistoryColumnWidths,
    type GitHistoryResizableColumn,
} from './CommitList';
import { DetailPanel, type DetailPanelLabels, type GitHistoryTab } from './DetailPanel';
import type { DiffViewMode } from './DiffView';
import { layoutCommitGraph } from './layoutCommitGraph';
import type { GitCommit, GitCommitAction, GitHistorySource, GitHistoryTarget, GitLink } from './types';
import gitHistoryStyles from './GitHistory.css';

// Inject styles once when bundled with the 'text' loader (single-file bundle).
// Under the 'css' loader the import resolves to a non-string and a sibling
// stylesheet is emitted instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof gitHistoryStyles === 'string' &&
    gitHistoryStyles &&
    !document.getElementById('git-history-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'git-history-styles';
    styleEl.textContent = gitHistoryStyles;
    document.head.appendChild(styleEl);
}

/** Every user-visible string, overridable for other products or languages */
export interface GitHistoryLabels extends CommitListLabels, DetailPanelLabels {
    title: string;
    follow: string;
    followHint: string;
    filter: string;
    filterPlaceholder: string;
    filterNoMatch: string;
    layoutBelow: string;
    layoutBeside: string;
    splitter: string;
    loading: string;
    empty: string;
    emptyHint: string;
    emptyFolderHint: string;
    errorHistory: string;
}

export const DEFAULT_GIT_HISTORY_LABELS: GitHistoryLabels = {
    title: 'History',
    commits: 'Commits',
    follow: 'Follow renames',
    followHint: 'Include the history of the file under its earlier names',
    filter: 'Filter commits',
    filterPlaceholder: 'Filter: subject, author, SHA',
    filterNoMatch: 'No loaded commit matches the filter',
    layoutBelow: 'Show details below the list',
    layoutBeside: 'Show details beside the list',
    splitter: 'Resize the list and the details',
    copySha: 'Copy SHA',
    loading: 'Loading history...',
    loadingDiff: 'Loading diff...',
    loadingFiles: 'Loading files...',
    loadingDetails: 'Loading branches and tags...',
    loadMore: 'Load more',
    loadingMore: 'Loading...',
    empty: 'No history for this file',
    emptyHint: 'The file is untracked or has no commits yet',
    emptyFolderHint: 'Nothing below this folder has been committed yet',
    errorHistory: 'Could not load the history',
    errorDiff: 'Could not load the diff',
    errorFiles: 'Could not load the files of the commit',
    errorDetails: 'Could not load branches and tags',
    noChanges: 'No changes to this file in this commit',
    binary: 'Binary file, not shown',
    renamed: 'renamed',
    added: 'added',
    deleted: 'deleted',
    selectCommit: 'Select a commit to see its details',
    columnGraph: 'Graph',
    columnMessage: 'Message',
    columnAuthor: 'Author',
    columnDate: 'Date',
    columnSha: 'Commit',
    columnStatus: 'Status',
    commitActions: 'Commit actions',
    resizeColumn: 'Resize the {column} column',
    merge: 'merge commit',
    status: { success: 'Build succeeded', failure: 'Build failed', pending: 'Build running', unknown: 'Build status unknown' },
    tabCommit: 'Commit',
    tabDiff: 'Diff',
    tabFiles: 'Files',
    unified: 'Unified',
    split: 'Split',
    author: 'Author',
    authorDate: 'Author date',
    committer: 'Committer',
    commitDate: 'Commit date',
    commitHash: 'Commit hash',
    parent: 'Parent',
    parents: 'Parents',
    relatedLinks: 'Related links',
    containedInBranches: 'Contained in branches',
    containedInTags: 'Contained in tags',
    containedInNone: 'none',
    derivesFromTag: 'Derives from tag',
    commitsSince: '{count} commits',
    showAllFiles: 'Show all {count} files of the commit',
    noFilesInFolder: 'No file below this folder changed',
    files: 'Changed files',
    fileStatus: { added: 'Added', modified: 'Modified', deleted: 'Deleted', renamed: 'Renamed', copied: 'Copied' },
};

/** Where the detail panel sits: under the list or beside it */
export type GitHistoryOrientation = 'vertical' | 'horizontal';

/** The arrangement of the list and the detail panel, reported on every change */
export interface GitHistoryLayout {
    orientation: GitHistoryOrientation;
    /** Share of the list, 0.15 to 0.85 */
    split: number;
}

export interface GitHistoryProps {
    /** Repository-relative path of the file or folder; shown in the header and used to pick
     *  the history's own file in the Files tab */
    path: string;
    /** Supplies the commits and the diffs; replacing it reloads the view */
    source: GitHistorySource;
    /** History of one file (default) or of everything below a folder */
    target?: GitHistoryTarget;
    /** Branch label shown next to the path */
    branch?: string;
    /** Commits requested per page */
    pageSize?: number;
    /** Initial state of the follow-renames toggle; files only */
    initialFollow?: boolean;
    /** Initial arrangement; the detail panel is below the list by default */
    initialLayout?: Partial<GitHistoryLayout>;
    onLayoutChange?: (layout: GitHistoryLayout) => void;
    initialDiffMode?: DiffViewMode;
    /** Columns to hide; a column without data in the loaded commits hides itself */
    columns?: Partial<Record<GitHistoryColumn, boolean>>;
    /** Initial widths of the author, date and SHA columns, in pixels */
    initialColumnWidths?: Partial<GitHistoryColumnWidths>;
    /** Called when a column border has been dragged or moved by key, to persist the widths */
    onColumnWidthsChange?: (widths: GitHistoryColumnWidths) => void;
    /** Display form of a date; the ISO date stays in the tooltip. Default: relative, English */
    formatDate?: (iso: string) => string;
    /** Absolute form of a date in the Commit tab. Default: local `YYYY-MM-DD HH:mm:ss` */
    formatFullDate?: (iso: string) => string;
    /** Image of an author; without it the avatar shows initials. Never fetched by the view itself */
    resolveAvatarUrl?: (email: string, commit: GitCommit) => string | undefined;
    /** Links shown under the commit message */
    linkify?: (commit: GitCommit) => GitLink[];
    /** Opens a link (web or mailto); without it links open as plain anchors */
    onOpenLink?: (url: string) => void;
    /** Actions of a commit row (⋯ button, right click, Shift+F10) */
    commitActions?: (commit: GitCommit) => GitCommitAction[];
    /** Copy SHA button for the selected commit; hidden when omitted */
    onCopySha?: (commit: GitCommit) => void;
    /** Called when the selection changes */
    onSelectCommit?: (commit: GitCommit) => void;
    /** Extra host buttons placed at the end of the header */
    headerActions?: React.ReactNode;
    /** Partial override of the built-in strings */
    labels?: Partial<GitHistoryLabels>;
    className?: string;
    style?: React.CSSProperties;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
];

const SPLIT_MIN = 0.15;
const SPLIT_MAX = 0.85;
const SPLIT_STEP = 0.05;
// A filter of this many hex digits or more may be a SHA that is not loaded yet
const SHA_LOOKUP_MIN = 7;
const FILTER_LOOKUP_DELAY_MS = 300;

/** Default date format: "2 days ago", "last week"; an unparsable value is shown as is */
function formatRelativeDate(iso: string): string {
    const time = Date.parse(iso);
    if (Number.isNaN(time)) return iso;
    const seconds = Math.round((time - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, 'minute');
}

/** Default absolute date: local time as YYYY-MM-DD HH:mm:ss */
function formatLocalDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return typeof err === 'string' ? err : String(err);
}

const clampSplit = (value: number): number => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));

function matchesFilter(commit: GitCommit, needle: string): boolean {
    return (
        commit.subject.toLowerCase().includes(needle) ||
        commit.author.toLowerCase().includes(needle) ||
        (commit.authorEmail?.toLowerCase().includes(needle) ?? false) ||
        commit.sha.toLowerCase().startsWith(needle) ||
        (commit.refs?.some((r) => r.name.toLowerCase().includes(needle)) ?? false)
    );
}

type ListState =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ready'; commits: GitCommit[]; hasMore: boolean };

export function GitHistory({
    path,
    source,
    target = 'file',
    branch,
    pageSize = 50,
    initialFollow = true,
    initialLayout,
    onLayoutChange,
    initialDiffMode = 'unified',
    columns,
    initialColumnWidths,
    onColumnWidthsChange,
    formatDate = formatRelativeDate,
    formatFullDate = formatLocalDateTime,
    resolveAvatarUrl,
    linkify,
    onOpenLink,
    commitActions,
    onCopySha,
    onSelectCommit,
    headerActions,
    labels,
    className,
    style,
}: GitHistoryProps): React.ReactElement {
    const text = { ...DEFAULT_GIT_HISTORY_LABELS, ...labels };
    const [followSetting, setFollow] = useState(initialFollow);
    // git log --follow takes exactly one file, so a folder never follows
    const follow = target === 'file' && followSetting;
    const [list, setList] = useState<ListState>({ status: 'loading' });
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState<string | null>(null);
    const [selected, setSelected] = useState<GitCommit | null>(null);
    const [filter, setFilter] = useState('');
    const [found, setFound] = useState<GitCommit | null>(null);
    const [layout, setLayout] = useState<GitHistoryLayout>({
        orientation: initialLayout?.orientation ?? 'vertical',
        split: clampSplit(initialLayout?.split ?? 0.45),
    });
    const [tab, setTab] = useState<GitHistoryTab>(target === 'folder' ? 'files' : 'diff');
    const [diffMode, setDiffMode] = useState<DiffViewMode>(initialDiffMode);
    const [columnWidths, setColumnWidths] = useState<GitHistoryColumnWidths>(() => {
        const widths = { ...DEFAULT_COLUMN_WIDTHS };
        for (const key of Object.keys(widths) as GitHistoryResizableColumn[]) {
            const given = initialColumnWidths?.[key];
            if (typeof given === 'number' && Number.isFinite(given)) widths[key] = clampColumnWidth(given);
        }
        return widths;
    });
    const bodyRef = useRef<HTMLDivElement>(null);

    // Bumped whenever the list is reset; an answer of an older generation is ignored
    const generation = useRef(0);

    // Reset and load the first page when the path, the source or the follow mode changes
    useEffect(() => {
        const gen = ++generation.current;
        setList({ status: 'loading' });
        setSelected(null);
        setFound(null);
        setLoadingMore(false);
        setMoreError(null);
        source.loadCommits({ follow, skip: 0, limit: pageSize }).then(
            (page) => {
                if (gen !== generation.current) return;
                setList({ status: 'ready', commits: page.commits, hasMore: page.hasMore });
                if (page.commits.length > 0) setSelected(page.commits[0]);
            },
            (err: unknown) => {
                if (gen !== generation.current) return;
                setList({ status: 'error', error: errorMessage(err) });
            }
        );
    }, [path, source, follow, pageSize]);

    const loadMore = useCallback(() => {
        if (list.status !== 'ready' || !list.hasMore || loadingMore) return;
        const gen = generation.current;
        setLoadingMore(true);
        setMoreError(null);
        source.loadCommits({ follow, skip: list.commits.length, limit: pageSize }).then(
            (page) => {
                if (gen !== generation.current) return;
                setLoadingMore(false);
                setList((prev) =>
                    prev.status === 'ready'
                        ? { status: 'ready', commits: [...prev.commits, ...page.commits], hasMore: page.hasMore }
                        : prev
                );
            },
            (err: unknown) => {
                if (gen !== generation.current) return;
                setLoadingMore(false);
                setMoreError(errorMessage(err));
            }
        );
    }, [list, loadingMore, source, follow, pageSize]);

    const select = useCallback(
        (commit: GitCommit) => {
            setSelected(commit);
            onSelectCommit?.(commit);
        },
        [onSelectCommit]
    );

    const commits = list.status === 'ready' ? list.commits : [];
    const needle = filter.trim().toLowerCase();
    const filtered = useMemo(() => (needle ? commits.filter((c) => matchesFilter(c, needle)) : commits), [commits, needle]);

    // A SHA-like filter with no loaded match asks the host for that commit
    useEffect(() => {
        setFound(null);
        if (!source.findCommit || filtered.length > 0 || !/^[0-9a-f]+$/.test(needle) || needle.length < SHA_LOOKUP_MIN) {
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            source.findCommit!(needle).then(
                (commit) => !cancelled && setFound(commit),
                () => undefined
            );
        }, FILTER_LOOKUP_DELAY_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [needle, filtered.length, source]);

    const shown = found && filtered.length === 0 ? [found] : filtered;

    // The graph needs every commit's parents and the unfiltered order
    const graph = useMemo(
        () => (!needle && commits.length > 0 && commits.every((c) => c.parents) ? layoutCommitGraph(commits) : null),
        [commits, needle]
    );

    const visibleColumns = useMemo(() => {
        const set = new Set<GitHistoryColumn>(['graph', 'message', 'author', 'date', 'sha', 'status']);
        if (!commits.some((c) => c.status)) set.delete('status');
        for (const [column, visible] of Object.entries(columns ?? {})) {
            if (visible === false && column !== 'message') set.delete(column as GitHistoryColumn);
        }
        return set;
    }, [commits, columns]);

    // A parent link selects the loaded parent, or finds it through the host
    const selectSha = useCallback(
        (sha: string) => {
            const loaded = commits.find((c) => c.sha === sha);
            if (loaded) {
                select(loaded);
                return;
            }
            source.findCommit?.(sha).then(
                (commit) => commit && select(commit),
                () => undefined
            );
        },
        [commits, select, source]
    );

    // Live width while a border is dragged; the host hears about it once the change is done
    const columnWidthsRef = useRef(columnWidths);
    const resizeColumn = useCallback(
        (column: GitHistoryResizableColumn, width: number, done: boolean) => {
            const next = { ...columnWidthsRef.current, [column]: width };
            columnWidthsRef.current = next;
            setColumnWidths(next);
            if (done) onColumnWidthsChange?.(next);
        },
        [onColumnWidthsChange]
    );

    const changeLayout = useCallback(
        (next: GitHistoryLayout) => {
            setLayout(next);
            onLayoutChange?.(next);
        },
        [onLayoutChange]
    );

    // Drag the splitter; the share is taken from the pointer position in the body
    const startDrag = useCallback(
        (e: React.PointerEvent) => {
            const body = bodyRef.current;
            if (!body) return;
            e.preventDefault();
            const rect = body.getBoundingClientRect();
            let latest = layout.split;
            const onMove = (ev: PointerEvent): void => {
                latest =
                    layout.orientation === 'vertical'
                        ? clampSplit((ev.clientY - rect.top) / rect.height)
                        : clampSplit((ev.clientX - rect.left) / rect.width);
                setLayout((prev) => ({ ...prev, split: latest }));
            };
            const onUp = (): void => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                onLayoutChange?.({ orientation: layout.orientation, split: latest });
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        },
        [layout, onLayoutChange]
    );

    const handleSplitterKey = (e: React.KeyboardEvent): void => {
        const back = layout.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        const forward = layout.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
        if (e.key !== back && e.key !== forward) return;
        e.preventDefault();
        changeLayout({ ...layout, split: clampSplit(layout.split + (e.key === forward ? SPLIT_STEP : -SPLIT_STEP)) });
    };

    const displayPath = target === 'folder' && !path.endsWith('/') ? `${path}/` : path;

    let body: React.ReactNode;
    if (list.status === 'loading') {
        body = <ProgressPanel title={text.title} message={text.loading} />;
    } else if (list.status === 'error') {
        body = <ProgressPanel title={text.title} message={text.errorHistory} error={list.error} />;
    } else if (commits.length === 0) {
        body = (
            <div className="git-history-empty" role="status">
                <p>{text.empty}</p>
                <p className="git-history-empty-hint">{target === 'folder' ? text.emptyFolderHint : text.emptyHint}</p>
            </div>
        );
    } else {
        const vertical = layout.orientation === 'vertical';
        body = (
            <div className={`git-history-body is-${layout.orientation}`} ref={bodyRef}>
                <div className="git-history-list-pane" style={{ flexBasis: `${layout.split * 100}%` }}>
                    {needle && shown.length === 0 ? (
                        <div className="git-history-diff-note" role="status">{text.filterNoMatch}</div>
                    ) : (
                        <CommitList
                            commits={shown}
                            graph={graph}
                            columns={visibleColumns}
                            selectedSha={selected?.sha ?? null}
                            highlightAuthor={selected ? authorKey(selected) : null}
                            hasMore={list.hasMore && !found}
                            loadingMore={loadingMore}
                            moreError={moreError}
                            onSelect={select}
                            onLoadMore={loadMore}
                            formatDate={formatDate}
                            commitActions={commitActions}
                            resolveAvatarUrl={resolveAvatarUrl}
                            widths={columnWidths}
                            onResizeColumn={resizeColumn}
                            labels={text}
                        />
                    )}
                </div>
                <div
                    className="git-history-splitter"
                    role="separator"
                    tabIndex={0}
                    aria-label={text.splitter}
                    aria-orientation={vertical ? 'horizontal' : 'vertical'}
                    aria-valuemin={SPLIT_MIN * 100}
                    aria-valuemax={SPLIT_MAX * 100}
                    aria-valuenow={Math.round(layout.split * 100)}
                    onPointerDown={startDrag}
                    onKeyDown={handleSplitterKey}
                />
                <div className="git-history-detail-pane">
                    <DetailPanel
                        commit={selected}
                        target={target}
                        path={path}
                        source={source}
                        tab={tab}
                        onTabChange={setTab}
                        diffMode={diffMode}
                        onDiffModeChange={setDiffMode}
                        formatDate={formatDate}
                        formatFullDate={formatFullDate}
                        resolveAvatarUrl={resolveAvatarUrl}
                        linkify={linkify}
                        onOpenLink={onOpenLink}
                        onCopySha={onCopySha}
                        onSelectSha={selectSha}
                        labels={text}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={className ? `git-history ${className}` : 'git-history'} style={style}>
            <div className="git-history-header">
                {/* The trailing LRM keeps a final '/' at the end in the right-to-left truncation */}
                <span className="git-history-path" title={displayPath}>{`${displayPath}\u200e`}</span>
                {branch && <span className="git-history-branch">[{branch}]</span>}
                <span className="git-history-header-spacer" />
                {list.status === 'ready' && commits.length > 0 && (
                    <input
                        type="search"
                        className="git-history-filter"
                        aria-label={text.filter}
                        placeholder={text.filterPlaceholder}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                )}
                {target === 'file' && (
                    <button
                        type="button"
                        className={`git-history-toggle${followSetting ? ' is-on' : ''}`}
                        aria-pressed={followSetting}
                        title={text.followHint}
                        onClick={() => setFollow((f) => !f)}
                    >
                        {text.follow}
                    </button>
                )}
                <button
                    type="button"
                    className="git-history-button git-history-layout-toggle"
                    aria-label={layout.orientation === 'vertical' ? text.layoutBeside : text.layoutBelow}
                    title={layout.orientation === 'vertical' ? text.layoutBeside : text.layoutBelow}
                    onClick={() =>
                        changeLayout({ ...layout, orientation: layout.orientation === 'vertical' ? 'horizontal' : 'vertical' })
                    }
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        {layout.orientation === 'vertical' ? (
                            <path d="M7,1 L7,13" stroke="currentColor" strokeWidth="1.2" />
                        ) : (
                            <path d="M1,7 L13,7" stroke="currentColor" strokeWidth="1.2" />
                        )}
                    </svg>
                </button>
                {onCopySha && (
                    <button
                        type="button"
                        className="git-history-button"
                        disabled={!selected}
                        onClick={() => selected && onCopySha(selected)}
                    >
                        {text.copySha}
                    </button>
                )}
                {headerActions}
            </div>
            {body}
        </div>
    );
}
