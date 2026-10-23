/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The commit list of GitHistory: a keyboard-navigable listbox that asks for the next page
// when it is scrolled to the end, or when the selection moves past the last row

import React, { useCallback, useEffect, useRef } from 'react';
import type { GitCommit } from './types';

// Distance from the bottom, in pixels, at which the next page is requested
const LOAD_MORE_THRESHOLD = 48;

export interface CommitListProps {
    commits: readonly GitCommit[];
    selectedSha: string | null;
    hasMore: boolean;
    loadingMore: boolean;
    /** Error of the last page request, shown under the rows */
    moreError: string | null;
    onSelect: (commit: GitCommit) => void;
    onLoadMore: () => void;
    formatDate: (iso: string) => string;
    labels: {
        commits: string;
        loadMore: string;
        loadingMore: string;
    };
}

export function CommitList({
    commits,
    selectedSha,
    hasMore,
    loadingMore,
    moreError,
    onSelect,
    onLoadMore,
    formatDate,
    labels,
}: CommitListProps): React.ReactElement {
    const listRef = useRef<HTMLDivElement>(null);
    const selectedIndex = commits.findIndex((c) => c.sha === selectedSha);
    const optionId = (sha: string): string => `git-history-commit-${sha}`;

    // Keep the selected row visible while moving through the list with the keyboard
    useEffect(() => {
        if (!selectedSha || !listRef.current) return;
        const row = listRef.current.querySelector<HTMLElement>(`[data-sha="${selectedSha}"]`);
        row?.scrollIntoView?.({ block: 'nearest' });
    }, [selectedSha]);

    const requestMore = useCallback(() => {
        if (hasMore && !loadingMore && !moreError) onLoadMore();
    }, [hasMore, loadingMore, moreError, onLoadMore]);

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD) requestMore();
        },
        [requestMore]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (commits.length === 0) return;
            let next = -1;
            if (e.key === 'ArrowDown') {
                if (selectedIndex >= commits.length - 1) requestMore();
                next = Math.min(selectedIndex + 1, commits.length - 1);
            } else if (e.key === 'ArrowUp') {
                next = Math.max(selectedIndex - 1, 0);
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
        [commits, selectedIndex, onSelect, requestMore]
    );

    return (
        <div className="git-history-commits" ref={listRef} onScroll={handleScroll}>
            <div
                className="git-history-commit-list"
                role="listbox"
                aria-label={labels.commits}
                tabIndex={0}
                aria-activedescendant={selectedSha ? optionId(selectedSha) : undefined}
                onKeyDown={handleKeyDown}
            >
                {commits.map((commit) => {
                    const selected = commit.sha === selectedSha;
                    return (
                        <div
                            key={commit.sha}
                            id={optionId(commit.sha)}
                            data-sha={commit.sha}
                            role="option"
                            aria-selected={selected}
                            className={`git-history-commit${selected ? ' is-selected' : ''}`}
                            onClick={() => onSelect(commit)}
                        >
                            <div className="git-history-commit-line">
                                <span className="git-history-commit-sha">{commit.shortSha}</span>
                                <span className="git-history-commit-subject" title={commit.subject}>
                                    {commit.subject}
                                </span>
                            </div>
                            <div className="git-history-commit-meta">
                                <span className="git-history-commit-author">{commit.author}</span>
                                <span aria-hidden="true"> · </span>
                                <span className="git-history-commit-date" title={commit.date}>
                                    {formatDate(commit.date)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {moreError && <div className="git-history-commits-error" role="alert">{moreError}</div>}
            {hasMore && (
                <button
                    type="button"
                    className="git-history-load-more"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                >
                    {loadingMore ? labels.loadingMore : labels.loadMore}
                </button>
            )}
        </div>
    );
}
