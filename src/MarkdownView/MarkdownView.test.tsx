/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for MarkdownView: the GFM dialect, skipped raw HTML, links and anchors
// through props, image resolution, custom code blocks and heading slugs

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView, slugify } from './MarkdownView';

describe('MarkdownView', () => {
    it('renders headings, emphasis and lists', () => {
        const { container } = render(<MarkdownView source={'# Title\n\nSome **bold** text\n\n- one\n- two\n'} />);
        expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
        expect(container.querySelector('strong')).toHaveTextContent('bold');
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders GFM tables, task lists, strikethrough and autolinks', () => {
        const source = [
            '| Name | Value |',
            '| ---- | ----- |',
            '| a    | 1     |',
            '',
            '- [x] done',
            '- [ ] open',
            '',
            '~~gone~~ and https://example.com',
        ].join('\n');
        const { container } = render(<MarkdownView source={source} />);
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
        const boxes = screen.getAllByRole('checkbox');
        expect(boxes).toHaveLength(2);
        expect(boxes[0]).toBeChecked();
        expect(boxes[1]).not.toBeChecked();
        expect(container.querySelector('del')).toHaveTextContent('gone');
        expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
    });

    it('skips embedded raw HTML instead of rendering it', () => {
        const { container } = render(<MarkdownView source={'before\n\n<script>alert(1)</script>\n\n<b>raw</b> after'} />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
        expect(container).toHaveTextContent('after');
    });

    it('drops a javascript: link target', () => {
        render(<MarkdownView source={'[bad](javascript:alert(1))'} />);
        expect(screen.getByText('bad').closest('a')).toHaveAttribute('href', '');
    });

    it('hands a link to the host and never navigates by itself', () => {
        const onLinkClick = vi.fn();
        render(<MarkdownView source={'[docs](docs/readme.md) and [site](https://example.com)'} onLinkClick={onLinkClick} />);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        screen.getByRole('link', { name: 'docs' }).dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(onLinkClick).toHaveBeenCalledWith('docs/readme.md');
        fireEvent.click(screen.getByRole('link', { name: 'site' }));
        expect(onLinkClick).toHaveBeenLastCalledWith('https://example.com');
    });

    it('scrolls to a heading for an in-document anchor without calling the host', () => {
        const onLinkClick = vi.fn();
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        render(<MarkdownView source={'[jump](#open-questions)\n\n## Open questions\n'} onLinkClick={onLinkClick} />);
        fireEvent.click(screen.getByRole('link', { name: 'jump' }));
        expect(onLinkClick).not.toHaveBeenCalled();
        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Open questions' }));
    });

    it('gives headings GitHub-style ids, numbering repeats', () => {
        render(<MarkdownView source={'## Use case\n\n## Use case\n\n## Řešení: krok 1\n'} />);
        const headings = screen.getAllByRole('heading');
        expect(headings.map((h) => h.id)).toEqual(['use-case', 'use-case-1', 'řešení-krok-1']);
    });

    it('resolves image sources through the host', () => {
        render(<MarkdownView source={'![diagram](img/flow.png "Flow")'} resolveImage={(src) => `file:///docs/${src}`} />);
        const img = screen.getByRole('img', { name: 'diagram' });
        expect(img).toHaveAttribute('src', 'file:///docs/img/flow.png');
        expect(img).toHaveAttribute('title', 'Flow');
    });

    it('renders code blocks as <pre> by default and through renderCode when it answers', () => {
        const source = '```ts\nconst a = 1;\n```\n\n```\nplain\n```\n';
        const renderCode = vi.fn((code: string, language: string | undefined) =>
            language ? <div data-testid="custom">{`${language}:${code}`}</div> : undefined
        );
        const { container } = render(<MarkdownView source={source} renderCode={renderCode} />);
        expect(screen.getByTestId('custom')).toHaveTextContent('ts:const a = 1;');
        expect(renderCode).toHaveBeenCalledWith('plain', undefined);
        expect(container.querySelectorAll('pre')).toHaveLength(1);
        expect(container.querySelector('pre')).toHaveTextContent('plain');
    });

    it('adds the host class to the scroll container', () => {
        const { container } = render(<MarkdownView source="text" className="host-pane" />);
        expect(container.firstElementChild).toHaveClass('markdown-view', 'host-pane');
    });
});

describe('slugify', () => {
    it('follows the GitHub heading slug rules', () => {
        expect(slugify('Open questions')).toBe('open-questions');
        expect(slugify('  API: v2 (draft)  ')).toBe('api-v2-draft');
        expect(slugify('snake_case and-dash')).toBe('snake_case-and-dash');
    });
});
