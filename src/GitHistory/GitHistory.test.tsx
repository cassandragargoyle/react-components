/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for GitHistory: states, selection, paging, follow, keyboard, late answers, and the
// rich view — graph, refs, author highlight, filter, row actions, tabs, folders, layout, windowing

import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { GitHistory } from './GitHistory';
import type { GitCommit, GitHistorySource } from './types';

function commit(n: number, extra: Partial<GitCommit> = {}): GitCommit {
    const sha = `${n}`.padStart(40, '0');
    return { sha, shortSha: sha.slice(-7), author: `Author ${n}`, date: '2026-01-01T10:00:00Z', subject: `Commit ${n}`, ...extra };
}

const DIFF = ['diff --git a/f.ts b/f.ts', '--- a/f.ts', '+++ b/f.ts', '@@ -1 +1 @@', '-old line', '+new line'].join('\n');

function memorySource(total: number, overrides: Partial<GitHistorySource> = {}, extra?: (n: number) => Partial<GitCommit>): GitHistorySource {
    const all = Array.from({ length: total }, (_, i) => commit(total - i, extra?.(total - i)));
    return {
        loadCommits: vi.fn(async ({ skip, limit }) => ({
            commits: all.slice(skip, skip + limit),
            hasMore: skip + limit < all.length,
        })),
        loadDiff: vi.fn(async () => DIFF),
        ...overrides,
    };
}

// A linear history with parents, so the graph is drawn
const withParents = (n: number): Partial<GitCommit> =>
    n > 1 ? { parents: [commit(n - 1).sha] } : { parents: [] };

const fixedDate = (iso: string): string => `on ${iso.slice(0, 10)}`;

