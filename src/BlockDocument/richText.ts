/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Pure helpers over RichText: link safety, normalisation, splitting and joining
// Nothing here touches the DOM; see richTextDom.ts for the editable side

import type { RichText, TextSpan } from './types';

const SAFE_PROTOCOL = /^(https?:|mailto:)/i;

/** The link target if it is http:, https: or mailto:, otherwise undefined */
export function safeHref(href: string | undefined | null): string | undefined {
    if (typeof href !== 'string') return undefined;
    const trimmed = href.trim();
    // Control characters and whitespace inside a scheme are how `java\tscript:` slips past a check
    if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;
    return SAFE_PROTOCOL.test(trimmed) ? trimmed : undefined;
}

function sameFormat(a: TextSpan, b: TextSpan): boolean {
    return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.code === !!b.code && a.href === b.href;
}

// Only the flags that are on, so equal formatting always serialises the same way
function cleanSpan(span: TextSpan): TextSpan {
    const out: TextSpan = { text: span.text };
    if (span.bold) out.bold = true;
    if (span.italic) out.italic = true;
    if (span.code) out.code = true;
    if (span.href) out.href = span.href;
    return out;
}

/** Drops empty spans and merges neighbours with the same formatting */
export function normalizeRichText(spans: RichText): RichText {
    const out: TextSpan[] = [];
    for (const span of spans) {
        if (!span.text) continue;
        const last = out[out.length - 1];
        if (last && sameFormat(last, span)) last.text += span.text;
        else out.push(cleanSpan(span));
    }
    return out;
}

/** The plain text of a rich text */
export function richTextToPlain(spans: RichText | undefined): string {
    return (spans ?? []).map((span) => span.text).join('');
}

/** Whether two rich texts show the same thing */
export function richTextEqual(a: RichText | undefined, b: RichText | undefined): boolean {
    const x = normalizeRichText(a ?? []);
    const y = normalizeRichText(b ?? []);
    return x.length === y.length && x.every((span, i) => span.text === y[i].text && sameFormat(span, y[i]));
}

/** Splits a rich text at a character offset, keeping the formatting on both sides */
export function splitRichText(spans: RichText, offset: number): [RichText, RichText] {
    const before: TextSpan[] = [];
    const after: TextSpan[] = [];
    let seen = 0;
    for (const span of spans) {
        const end = seen + span.text.length;
        if (end <= offset) before.push(span);
        else if (seen >= offset) after.push(span);
        else {
            before.push({ ...span, text: span.text.slice(0, offset - seen) });
            after.push({ ...span, text: span.text.slice(offset - seen) });
        }
        seen = end;
    }
    return [normalizeRichText(before), normalizeRichText(after)];
}

/** Joins two rich texts into one */
export function concatRichText(a: RichText, b: RichText): RichText {
    return normalizeRichText([...a, ...b]);
}

/** A rich text holding one plain run, or none when the text is empty */
export function plainToRichText(text: string): RichText {
    return text ? [{ text }] : [];
}
