/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the Turtle parser and the triple-to-graph projection of KnowledgeLens
// Runs the default rules on the sz-4.ttl sample and on small hand-written documents

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTurtle } from './parseTurtle';
import { defaultSubtitleAttributes, nodeSubtitles, projectGraph } from './projectGraph';
import { createIriShortener, humanize } from './iri';
import type { KnowledgeGraph } from './types';

const SAMPLE = readFileSync(resolve(__dirname, 'samples/sz-4.ttl'), 'utf8');

const SZ = 'https://example.org/stavebni-zakon/par-4#';
const LK = 'https://example.org/legal-knowledge#';
const BASE = 'https://e-sbirka.gov.cz/eli/cz/sb/2021/283/2026-06-11/dokument/norma/';

function project(text: string, language?: string): KnowledgeGraph {
    const parsed = parseTurtle(text);
    if (!parsed.ok) throw new Error(parsed.error.message);
    return projectGraph(parsed.triples, { prefixes: parsed.prefixes, base: parsed.base, language });
}

const PREFIXES = '@prefix ex: <http://ex.org/> . @prefix skos: <http://www.w3.org/2004/02/skos/core#> . '
    + '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix owl: <http://www.w3.org/2002/07/owl#> .\n';

describe('parseTurtle', () => {
    it('returns the prefixes and the base of the document', () => {
        const parsed = parseTurtle(SAMPLE);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.prefixes.sz).toBe(SZ);
        expect(parsed.base).toBe(BASE);
        expect(parsed.triples.length).toBeGreaterThan(100);
    });

    it('reports a syntax error with line and column', () => {
        const parsed = parseTurtle('<http://a> <http://b> <http://c> .\n    <http://d> <http://e> ;; .');
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        expect(parsed.error.line).toBe(2);
        expect(parsed.error.column).toBe(27);
        expect(parsed.error.message).not.toMatch(/on line/);
    });

    it('finds the column of a lexer error from the quoted text', () => {
        const parsed = parseTurtle('@prefix ex: <http://ex.org/> .\nex:a ex:b ?? .');
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        expect(parsed.error.line).toBe(2);
        expect(parsed.error.column).toBe(11);
    });
});

describe('projectGraph on sz-4.ttl', () => {
    const graph = project(SAMPLE, 'cs');
    const node = (id: string) => graph.nodes.find((n) => n.id === id);
    const edgesOf = (predicate: string) => graph.edges.filter((e) => e.predicate === predicate);

    it('draws the provisions, concepts, condition, references, verification and evidence', () => {
        const byClass = Object.fromEntries(graph.classes.map((c) => [c.name, c.count]));
        expect(byClass).toEqual({
            LegalResource: 2,
            LegalProvision: 7,
            LegalConcept: 10,
            LegalCondition: 1,
            LegalReference: 2,
            Verification: 1,
            Evidence: 2,
        });
        expect(graph.nodes).toHaveLength(25);
    });

    it('draws no node for a class, a property, the dataset or an external IRI', () => {
        expect(node(`${LK}LegalConcept`)).toBeUndefined();
        expect(node(`${LK}refersTo`)).toBeUndefined();
        expect(node(`${SZ}graf`)).toBeUndefined();
        expect(node('https://e-sbirka.gov.cz/czechvoc/POJMREJ/termin/281471')).toBeUndefined();
    });

    it('keeps literals and external IRIs as attributes', () => {
        const zamer = node(`${SZ}zamer`)!;
        expect(zamer.title).toBe('Záměr');
        const exactMatch = zamer.attributes.find((a) => a.name === 'exact match');
        expect(exactMatch?.values[0]).toMatchObject({ kind: 'iri', short: 'czv:281471', nodeId: null });
        const definition = zamer.attributes.find((a) => a.name === 'definition');
        expect(definition?.values[0]).toMatchObject({ kind: 'literal', language: 'cs' });
    });

    it('gives one broader edge per kind, also where only narrower is written', () => {
        const broader = edgesOf('http://www.w3.org/2004/02/skos/core#broader');
        const toZamer = broader.filter((e) => e.target === `${SZ}zamer`);
        // seven kinds plus záměr EIA
        expect(toZamer).toHaveLength(8);
        expect(edgesOf('http://www.w3.org/2004/02/skos/core#narrower')).toHaveLength(0);
    });

    it('labels edges in English from the local name', () => {
        const labels = new Set(graph.edges.map((e) => e.label));
        for (const label of ['broader', 'is part of', 'refers to', 'is subject to', 'applies to', 'is verified by', 'uses evidence']) {
            expect(labels).toContain(label);
        }
    });

    it('marks boolean true flags without configuration', () => {
        expect(graph.flags).toEqual([{ iri: `${LK}inferred`, name: 'inferred', marker: 'dashed', count: 3 }]);
        expect(node(`${SZ}overeniEIA`)!.flags).toEqual([`${LK}inferred`]);
        expect(node(`${SZ}zamer`)!.flags).toEqual([]);
    });

    it('lets the first specific type set the style', () => {
        expect(node(`${BASE}cast_1/hlava_2/par_4/odst_1`)!.classIri).toBe(`${LK}LegalProvision`);
    });

    it('fills the header from the dataset and gives each class its own colour', () => {
        expect(graph.header.title).toBe('Znalostní model § 4 zákona č. 283/2021 Sb.');
        expect(graph.header.source).toBe('https://e-sbirka.gov.cz/eli/cz/sb/2021/283/2026-06-11');
        expect(new Set(graph.classes.map((c) => c.style.border)).size).toBe(graph.classes.length);
    });

    it('shows a provision with its compact IRI when no attribute fits', () => {
        const odst1 = node(`${BASE}cast_1/hlava_2/par_4/odst_1`)!;
        expect(odst1.short).toBe('<cast_1/hlava_2/par_4/odst_1>');
        expect(nodeSubtitles(odst1, [])).toEqual(['…/par_4/odst_1']);
    });

    it('picks short attributes for the box by default', () => {
        const chosen = defaultSubtitleAttributes(graph);
        expect(chosen).toHaveLength(2);
        expect(chosen).toContain(`${LK}textLocation`);
        expect(chosen).not.toContain('http://purl.org/dc/terms/description');
    });
});