const rows = (): HTMLElement[] => screen.getAllByRole('row').filter((r) => r.hasAttribute('data-sha'));
const findRows = async (): Promise<HTMLElement[]> => {
    await screen.findByRole('grid');
    return rows();
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GitHistory', () => {
    it('shows the loading state, then the commits with the first one selected and its diff', async () => {
        const source = memorySource(3);
        render(<GitHistory path="src/f.ts" branch="main" source={source} formatDate={fixedDate} />);
        expect(screen.getByText('Loading history...')).toBeInTheDocument();

        const list = await findRows();
        expect(list).toHaveLength(3);
        expect(list[0]).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('[main]')).toBeInTheDocument();
        expect(await screen.findByText('new line')).toBeInTheDocument();
        expect(source.loadDiff).toHaveBeenCalledWith(commit(3));
    });

    it('shows the empty state for a file without history', async () => {
        render(<GitHistory path="new.ts" source={memorySource(0)} />);
        expect(await screen.findByText('No history for this file')).toBeInTheDocument();
    });

    it('shows the error message of a rejected source', async () => {
        const source = memorySource(1, { loadCommits: vi.fn(async () => Promise.reject(new Error('git not found'))) });
        render(<GitHistory path="f.ts" source={source} />);
        expect(await screen.findByText('git not found')).toBeInTheDocument();
        expect(screen.getByText('Could not load the history')).toBeInTheDocument();
    });

    it('shows a diff error without losing the list', async () => {
        const source = memorySource(2, { loadDiff: vi.fn(async () => Promise.reject(new Error('bad object'))) });
        render(<GitHistory path="f.ts" source={source} />);
        expect(await screen.findByText('bad object')).toBeInTheDocument();
        expect(rows()).toHaveLength(2);
    });

    it('loads the diff of a clicked commit and reports the selection', async () => {
        const source = memorySource(3);
        const onSelectCommit = vi.fn();
        render(<GitHistory path="f.ts" source={source} onSelectCommit={onSelectCommit} />);
        fireEvent.click((await findRows())[2]);
        expect(onSelectCommit).toHaveBeenCalledWith(commit(1));
        await waitFor(() => expect(source.loadDiff).toHaveBeenLastCalledWith(commit(1)));
    });

    it('requests the next page with the loaded count as skip', async () => {
        const source = memorySource(5);
        render(<GitHistory path="f.ts" source={source} pageSize={2} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(source.loadCommits).toHaveBeenLastCalledWith({ follow: true, skip: 2, limit: 2 });
    });

    it('reloads without follow when the toggle is switched off', async () => {
        const source = memorySource(2);
        render(<GitHistory path="f.ts" source={source} />);
        const toggle = await screen.findByRole('button', { name: 'Follow renames' });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(toggle);
        await waitFor(() => expect(source.loadCommits).toHaveBeenLastCalledWith({ follow: false, skip: 0, limit: 50 }));
    });

    it('moves the selection with the arrow keys and Home/End', async () => {
        render(<GitHistory path="f.ts" source={memorySource(3)} />);
        await findRows();
        const grid = screen.getByRole('grid');
        fireEvent.keyDown(grid, { key: 'ArrowDown' });
        expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(grid, { key: 'End' });
        expect(rows()[2]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(grid, { key: 'Home' });
        expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('copies the selected commit through the host callback', async () => {
        const onCopySha = vi.fn();
        render(<GitHistory path="f.ts" source={memorySource(1)} onCopySha={onCopySha} />);
        await findRows();
        fireEvent.click(screen.getByRole('button', { name: 'Copy SHA' }));
        expect(onCopySha).toHaveBeenCalledWith(commit(1));
    });

    it('hides Copy SHA without a callback and accepts label overrides', async () => {
        render(<GitHistory path="f.ts" source={memorySource(0)} labels={{ empty: 'Nic' }} />);
        expect(await screen.findByText('Nic')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Copy SHA' })).not.toBeInTheDocument();
    });

    it('ignores a late answer of a replaced source', async () => {
        let resolveOld: (value: { commits: GitCommit[]; hasMore: boolean }) => void = () => {};
        const slow: GitHistorySource = {
            loadCommits: () => new Promise((resolve) => (resolveOld = resolve)),
            loadDiff: async () => '',
        };
        const { rerender } = render(<GitHistory path="old.ts" source={slow} />);
        rerender(<GitHistory path="new.ts" source={memorySource(1)} />);
        await findRows();
        resolveOld({ commits: [commit(7), commit(8)], hasMore: false });
        await Promise.resolve();
        expect(rows()).toHaveLength(1);
    });
});

describe('GitHistory rich view', () => {
    it('draws the graph only when every commit has parents', async () => {
        const { container, unmount } = render(<GitHistory path="f.ts" source={memorySource(3, {}, withParents)} />);
        await findRows();
        expect(container.querySelectorAll('svg.git-history-graph')).toHaveLength(3);
        unmount();
        const plain = render(<GitHistory path="f.ts" source={memorySource(3)} />);
        await findRows();
        expect(plain.container.querySelectorAll('svg.git-history-graph')).toHaveLength(0);
    });

    it('shows ref labels and folds the rest into +N', async () => {
        const refs = [
            { name: 'v1', kind: 'tag' as const },
            { name: 'origin/main', kind: 'remote' as const },
            { name: 'main', kind: 'head' as const },
            { name: 'dev', kind: 'branch' as const },
        ];
        render(<GitHistory path="f.ts" source={memorySource(1, {}, () => ({ refs }))} />);
        const [row] = await findRows();
        const labels = within(row).getAllByTitle(/./).filter((el) => el.classList.contains('git-history-ref'));
        expect(labels.map((el) => el.textContent)).toEqual(['main', 'dev', 'origin/main', '+1']);
        expect(row.querySelector('.git-history-ref.is-head')).not.toBeNull();
    });

    it('highlights the other commits of the selected commit’s author', async () => {
        const source = memorySource(3, {}, (n) => ({ author: n === 2 ? 'Other' : 'Same', authorEmail: n === 2 ? 'o@x.io' : 's@x.io' }));
        render(<GitHistory path="f.ts" source={source} />);
        const list = await findRows();
        expect(list[2]).toHaveClass('is-same-author');
        expect(list[1]).not.toHaveClass('is-same-author');
    });

    it('shows a status dot with a text alternative only when a commit has a status', async () => {
        render(<GitHistory path="f.ts" source={memorySource(2, {}, (n) => (n === 2 ? { status: 'failure' } : {}))} />);
        await findRows();
        expect(screen.getByRole('img', { name: 'Build failed' })).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader').map((h) => h.getAttribute('aria-label'))).toContain('Status');
    });

    it('filters the loaded commits and asks the host for an unloaded SHA', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const far = commit(99, { subject: 'Far away' });
        const findCommit = vi.fn(async () => far);
        render(<GitHistory path="f.ts" source={memorySource(3, { findCommit })} />);
        await findRows();
        const filter = screen.getByRole('searchbox', { name: 'Filter commits' });
        fireEvent.change(filter, { target: { value: 'commit 2' } });
        expect(rows()).toHaveLength(1);
        fireEvent.change(filter, { target: { value: 'abcdef1234' } });
        await vi.advanceTimersByTimeAsync(400);
        await waitFor(() => expect(findCommit).toHaveBeenCalledWith('abcdef1234'));
        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(rows()[0]).toHaveAttribute('data-sha', far.sha);
        vi.useRealTimers();
    });

    it('offers row actions through ⋯ and Shift+F10, and closes on Escape', async () => {
        const run = vi.fn();
        render(
            <GitHistory
                path="f.ts"
                source={memorySource(2)}
                commitActions={(c) => [{ id: 'copy', label: `Copy ${c.shortSha}`, run }]}
            />
        );
        const list = await findRows();
        fireEvent.click(within(list[1]).getByRole('button', { name: 'Commit actions' }));
        fireEvent.click(screen.getByRole('menuitem', { name: `Copy ${commit(1).shortSha}` }));
        expect(run).toHaveBeenCalledOnce();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        fireEvent.keyDown(screen.getByRole('grid'), { key: 'F10', shiftKey: true });
        const item = screen.getByRole('menuitem');
        expect(item).toHaveFocus();
        fireEvent.keyDown(item, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows the commit details and loads branches and tags lazily', async () => {
        let resolveDetails: (d: { branches: string[]; tags: string[]; describe?: { tag: string; distance: number } }) => void = () => {};
        const onOpenLink = vi.fn();
        const source = memorySource(2, {
            loadCommitDetails: () => new Promise((resolve) => (resolveDetails = resolve)),
        }, (n) => ({
            authorEmail: `a${n}@x.io`,
            body: 'Body line\n\nPartly fixes #12',
            parents: n > 1 ? [commit(n - 1).sha] : [],
        }));
        render(
            <GitHistory
                path="f.ts"
                source={source}
                onOpenLink={onOpenLink}
                linkify={() => [{ label: 'Issue 12', url: 'https://example.com/12' }]}
            />
        );
        await findRows();
        fireEvent.click(screen.getByRole('tab', { name: 'Commit' }));
        expect(screen.getByText(/Partly fixes #12/)).toBeInTheDocument();
        expect(screen.getByText('Loading branches and tags...')).toBeInTheDocument();
        resolveDetails({ branches: ['main'], tags: [], describe: { tag: 'v1.0', distance: 3 } });
        expect(await screen.findByText(/Contained in branches: main/)).toBeInTheDocument();
        expect(screen.getByText(/Contained in tags: none/)).toBeInTheDocument();
        expect(screen.getByText('v1.0')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Issue 12'));
        expect(onOpenLink).toHaveBeenCalledWith('https://example.com/12');
        fireEvent.click(screen.getByText('<a2@x.io>'));
        expect(onOpenLink).toHaveBeenCalledWith('mailto:a2@x.io');

        // The parent link selects the loaded parent
        fireEvent.click(screen.getByRole('button', { name: commit(1).sha.slice(0, 10) }));
        expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('switches the diff between unified and split', async () => {
        const { container } = render(<GitHistory path="f.ts" source={memorySource(1)} />);
        await screen.findByText('new line');
        fireEvent.click(screen.getByRole('button', { name: 'Split' }));
        expect(container.querySelector('.git-history-diff-table.is-split')).not.toBeNull();
        expect(screen.getByText('old line')).toBeInTheDocument();
    });

    it('treats a folder: no follow, no Diff tab, the Files tab scoped to the folder', async () => {
        const loadCommitFiles = vi.fn(async () => [
            { path: 'docs/readme.md', status: 'modified' as const, additions: 2, deletions: 1 },
            { path: 'src/a.ts', status: 'added' as const },
            { path: 'src/b.ts', status: 'modified' as const },
        ]);
        const source = memorySource(1, { loadCommitFiles });
        render(<GitHistory path="src" target="folder" source={source} />);
        await findRows();
        expect(screen.getByTitle('src/')).toHaveTextContent('src/');
        expect(screen.queryByRole('button', { name: 'Follow renames' })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Diff' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');

        const files = await screen.findAllByRole('option');
        expect(files.map((f) => f.textContent?.replace('\u200e', ''))).toEqual(['Asrc/a.ts', 'Msrc/b.ts']);
        await waitFor(() => expect(source.loadDiff).toHaveBeenLastCalledWith(commit(1), 'src/a.ts'));
        fireEvent.click(files[1]);
        await waitFor(() => expect(source.loadDiff).toHaveBeenLastCalledWith(commit(1), 'src/b.ts'));

        fireEvent.click(screen.getByRole('checkbox', { name: 'Show all 3 files of the commit' }));
        expect(screen.getAllByRole('option')).toHaveLength(3);
        expect(source.loadCommits).toHaveBeenCalledWith({ follow: false, skip: 0, limit: 50 });
    });

    it('moves between tabs with the arrow keys', async () => {
        render(<GitHistory path="f.ts" source={memorySource(1, { loadCommitFiles: async () => [] })} />);
        await findRows();
        const diffTab = screen.getByRole('tab', { name: 'Diff' });
        expect(diffTab).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(diffTab, { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(screen.getByRole('tab', { name: 'Files' }), { key: 'Home' });
        expect(screen.getByRole('tab', { name: 'Commit' })).toHaveAttribute('aria-selected', 'true');
    });

    it('reports layout changes from the toggle and the keyboard splitter', async () => {
        const onLayoutChange = vi.fn();
        render(<GitHistory path="f.ts" source={memorySource(1)} onLayoutChange={onLayoutChange} />);
        await findRows();
        fireEvent.click(screen.getByRole('button', { name: 'Show details beside the list' }));
        expect(onLayoutChange).toHaveBeenLastCalledWith({ orientation: 'horizontal', split: 0.45 });
        fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
        expect(onLayoutChange).toHaveBeenLastCalledWith({ orientation: 'horizontal', split: 0.5 });
    });

    it('renders only the visible rows of a long list', async () => {
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
            return this.classList.contains('git-history-commits') ? 260 : 0;
        });
        render(<GitHistory path="f.ts" source={memorySource(1000)} pageSize={1000} />);
        const list = await findRows();
        expect(list.length).toBeGreaterThan(0);
        expect(list.length).toBeLessThan(60);
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '1001');
    });
});
