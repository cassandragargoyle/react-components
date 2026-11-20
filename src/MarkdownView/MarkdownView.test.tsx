/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for MarkdownView: the GFM dialect, skipped raw HTML, links and anchors
// through props, image resolution, custom code blocks and heading slugs

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView, findHeading, slugify } from './MarkdownView';

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
        // Not shown as escaped text either
        expect(container).not.toHaveTextContent('<script>');
        expect(container).not.toHaveTextContent('alert(1)');
        expect(container).not.toHaveTextContent('<b>');
    });

    it('drops a javascript: link target', () => {
        render(<MarkdownView source={'[bad](javascript:alert(1))'} />);
        expect(screen.getByText('bad').closest('a')).toHaveAttribute('href', '');
    });

    it('keeps a file: link only when the host lists the scheme', () => {
        const source = '[here](file:///tmp/a.md)';
        const { unmount } = render(<MarkdownView source={source} />);
        expect(screen.getByText('here').closest('a')).toHaveAttribute('href', '');
        unmount();
        const onLinkClick = vi.fn();
        render(<MarkdownView source={source} linkSchemes={['FILE']} onLinkClick={onLinkClick} />);
        fireEvent.click(screen.getByRole('link', { name: 'here' }));
        expect(onLinkClick).toHaveBeenCalledWith('file:///tmp/a.md');
    });

    it('drops javascript: and data: links even when the host lists them', () => {
        render(<MarkdownView source={'[a](javascript:alert(1)) [b](data:text/html,x)'} linkSchemes={['javascript', 'data']} />);
        expect(screen.getByText('a').closest('a')).toHaveAttribute('href', '');
        expect(screen.getByText('b').closest('a')).toHaveAttribute('href', '');
    });

    it('does not keep a listed scheme in an image source', () => {
        const { container } = render(<MarkdownView source={'![pic](file:///tmp/a.png)'} linkSchemes={['file']} />);
        expect(container.querySelector('img')?.getAttribute('src') ?? '').toBe('');
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

    it('an upper case anchor reaches the lower case heading id, as on GitHub', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        render(<MarkdownView source={'[jump](#Open-Questions)\n\n## Open questions\n'} />);
        fireEvent.click(screen.getByRole('link', { name: 'jump' }));
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Open questions' }));
    });

    it('a malformed anchor does nothing and throws no error', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const errors: unknown[] = [];
        const onError = (event: ErrorEvent) => errors.push(event.error);
        window.addEventListener('error', onError);
        render(<MarkdownView source={'[broken](#%E0)\n\n## Heading\n'} />);
        expect(() => fireEvent.click(screen.getByRole('link', { name: 'broken' }))).not.toThrow();
        window.removeEventListener('error', onError);
        expect(errors).toEqual([]);
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('findHeading: the exact id first, then the id in lower case, else nothing', () => {
        const root = document.createElement('div');
        root.innerHTML = '<h2 id="install">a</h2><h2 id="Setup">b</h2><h2 id="instalace-a-spuštění">c</h2>';
        expect(findHeading(root, 'install')?.textContent).toBe('a');
        expect(findHeading(root, 'Install')?.textContent).toBe('a');
        expect(findHeading(root, 'Setup')?.textContent).toBe('b');
        expect(findHeading(root, 'instalace-a-spuštění')?.textContent).toBe('c');
        expect(findHeading(root, 'missing')).toBeNull();
        expect(findHeading(root, '%E0')).toBeNull();
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
