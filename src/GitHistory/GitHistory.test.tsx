/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for GitHistory: loading, empty and error states, selection and its diff,
// paging, the follow toggle, keyboard navigation and late answers of a replaced source

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitHistory } from './GitHistory';
import type { GitCommit, GitHistorySource } from './types';

function commit(n: number): GitCommit {
    const sha = `${n}`.padStart(40, '0');
    return { sha, shortSha: sha.slice(-7), author: `Author ${n}`, date: '2026-01-01T10:00:00Z', subject: `Commit ${n}` };
}

const DIFF = ['diff --git a/f.ts b/f.ts', '--- a/f.ts', '+++ b/f.ts', '@@ -1 +1 @@', '-old line', '+new line'].join('\n');

function memorySource(total: number, overrides: Partial<GitHistorySource> = {}): GitHistorySource {
    const all = Array.from({ length: total }, (_, i) => commit(total - i));
    return {
        loadCommits: vi.fn(async ({ skip, limit }) => ({
            commits: all.slice(skip, skip + limit),
            hasMore: skip + limit < all.length,
        })),
        loadDiff: vi.fn(async () => DIFF),
        ...overrides,
    };
}

const fixedDate = (iso: string): string => `on ${iso.slice(0, 10)}`;

describe('GitHistory', () => {
    it('shows the loading state, then the commits with the first one selected and its diff', async () => {
        const source = memorySource(3);
        render(<GitHistory path="src/f.ts" branch="main" source={source} formatDate={fixedDate} />);
        expect(screen.getByText('Loading history...')).toBeInTheDocument();

        const options = await screen.findAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
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
        expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('loads the diff of a clicked commit and reports the selection', async () => {
        const source = memorySource(3);
        const onSelectCommit = vi.fn();
        render(<GitHistory path="f.ts" source={source} onSelectCommit={onSelectCommit} />);
        fireEvent.click((await screen.findAllByRole('option'))[2]);
        expect(onSelectCommit).toHaveBeenCalledWith(commit(1));
        await waitFor(() => expect(source.loadDiff).toHaveBeenLastCalledWith(commit(1)));
    });

    it('requests the next page with the loaded count as skip', async () => {
        const source = memorySource(5);
        render(<GitHistory path="f.ts" source={source} pageSize={2} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
        await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
        expect(source.loadCommits).toHaveBeenLastCalledWith({ follow: true, skip: 2, limit: 2 });
    });

    it('reloads without follow when the toggle is switched off', async () => {
        const source = memorySource(2);
        render(<GitHistory path="f.ts" source={source} />);
        const toggle = await screen.findByRole('button', { name: 'Follow renames' });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(toggle);
        await waitFor(() =>
            expect(source.loadCommits).toHaveBeenLastCalledWith({ follow: false, skip: 0, limit: 50 })
        );
    });

    it('moves the selection with the arrow keys and Home/End', async () => {
        render(<GitHistory path="f.ts" source={memorySource(3)} />);
        const list = await screen.findByRole('listbox');
        fireEvent.keyDown(list, { key: 'ArrowDown' });
        expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(list, { key: 'End' });
        expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(list, { key: 'Home' });
        expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('copies the selected commit through the host callback', async () => {
        const onCopySha = vi.fn();
        render(<GitHistory path="f.ts" source={memorySource(1)} onCopySha={onCopySha} />);
        await screen.findAllByRole('option');
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
        await screen.findAllByRole('option');
        resolveOld({ commits: [commit(7), commit(8)], hasMore: false });
        await Promise.resolve();
        expect(screen.getAllByRole('option')).toHaveLength(1);
    });
});
