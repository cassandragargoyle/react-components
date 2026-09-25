/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for OpenPanel: actions through props, the recent list, filtering,
// missing items, the loading and empty states and home-path shortening

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpenPanel, shortenHomePath, type OpenPanelRecentItem } from './OpenPanel';

const ITEMS: OpenPanelRecentItem[] = [
    { type: 'folder', path: '/home/jan/projects/alpha', name: 'alpha' },
    { type: 'file', path: '/home/jan/notes/todo.md', name: 'todo.md' },
    { type: 'folder', path: '/home/jan/projects/beta', name: 'beta', exists: false },
    { type: 'file', path: '/home/jan/docs/report.pdf', name: 'report.pdf' },
];

describe('OpenPanel', () => {
    it('shows only the action buttons that have a handler', () => {
        const onOpenFile = vi.fn();
        render(<OpenPanel recentItems={[]} onOpenFile={onOpenFile} />);
        fireEvent.click(screen.getByRole('button', { name: 'Open File' }));
        expect(onOpenFile).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', { name: 'Open Folder' })).not.toBeInTheDocument();
    });

    it('shows the empty state, or the loading state while the list is pending', () => {
        const { rerender } = render(<OpenPanel recentItems={[]} />);
        expect(screen.getByText('No recently opened files or folders')).toBeInTheDocument();
        rerender(<OpenPanel recentItems={[]} loading />);
        expect(screen.getByText('Loading recent items...')).toBeInTheDocument();
        expect(screen.queryByText('No recently opened files or folders')).not.toBeInTheDocument();
    });

    it('opens a recent item with the item itself and shortens its path', () => {
        const onOpenRecent = vi.fn();
        render(<OpenPanel recentItems={ITEMS} onOpenRecent={onOpenRecent} />);
        expect(screen.getByText('~/projects/alpha')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('/home/jan/projects/alpha'));
        expect(onOpenRecent).toHaveBeenCalledWith(ITEMS[0]);
    });

    it('disables a missing item and marks it Not found', () => {
        const onOpenRecent = vi.fn();
        render(<OpenPanel recentItems={ITEMS} onOpenRecent={onOpenRecent} />);
        const row = screen.getByTitle('/home/jan/projects/beta (not found)');
        expect(row).toBeDisabled();
        expect(screen.getByText('Not found')).toBeInTheDocument();
        fireEvent.click(row);
        expect(onOpenRecent).not.toHaveBeenCalled();
    });

    it('filters by name and path above the threshold only', () => {
        const { rerender } = render(<OpenPanel recentItems={ITEMS.slice(0, 3)} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        rerender(<OpenPanel recentItems={ITEMS} />);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'PROJECTS' } });
        expect(screen.getByText('alpha')).toBeInTheDocument();
        expect(screen.queryByText('todo.md')).not.toBeInTheDocument();

        fireEvent.change(input, { target: { value: 'nothing-like-this' } });
        expect(screen.getByText('No matching items')).toBeInTheDocument();
    });

    it('focuses the filter on / pressed outside an input', () => {
        const { container } = render(<OpenPanel recentItems={ITEMS} />);
        fireEvent.keyDown(container.querySelector('.open-panel')!, { key: '/' });
        expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('shows Clear Recent only with a handler and accepts label overrides', () => {
        const onClearRecent = vi.fn();
        const { rerender } = render(<OpenPanel recentItems={ITEMS} />);
        expect(screen.queryByRole('button', { name: 'Clear Recent' })).not.toBeInTheDocument();

        rerender(
            <OpenPanel recentItems={ITEMS} onClearRecent={onClearRecent} labels={{ clearRecent: 'Forget all' }} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Forget all' }));
        expect(onClearRecent).toHaveBeenCalledOnce();
    });
});

describe('shortenHomePath', () => {
    it.each([
        ['/home/jan/a/b', '~/a/b'],
        ['/Users/jan/a', '~/a'],
        ['C:\\Users\\jan\\a', '~\\a'],
        ['/opt/tool', '/opt/tool'],
    ])('%s → %s', (input, expected) => {
        expect(shortenHomePath(input)).toBe(expected);
    });
});
