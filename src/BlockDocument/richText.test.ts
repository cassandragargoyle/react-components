/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for RichText helpers and its DOM round trip (INT-001)
// Links are limited to http, https and mailto; markup never becomes HTML

import { describe, expect, it } from 'vitest';

import { concatRichText, normalizeRichText, richTextEqual, safeHref, splitRichText } from './richText';
import { applyLink, caretOffset, placeCaret, readRichTextFrom, renderRichTextInto } from './richTextDom';
import type { RichText } from './types';

describe('safeHref', () => {
    it.each(['https://example.com', 'http://x.cz/a?b=1', 'mailto:a@b.cz', ' HTTPS://X '])('allows %s', (href) => {
        expect(safeHref(href)).toBe(href.trim());
    });

    it.each(['javascript:alert(1)', 'JavaScript:x', 'java\tscript:x', 'data:text/html,x', 'vbscript:x', '/relative', '', undefined])(
        'refuses %s',
        (href) => {
            expect(safeHref(href)).toBeUndefined();
        },
    );
});

describe('normalizeRichText / split / concat', () => {
    it('merges neighbours with the same format and drops empty spans', () => {
        expect(normalizeRichText([{ text: 'a' }, { text: '' }, { text: 'b', bold: false }, { text: 'c', bold: true }])).toEqual([
            { text: 'ab' },
            { text: 'c', bold: true },
        ]);
    });

    it('splits inside a span and keeps the format on both sides', () => {
        const text: RichText = [{ text: 'Hello ' }, { text: 'bold', bold: true }];
        expect(splitRichText(text, 8)).toEqual([
            [{ text: 'Hello ' }, { text: 'bo', bold: true }],
            [{ text: 'ld', bold: true }],
        ]);
        expect(splitRichText(text, 0)).toEqual([[], text]);
        expect(splitRichText(text, 10)).toEqual([text, []]);
    });

    it('joins two texts back', () => {
        const [a, b] = splitRichText([{ text: 'abcd', italic: true }], 2);
        expect(concatRichText(a, b)).toEqual([{ text: 'abcd', italic: true }]);
    });
});

describe('the DOM round trip', () => {
    const text: RichText = [
        { text: 'plain ' },
        { text: 'bold', bold: true },
        { text: ' ' },
        { text: 'it', italic: true },
        { text: ' ' },
        { text: 'K3', code: true },
        { text: ' ' },
        { text: 'link', href: 'https://example.com' },
    ];

    it('renders spans and reads the same spans back', () => {
        const el = document.createElement('div');
        renderRichTextInto(el, text);
        expect(el.querySelector('strong')?.textContent).toBe('bold');
        expect(el.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
        expect(readRichTextFrom(el)).toEqual(text);
    });

    it('never writes markup from the text into the DOM', () => {
        const el = document.createElement('div');
        renderRichTextInto(el, [{ text: '<img src=x onerror=alert(1)>' }]);
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('drops an unsafe link but keeps its text', () => {
        const el = document.createElement('div');
        renderRichTextInto(el, [{ text: 'x', href: 'javascript:alert(1)' }]);
        expect(el.querySelector('a')).toBeNull();
        const edited = document.createElement('div');
        const a = document.createElement('a');
        a.setAttribute('href', 'javascript:alert(1)');
        a.textContent = 'x';
        edited.appendChild(a);
        expect(readRichTextFrom(edited)).toEqual([{ text: 'x' }]);
    });

    it('reads what browsers write: <b>, <i>, <br>, no-break spaces', () => {
        const el = document.createElement('div');
        el.append('a ', Object.assign(document.createElement('b'), { textContent: 'b' }));
        el.append(document.createElement('br'), Object.assign(document.createElement('i'), { textContent: 'c' }));
        expect(readRichTextFrom(el)).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: '\n' }, { text: 'c', italic: true }]);
    });

    it('places the caret and reads its offset across formatted runs', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        renderRichTextInto(el, text);
        placeCaret(el, 8);
        expect(caretOffset(el)).toBe(8);
        placeCaret(el, 'end');
        expect(caretOffset(el)).toBe(readRichTextFrom(el).reduce((n, s) => n + s.text.length, 0));
        el.remove();
    });

    it('wraps a range in a link and removes it again', () => {
        const el = document.createElement('div');
        renderRichTextInto(el, [{ text: 'see the manual' }]);
        const range = document.createRange();
        range.setStart(el.firstChild!, 8);
        range.setEnd(el.firstChild!, 14);
        applyLink(el, range, 'https://example.com');
        expect(richTextEqual(readRichTextFrom(el), [{ text: 'see the ' }, { text: 'manual', href: 'https://example.com' }])).toBe(true);

        const inside = document.createRange();
        inside.setStart(el.querySelector('a')!.firstChild!, 2);
        applyLink(el, inside, undefined);
        expect(readRichTextFrom(el)).toEqual([{ text: 'see the manual' }]);
    });
});
