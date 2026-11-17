/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for OpenPanel: actions through props, the recent list, filtering,
// missing items, the loading and empty states and home-path shortening; the optional parts of
// INT-009: the project button, the order of the buttons, the description, the menu, project items

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

describe('OpenPanel optional parts (INT-009)', () => {
    const PROJECT: OpenPanelRecentItem = { type: 'project', path: '/home/jan/acme/acme.cgproject.jsonc', name: 'ACME inventory' };

    it('renders none of the optional parts without their props', () => {
        const { container } = render(<OpenPanel recentItems={ITEMS} onOpenFile={vi.fn()} onOpenFolder={vi.fn()} />);
        expect(container.querySelector('.open-panel-description')).toBeNull();
        expect(container.querySelector('.open-panel-menu')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Open Project' })).not.toBeInTheDocument();
        const labels = [...container.querySelectorAll('.open-panel-btn')].map((button) => button.textContent);
        expect(labels).toEqual(['Open File', 'Open Folder']);
    });

    it('renders the project button with its text and keeps the order of actions', () => {
        const onOpenProject = vi.fn();
        const { container } = render(
            <OpenPanel
                recentItems={[]}
                onOpenFile={vi.fn()}
                onOpenFolder={vi.fn()}
                onOpenProject={onOpenProject}
                actions={['project', 'folder', 'file', 'project']}
                labels={{ openProject: 'Open Customer Project' }}
            />,
        );
        const labels = [...container.querySelectorAll('.open-panel-btn')].map((button) => button.textContent);
        expect(labels).toEqual(['Open Customer Project', 'Open Folder', 'Open File']);
        fireEvent.click(screen.getByRole('button', { name: 'Open Customer Project' }));
        expect(onOpenProject).toHaveBeenCalledOnce();
    });

    it('leaves out an action without its callback and a callback without its action', () => {
        const { container } = render(
            <OpenPanel recentItems={[]} onOpenFolder={vi.fn()} onOpenProject={vi.fn()} actions={['project', 'file']} />,
        );
        const labels = [...container.querySelectorAll('.open-panel-btn')].map((button) => button.textContent);
        expect(labels).toEqual(['Open Project']);
    });

    it('renders the description under the title, and nothing for an empty one', () => {
        const { container, rerender } = render(
            <OpenPanel recentItems={[]} labels={{ title: 'Start with a project', description: 'A project names the parts of one job.' }} />,
        );
        const description = container.querySelector('.open-panel-description');
        expect(description?.textContent).toBe('A project names the parts of one job.');
        expect(description?.previousElementSibling?.textContent).toBe('Start with a project');
        rerender(<OpenPanel recentItems={[]} labels={{ description: '' }} />);
        expect(container.querySelector('.open-panel-description')).toBeNull();
    });

    it('shows a project item with the project icon and opens it', () => {
        const onOpenRecent = vi.fn();
        const { container } = render(<OpenPanel recentItems={[PROJECT, ITEMS[0], ITEMS[1]]} onOpenRecent={onOpenRecent} />);
        const icons = [...container.querySelectorAll('.open-panel-recent-icon svg')].map((svg) => svg.querySelectorAll('path').length);
        // project: folder and diamond; folder: one path; file: two paths
        expect(icons).toEqual([2, 1, 2]);
        expect(container.querySelector('.open-panel-recent-icon svg path[fill="currentColor"]')).not.toBeNull();
        fireEvent.click(screen.getByText('ACME inventory'));
        expect(onOpenRecent).toHaveBeenCalledWith(PROJECT);
    });

    describe('menu', () => {
        function renderMenu() {
            const created = vi.fn();
            const fromTemplate = vi.fn();
            const view = render(
                <OpenPanel
                    recentItems={[]}
                    menuItems={[
                        { id: 'new', label: 'New Project…', onSelect: created },
                        { separator: true },
                        { id: 'template', label: 'Create Project from Template…', onSelect: fromTemplate, disabled: true },
                        { id: 'help', label: 'About Projects', onSelect: vi.fn() },
                    ]}
                />,
            );
            return { ...view, created, fromTemplate, button: screen.getByRole('button', { name: 'More actions' }) };
        }

        it('is not rendered without items or with separators only', () => {
            const { container, rerender } = render(<OpenPanel recentItems={[]} menuItems={[]} />);
            expect(container.querySelector('.open-panel-menu')).toBeNull();
            rerender(<OpenPanel recentItems={[]} menuItems={[{ separator: true }]} />);
            expect(container.querySelector('.open-panel-menu')).toBeNull();
        });

        it('opens on a click, selects an item and closes', () => {
            const { button, created } = renderMenu();
            expect(button).toHaveAttribute('aria-haspopup', 'menu');
            expect(button).toHaveAttribute('aria-expanded', 'false');
            fireEvent.click(button);
            expect(button).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
                'New Project…', 'Create Project from Template…', 'About Projects',
            ]);
            fireEvent.click(screen.getByRole('menuitem', { name: 'New Project…' }));
            expect(created).toHaveBeenCalledOnce();
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            expect(button).toHaveFocus();
        });

        it('moves with the arrows over the enabled items and skips the disabled one', () => {
            const { button, fromTemplate } = renderMenu();
            fireEvent.keyDown(button, { key: 'ArrowDown' });
            expect(screen.getByRole('menuitem', { name: 'New Project…' })).toHaveFocus();
            const menu = screen.getByRole('menu');
            fireEvent.keyDown(menu, { key: 'ArrowDown' });
            expect(screen.getByRole('menuitem', { name: 'About Projects' })).toHaveFocus();
            fireEvent.keyDown(menu, { key: 'ArrowDown' });
            expect(screen.getByRole('menuitem', { name: 'New Project…' })).toHaveFocus();
            fireEvent.keyDown(menu, { key: 'End' });
            expect(screen.getByRole('menuitem', { name: 'About Projects' })).toHaveFocus();
            fireEvent.keyDown(menu, { key: 'Home' });
            expect(screen.getByRole('menuitem', { name: 'New Project…' })).toHaveFocus();
            fireEvent.click(screen.getByRole('menuitem', { name: 'Create Project from Template…' }));
            expect(fromTemplate).not.toHaveBeenCalled();
        });

        it('selects with Enter, and closes with Escape or a click outside', () => {
            const { button, created } = renderMenu();
            fireEvent.keyDown(button, { key: 'ArrowUp' });
            expect(screen.getByRole('menuitem', { name: 'About Projects' })).toHaveFocus();
            fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            expect(button).toHaveFocus();

            fireEvent.keyDown(button, { key: 'Enter' });
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'New Project…' }), { key: 'Enter' });
            expect(created).toHaveBeenCalledOnce();

            fireEvent.click(button);
            fireEvent.mouseDown(document.body);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });
});

