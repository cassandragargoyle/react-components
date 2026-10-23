/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// File history view: a paged commit list on the left and the selected commit's diff on the right
// Host-neutral — commits and diffs come from an injected GitHistorySource, actions go out as callbacks

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProgressPanel } from '../Progress';
import { CommitList } from './CommitList';
import { DiffView } from './DiffView';
import { parseUnifiedDiff } from './parseUnifiedDiff';
import type { GitCommit, GitHistorySource } from './types';
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
export interface GitHistoryLabels {
    title: string;
    commits: string;
    follow: string;
    followHint: string;
    copySha: string;
    loading: string;
    loadingDiff: string;
    loadMore: string;
    loadingMore: string;
    empty: string;
    emptyHint: string;
    errorHistory: string;
    errorDiff: string;
    noChanges: string;
    binary: string;
    renamed: string;
    added: string;
    deleted: string;
    selectCommit: string;
}

export const DEFAULT_GIT_HISTORY_LABELS: GitHistoryLabels = {
    title: 'History',
    commits: 'Commits',
    follow: 'Follow renames',
    followHint: 'Include the history of the file under its earlier names',
    copySha: 'Copy SHA',
    loading: 'Loading history...',
    loadingDiff: 'Loading diff...',
    loadMore: 'Load more',
    loadingMore: 'Loading...',
    empty: 'No history for this file',
    emptyHint: 'The file is untracked or has no commits yet',
    errorHistory: 'Could not load the history',
    errorDiff: 'Could not load the diff',
    noChanges: 'No changes to this file in this commit',
    binary: 'Binary file, not shown',
    renamed: 'renamed',
    added: 'added',
    deleted: 'deleted',
    selectCommit: 'Select a commit to see its changes',
};

export interface GitHistoryProps {
    /** Path shown in the header; display only, the source knows which file it serves */
    path: string;
    /** Supplies the commits and the diffs; replacing it reloads the view */
    source: GitHistorySource;
    /** Branch label shown next to the path */
    branch?: string;
    /** Commits requested per page */
    pageSize?: number;
    /** Initial state of the follow-renames toggle */
    initialFollow?: boolean;
    /** Display form of a commit date; the ISO date stays in the tooltip. Default: relative, English */
    formatDate?: (iso: string) => string;
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

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return typeof err === 'string' ? err : String(err);
}

type ListState =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ready'; commits: GitCommit[]; hasMore: boolean };

type DiffState =
    | { status: 'idle' }
    | { status: 'loading'; sha: string }
    | { status: 'error'; sha: string; error: string }
    | { status: 'ready'; sha: string; text: string };

export function GitHistory({
    path,
    source,
    branch,
    pageSize = 50,
    initialFollow = true,
    formatDate = formatRelativeDate,
    onCopySha,
    onSelectCommit,
    headerActions,
    labels,
    className,
    style,
}: GitHistoryProps): React.ReactElement {
    const text = { ...DEFAULT_GIT_HISTORY_LABELS, ...labels };
    const [follow, setFollow] = useState(initialFollow);
    const [list, setList] = useState<ListState>({ status: 'loading' });
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState<string | null>(null);
    const [selected, setSelected] = useState<GitCommit | null>(null);
    const [diff, setDiff] = useState<DiffState>({ status: 'idle' });

    // Bumped whenever the list is reset; an answer of an older generation is ignored
    const generation = useRef(0);

    // Reset and load the first page when the file, the source or the follow mode changes
    useEffect(() => {
        const gen = ++generation.current;
        setList({ status: 'loading' });
        setSelected(null);
        setDiff({ status: 'idle' });
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

    // Load the diff of the selected commit
    useEffect(() => {
        if (!selected) return undefined;
        let cancelled = false;
        const sha = selected.sha;
        setDiff({ status: 'loading', sha });
        source.loadDiff(selected).then(
            (diffText) => {
                if (!cancelled) setDiff({ status: 'ready', sha, text: diffText });
            },
            (err: unknown) => {
                if (!cancelled) setDiff({ status: 'error', sha, error: errorMessage(err) });
            }
        );
        return () => {
            cancelled = true;
        };
    }, [selected, source]);

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

    const files = useMemo(() => (diff.status === 'ready' ? parseUnifiedDiff(diff.text) : []), [diff]);

    let body: React.ReactNode;
    if (list.status === 'loading') {
        body = <ProgressPanel title={text.title} message={text.loading} />;
    } else if (list.status === 'error') {
        body = <ProgressPanel title={text.title} message={text.errorHistory} error={list.error} />;
    } else if (list.commits.length === 0) {
        body = (
            <div className="git-history-empty" role="status">
                <p>{text.empty}</p>
                <p className="git-history-empty-hint">{text.emptyHint}</p>
            </div>
        );
    } else {
        body = (
            <div className="git-history-body">
                <CommitList
                    commits={list.commits}
                    selectedSha={selected?.sha ?? null}
                    hasMore={list.hasMore}
                    loadingMore={loadingMore}
                    moreError={moreError}
                    onSelect={select}
                    onLoadMore={loadMore}
                    formatDate={formatDate}
                    labels={text}
                />
                <div className="git-history-detail">
                    {selected ? (
                        <>
                            <div className="git-history-detail-head">
                                <div className="git-history-detail-subject">{selected.subject}</div>
                                <div className="git-history-detail-meta">
                                    <span className="git-history-commit-sha">{selected.shortSha}</span>
                                    <span> · {selected.author} · </span>
                                    <span title={selected.date}>{formatDate(selected.date)}</span>
                                    {selected.path && selected.path !== path && (
                                        <span className="git-history-detail-path"> · {selected.path}</span>
                                    )}
                                </div>
                            </div>
                            <div className="git-history-detail-body">
                                {diff.status === 'loading' && (
                                    <div className="git-history-diff-note" role="status">{text.loadingDiff}</div>
                                )}
                                {diff.status === 'error' && (
                                    <div className="git-history-diff-error" role="alert">
                                        <div>{text.errorDiff}</div>
                                        <div className="git-history-diff-error-detail">{diff.error}</div>
                                    </div>
                                )}
                                {diff.status === 'ready' && <DiffView files={files} labels={text} />}
                            </div>
                        </>
                    ) : (
                        <div className="git-history-diff-note">{text.selectCommit}</div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={className ? `git-history ${className}` : 'git-history'} style={style}>
            <div className="git-history-header">
                <span className="git-history-path" title={path}>{path}</span>
                {branch && <span className="git-history-branch">[{branch}]</span>}
                <span className="git-history-header-spacer" />
                <button
                    type="button"
                    className={`git-history-toggle${follow ? ' is-on' : ''}`}
                    aria-pressed={follow}
                    title={text.followHint}
                    onClick={() => setFollow((f) => !f)}
                >
                    {text.follow}
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
