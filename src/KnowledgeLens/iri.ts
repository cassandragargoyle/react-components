/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// IRI helpers for KnowledgeLens: shortening with the document prefixes and base,
// the compact form shown in a box, and turning a local name into words

import type { PrefixMap } from './types';

/** Common vocabularies, used when the document does not declare them */
export const WELL_KNOWN_PREFIXES: PrefixMap = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    dcterms: 'http://purl.org/dc/terms/',
    dc: 'http://purl.org/dc/elements/1.1/',
    foaf: 'http://xmlns.com/foaf/0.1/',
    schema: 'https://schema.org/',
    void: 'http://rdfs.org/ns/void#',
    dcat: 'http://www.w3.org/ns/dcat#',
    prov: 'http://www.w3.org/ns/prov#',
};

/** Shortens IRIs with the prefixes and the base of one document */
export interface IriShortener {
    /** `prefix:local`, `<relative>` against the base, or the full IRI */
    short(iri: string): string;
    /** Box form: `prefix:local`, or the last two path segments after `…/` */
    compact(iri: string): string;
}

/** Local name: the part after the last `#`, `/` or `:` */
export function localName(iri: string): string {
    const match = /[^#/:]+$/.exec(iri.replace(/[#/]+$/, ''));
    return match ? match[0] : iri;
}

/** Turn a local name into words: `isSubjectTo` → "is subject to", `is_part_of` → "is part of" */
export function humanize(name: string): string {
    const words = name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_\-.]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    // Keep acronyms (EIA, IRI) as written, lower the rest
    return words.map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(' ');
}

/** Whether a prefixed local part can be written without escapes */
function isSafeLocal(local: string): boolean {
    return /^[\p{L}\p{N}_][\p{L}\p{N}_\-.]*$/u.test(local) && !local.endsWith('.');
}

export function createIriShortener(prefixes: PrefixMap = {}, base?: string): IriShortener {
    // Document prefixes first; a well-known one only when its name and namespace are free
    const entries: [string, string][] = Object.entries(prefixes);
    const namespaces = new Set(entries.map(([, ns]) => ns));
    for (const [name, ns] of Object.entries(WELL_KNOWN_PREFIXES)) {
        if (!(name in prefixes) && !namespaces.has(ns)) entries.push([name, ns]);
    }
    // Longest namespace wins, so `…/termin/` beats `…/`
    entries.sort((a, b) => b[1].length - a[1].length);

    const cache = new Map<string, string>();

    function prefixed(iri: string): string | null {
        for (const [name, ns] of entries) {
            if (!ns || !iri.startsWith(ns)) continue;
            const local = iri.slice(ns.length);
            if (local === '' || isSafeLocal(local)) return `${name}:${local}`;
        }
        return null;
    }

    function relative(iri: string): string | null {
        if (!base || !iri.startsWith(base) || iri.length === base.length) return null;
        return iri.slice(base.length);
    }

    return {
        short(iri) {
            const cached = cache.get(iri);
            if (cached !== undefined) return cached;
            const p = prefixed(iri);
            const rel = p ? null : relative(iri);
            const result = p ?? (rel !== null ? `<${rel}>` : iri);
            cache.set(iri, result);
            return result;
        },
        compact(iri) {
            const p = prefixed(iri);
            if (p) return p;
            const path = relative(iri) ?? iri.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\/?/i, '');
            const segments = path.split('/').filter(Boolean);
            if (segments.length <= 2) return segments.join('/') || iri;
            return `…/${segments.slice(-2).join('/')}`;
        },
    };
}
