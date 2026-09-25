/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// RichText to and from the DOM of a contentEditable element, and caret positions in it
// Nodes are built with createElement and text nodes only — never innerHTML

import { normalizeRichText, safeHref } from './richText';
import type { RichText, TextSpan } from './types';

type Format = Omit<TextSpan, 'text'>;

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** Replaces the content of `el` with the DOM for `spans` */
export function renderRichTextInto(el: HTMLElement, spans: RichText): void {
    const doc = el.ownerDocument;
    const nodes = normalizeRichText(spans).map((span) => {
        let node: Node = doc.createTextNode(span.text);
        const wrap = (tag: string): void => {
            const outer = doc.createElement(tag);
            outer.appendChild(node);
            node = outer;
        };
        if (span.code) wrap('code');
        if (span.italic) wrap('em');
        if (span.bold) wrap('strong');
        const href = safeHref(span.href);
        if (href) {
            wrap('a');
            (node as HTMLAnchorElement).setAttribute('href', href);
        }
        return node;
    });
    el.replaceChildren(...nodes);
}

function formatOf(el: HTMLElement, inherited: Format): Format {
    const next: Format = { ...inherited };
    const tag = el.tagName;
    // Browsers write <b>/<i> for Ctrl+B / Ctrl+I, and sometimes a styled <span>
    if (tag === 'B' || tag === 'STRONG' || el.style?.fontWeight === 'bold' || Number(el.style?.fontWeight) >= 600) {
        next.bold = true;
    }
    if (tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic') next.italic = true;
    if (tag === 'CODE') next.code = true;
    if (tag === 'A') {
        const href = safeHref(el.getAttribute('href'));
        if (href) next.href = href;
    }
    return next;
}

/** Reads the spans back from an element (or a fragment) the user has edited */
export function readRichTextFrom(root: Node): RichText {
    const out: TextSpan[] = [];
    const text = (): string => out.map((span) => span.text).join('');
    const walk = (node: Node, format: Format): void => {
        node.childNodes.forEach((child) => {
            if (child.nodeType === 3) {
                // The browser keeps typed spaces visible with no-break spaces
                out.push({ ...format, text: (child as Text).data.replace(/ /g, ' ') });
            } else if (child.nodeType === 1) {
                const el = child as HTMLElement;
                if (el.tagName === 'BR') {
                    out.push({ ...format, text: '\n' });
                    return;
                }
                if (BLOCK_TAGS.has(el.tagName) && text() && !text().endsWith('\n')) {
                    out.push({ ...format, text: '\n' });
                }
                walk(el, formatOf(el, format));
            }
        });
    };
    walk(root, {});
    // A trailing <br> is the placeholder a browser keeps in an otherwise empty line
    const last = root.lastChild;
    if (last && last.nodeType === 1 && (last as HTMLElement).tagName === 'BR') {
        const tail = out[out.length - 1];
        if (tail && tail.text === '\n') out.pop();
    }
    return normalizeRichText(out);
}

function lengthOf(spans: RichText): number {
    return spans.reduce((sum, span) => sum + span.text.length, 0);
}

/** The current selection range if it lies inside `root` */
export function selectionRangeIn(root: HTMLElement): Range | undefined {
    const selection = root.ownerDocument.defaultView?.getSelection();
    if (!selection || selection.rangeCount === 0) return undefined;
    const range = selection.getRangeAt(0);
    return root.contains(range.startContainer) ? range : undefined;
}

/** The character offset of the caret (the start of the selection) in `root` */
export function caretOffset(root: HTMLElement): number | undefined {
    const range = selectionRangeIn(root);
    if (!range) return undefined;
    const before = root.ownerDocument.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    return lengthOf(readRichTextFrom(before.cloneContents()));
}

/** The number of characters in `root` */
export function textLength(root: HTMLElement): number {
    return lengthOf(readRichTextFrom(root));
}

/** Puts the caret at a character offset in `root`; past the end means at the end */
export function placeCaret(root: HTMLElement, offset: number | 'start' | 'end'): void {
    const doc = root.ownerDocument;
    const selection = doc.defaultView?.getSelection();
    if (!selection) return;
    const range = doc.createRange();
    range.selectNodeContents(root);
    range.collapse(offset !== 'end');
    if (typeof offset === 'number') {
        let left = offset;
        const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const length = (node as Text).data.length;
            if (left <= length) {
                range.setStart(node, left);
                range.collapse(true);
                break;
            }
            left -= length;
        }
        if (left > 0) range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

/** Replaces the selection in `root` with plain text and leaves the caret after it */
export function insertPlainText(root: HTMLElement, text: string): void {
    const range = selectionRangeIn(root);
    if (!range) return;
    range.deleteContents();
    const node = root.ownerDocument.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const selection = root.ownerDocument.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

/**
 * Makes the given range a link to `href`, or — with no href — removes the link around
 * the range. A collapsed range inserts the address itself as the link text
 */
export function applyLink(root: HTMLElement, range: Range, href: string | undefined): void {
    const doc = root.ownerDocument;
    if (!href) {
        let node: Node | null = range.startContainer;
        while (node && node !== root) {
            if (node.nodeType === 1 && (node as HTMLElement).tagName === 'A') {
                const anchor = node as HTMLElement;
                anchor.replaceWith(...Array.from(anchor.childNodes));
                return;
            }
            node = node.parentNode;
        }
        return;
    }
    const anchor = doc.createElement('a');
    anchor.setAttribute('href', href);
    if (range.collapsed) anchor.textContent = href;
    else anchor.appendChild(range.extractContents());
    range.insertNode(anchor);
}