describe('projectGraph rules', () => {
    it('draws one edge for an owl:inverseOf pair', () => {
        const graph = project(`${PREFIXES}ex:hasPart owl:inverseOf ex:partOf .
            ex:a rdfs:label "A" ; ex:hasPart ex:b . ex:b rdfs:label "B" ; ex:partOf ex:a .`);
        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0]).toMatchObject({ source: 'http://ex.org/a', target: 'http://ex.org/b' });
    });

    it('draws one edge for a symmetric pair', () => {
        const graph = project(`${PREFIXES}ex:a rdfs:label "A" ; skos:related ex:b . ex:b rdfs:label "B" ; skos:related ex:a .`);
        expect(graph.edges).toHaveLength(1);
    });

    it('nests blank nodes under their parent', () => {
        const graph = project(`${PREFIXES}ex:a rdfs:label "A" ; ex:address [ ex:city "Brno" ; ex:zip "60200" ] .`);
        expect(graph.nodes).toHaveLength(1);
        const address = graph.nodes[0].attributes.find((a) => a.name === 'address')!;
        expect(address.values[0]).toMatchObject({ kind: 'blank' });
        const nested = address.values[0].kind === 'blank' ? address.values[0].attributes : [];
        expect(nested.map((a) => a.name)).toEqual(['city', 'zip']);
    });

    it('chooses the title in the wanted language, then English', () => {
        const text = `${PREFIXES}ex:a rdfs:label "Dům"@cs , "House"@en , "Haus"@de .`;
        expect(project(text, 'de').nodes[0].title).toBe('Haus');
        expect(project(text, 'fr').nodes[0].title).toBe('House');
        expect(project(text, 'cs-CZ').nodes[0].title).toBe('Dům');
        expect(project(text).languages).toEqual(['cs', 'de', 'en']);
    });

    it('names an edge by the English label of its predicate', () => {
        const graph = project(`${PREFIXES}ex:knows rdfs:label "is a friend of"@en , "zná"@cs .
            ex:a rdfs:label "A" ; ex:knows ex:b . ex:b rdfs:label "B" .`);
        expect(graph.edges[0].label).toBe('is a friend of');
        expect(graph.predicates).toEqual([{ iri: 'http://ex.org/knows', name: 'is a friend of', count: 1 }]);
    });

    it('cuts the graph at the node limit', () => {
        const nodes = Array.from({ length: 10 }, (_, i) => `ex:n${i} rdfs:label "N${i}" ; ex:next ex:n${i + 1} .`).join('\n');
        const parsed = parseTurtle(`${PREFIXES}${nodes}`);
        if (!parsed.ok) throw new Error(parsed.error.message);
        const graph = projectGraph(parsed.triples, { prefixes: parsed.prefixes, nodeLimit: 4 });
        expect(graph.nodes).toHaveLength(4);
        expect(graph.totalNodes).toBe(10);
        expect(graph.truncated).toBe(true);
        expect(graph.edges).toHaveLength(3);
    });

    it('applies a class style and flag predicates from the host', () => {
        const parsed = parseTurtle(`${PREFIXES}ex:a a ex:Thing ; ex:draft true ; ex:checked true .`);
        if (!parsed.ok) throw new Error(parsed.error.message);
        const graph = projectGraph(parsed.triples, {
            classStyles: { 'http://ex.org/Thing': { fill: '#000000' } },
            flagPredicates: { 'http://ex.org/draft': 'dashed' },
        });
        expect(graph.classes[0].style.fill).toBe('#000000');
        expect(graph.nodes[0].flags).toEqual(['http://ex.org/draft']);
    });
});

describe('iri helpers', () => {
    it('splits a local name into words', () => {
        expect(humanize('isSubjectTo')).toBe('is subject to');
        expect(humanize('is_part_of')).toBe('is part of');
        expect(humanize('zamerEIA')).toBe('zamer EIA');
    });

    it('prefers the longest matching namespace', () => {
        const s = createIriShortener({ a: 'http://x.org/', b: 'http://x.org/deep/' });
        expect(s.short('http://x.org/deep/thing')).toBe('b:thing');
        expect(s.short('http://x.org/thing')).toBe('a:thing');
        expect(s.short('http://other.org/x')).toBe('http://other.org/x');
        expect(s.compact('http://other.org/a/b/c')).toBe('…/b/c');
    });
});
