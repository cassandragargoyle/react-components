/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Reads the `#` comments of a Turtle text, which N3.js drops: the document comment before
// the first statement, and section comments with the subjects that follow them

/** Comment block between statements and the subjects it introduces */
export interface TurtleSection {
    /** 1-based line of the first comment line */
    line: number;
    /** Cleaned text; its first line is the title */
    text: string;
    /** Absolute IRIs of the subjects of the statements up to the next section */
    subjects: string[];
}

export interface TurtleComments {
    /** Cleaned comment before the first statement, or null when there is none */
    document: string | null;
    sections: TurtleSection[];
}

/** A line made only of frame characters, e.g. `=====` or `-----` */
const FRAME_LINE = /^[\s=\-*#~_]*$/;

/** Clean comment lines: drop `#` and one space, drop frame lines, trim blank edges */
export function cleanComment(lines: string[]): string {
    const out: string[] = [];
    for (const raw of lines) {
        const body = raw.replace(/^\s*#/, '').replace(/^ /, '').replace(/\s+$/, '');
        if (body !== '' && FRAME_LINE.test(body)) continue;
        out.push(body);
    }
    while (out.length > 0 && out[0] === '') out.shift();
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    // Collapse runs of blank lines left by removed frames
    return out.filter((l, i) => !(l === '' && out[i - 1] === '')).join('\n');
}

/** Resolve a subject token to an absolute IRI, or null for a blank node or an unknown prefix */
function resolveSubject(token: string, prefixes: Record<string, string>, base: string | undefined): string | null {
    if (token.startsWith('<') && token.endsWith('>')) {
        const iri = token.slice(1, -1);
        if (!base) return iri;
        try {
            return new URL(iri, base).href;
        } catch {
            return iri;
        }
    }
    if (token.startsWith('_:') || token.startsWith('[') || token.startsWith('(')) return null;
    const colon = token.indexOf(':');
    if (colon < 0) return null;
    const ns = prefixes[token.slice(0, colon)];
    if (ns === undefined) return null;
    // Local names may escape characters with a backslash
    return ns + token.slice(colon + 1).replace(/\\(.)/g, '$1');
}

/** Read a directive (`@prefix`, `@base`, `PREFIX`, `BASE`) into the prefix map or the base */
function readDirective(statement: string, prefixes: Record<string, string>, base: string | undefined): string | undefined {
    const prefix = /^(?:@prefix|PREFIX)\s+([^\s:]*):\s*<([^>]*)>/i.exec(statement);
    if (prefix) {
        prefixes[prefix[1]] = resolveSubject(`<${prefix[2]}>`, {}, base) ?? prefix[2];
        return base;
    }
    const baseMatch = /^(?:@base|BASE)\s*<([^>]*)>/i.exec(statement);
    if (baseMatch) return resolveSubject(`<${baseMatch[1]}>`, {}, base) ?? baseMatch[1];
    return base;
}

/**
 * Extract the comments of a Turtle text. A `#` inside an IRI or a string literal is not a
 * comment; a comment that is not at the start of a statement (after a triple on the same
 * line, or between predicates) is neither a document nor a section comment
 */
export function extractComments(text: string): TurtleComments {
    const prefixes: Record<string, string> = {};
    let base: string | undefined;

    const sections: TurtleSection[] = [];
    let documentLines: string[] | null = null;
    let seenStatement = false;
    // Comment lines met at a statement start, waiting for the statement they introduce
    let pending: string[] = [];
    let pendingLine = 0;

    let i = 0;
    let line = 1;
    // Line where the last statement ended; a comment on it is a trailing comment
    let lastEndLine = 0;
    const n = text.length;

    const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\r' || c === '\n';
    const advance = () => {
        if (text[i] === '\n') line += 1;
        i += 1;
    };

    /** Skip a string literal starting at i; handles long strings and escapes */
    const skipString = () => {
        const quote = text[i];
        const long = text.startsWith(quote.repeat(3), i);
        const close = long ? quote.repeat(3) : quote;
        for (let k = 0; k < close.length; k++) advance();
        while (i < n) {
            if (text[i] === '\\') {
                advance();
                advance();
                continue;
            }
            if (text.startsWith(close, i)) {
                for (let k = 0; k < close.length; k++) advance();
                return;
            }
            // A short string ends at the line end even when unterminated, so a broken file
            // does not swallow the rest
            if (!long && text[i] === '\n') return;
            advance();
        }
    };

    const skipIri = () => {
        while (i < n && text[i] !== '>' && text[i] !== '\n') advance();
        if (text[i] === '>') advance();
    };

    const skipComment = () => {
        while (i < n && text[i] !== '\n') advance();
    };

    while (i < n) {
        // At a statement start: collect comment lines, skip blanks
        const c = text[i];
        if (isSpace(c)) {
            advance();
            continue;
        }
        if (c === '#') {
            const start = i;
            const startLine = line;
            skipComment();
            if (startLine === lastEndLine) continue;
            if (pending.length === 0) pendingLine = startLine;
            pending.push(text.slice(start, i));
            continue;
        }

        // A statement starts here: read it to its terminating '.' at depth 0
        const statementStart = i;
        let depth = 0;
        let directiveWithoutDot = false;
        const head = text.slice(i, i + 7);
        if (/^(PREFIX|BASE)\b/i.test(head) && !head.startsWith('@')) directiveWithoutDot = true;

        while (i < n) {
            const ch = text[i];
            if (ch === '"' || ch === "'") {
                skipString();
                continue;
            }
            if (ch === '<') {
                skipIri();
                continue;
            }
            if (ch === '#') {
                // A comment inside a statement belongs to no section
                skipComment();
                continue;
            }
            if (directiveWithoutDot && ch === '\n') break;
            if (ch === '[' || ch === '(') depth += 1;
            else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
            else if (ch === '.' && depth === 0) {
                const next = text[i + 1];
                if (next === undefined || isSpace(next) || next === '#') {
                    advance();
                    break;
                }
            }
            advance();
        }

        lastEndLine = line;
        const statement = text.slice(statementStart, i).trim();
        const isDirective = /^(@prefix|@base|PREFIX|BASE)\b/i.test(statement);

        if (isDirective) {
            base = readDirective(statement, prefixes, base);
            // Comments before or between directives still belong to the document comment
            if (!seenStatement && pending.length > 0) {
                documentLines = [...(documentLines ?? []), ...(documentLines ? [''] : []), ...pending];
                pending = [];
            }
            continue;
        }

        if (!seenStatement) {
            seenStatement = true;
            if (pending.length > 0) {
                documentLines = [...(documentLines ?? []), ...(documentLines ? [''] : []), ...pending];
                pending = [];
            }
        } else if (pending.length > 0) {
            sections.push({ line: pendingLine, text: cleanComment(pending), subjects: [] });
            pending = [];
        }

        const subjectToken = /^(<[^>]*>|[^\s;,.[\]()]+(?:\.[^\s;,.[\]()]+)*)/.exec(statement)?.[1];
        const subject = subjectToken ? resolveSubject(subjectToken, prefixes, base) : null;
        const section = sections[sections.length - 1];
        if (subject && section && !section.subjects.includes(subject)) section.subjects.push(subject);
    }

    const document = documentLines ? cleanComment(documentLines) : '';
    return {
        document: document === '' ? null : document,
        sections: sections.filter((s) => s.text !== ''),
    };
}
