/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Turtle parsing over N3.js: returns the triples, the declared prefixes and base,
// or a syntax error with a 1-based line and column instead of throwing

import { Parser } from 'n3';
import type { PrefixMap, RdfTriple, TurtleParseResult, TurtleSyntaxError } from './types';

/** Context N3.js attaches to a syntax error */
interface N3ErrorContext {
    line?: number;
    token?: { line?: number; start?: number };
}

/** Last `@base` / `BASE` declaration in the text, which N3.js does not report */
function findBase(text: string): string | undefined {
    const pattern = /(?:@base|\bBASE)\s*<([^>]*)>/gi;
    let base: string | undefined;
    for (const match of text.matchAll(pattern)) base = match[1];
    return base;
}

/** Turn an N3.js error into a line and column */
export function toSyntaxError(error: unknown, text: string): TurtleSyntaxError {
    const err = error as Error & { context?: N3ErrorContext };
    const message = (err?.message ?? String(error)).replace(/\s+on line \d+\.?$/, '');
    const lineMatch = /on line (\d+)/.exec(err?.message ?? '');
    const line = err?.context?.line ?? err?.context?.token?.line ?? (lineMatch ? Number(lineMatch[1]) : 0);
    let column = 0;
    const start = err?.context?.token?.start;
    if (typeof start === 'number') {
        column = start + 1;
    } else if (line > 0) {
        // Lexer errors quote the offending text; find it on its line
        const snippet = /Unexpected "([^"]{1,40})/.exec(err?.message ?? '')?.[1];
        const lineText = text.split(/\r?\n/)[line - 1] ?? '';
        const at = snippet ? lineText.indexOf(snippet) : -1;
        if (at >= 0) column = at + 1;
    }
    return { message, line, column };
}

/** Parse Turtle text; never throws */
export function parseTurtle(text: string, baseIRI?: string): TurtleParseResult {
    const parser = new Parser({ format: 'text/turtle', baseIRI });
    let prefixes: PrefixMap = {};
    try {
        const quads = parser.parse(text, null, (prefix: string, iri: { value: string } | string) => {
            prefixes = { ...prefixes, [prefix]: typeof iri === 'string' ? iri : iri.value };
        });
        return { ok: true, triples: quads as unknown as RdfTriple[], prefixes, base: findBase(text) ?? baseIRI };
    } catch (error) {
        return { ok: false, error: toSyntaxError(error, text) };
    }
}
