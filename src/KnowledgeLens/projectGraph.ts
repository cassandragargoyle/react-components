/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Projection of RDF triples into a readable graph: types become styles, literals and
// external IRIs become attributes, vocabulary and dataset metadata are not drawn

import { createIriShortener, humanize, localName, WELL_KNOWN_PREFIXES } from './iri';
import { DARK_CLASS_PALETTE, LIGHT_CLASS_PALETTE, UNTYPED_STYLE } from './palette';
import type {
    ClassStyle,
    KnowledgeAttribute,
    KnowledgeClassInfo,
    KnowledgeEdge,
    KnowledgeFlagInfo,
    KnowledgeGraph,
    KnowledgeNode,
    KnowledgePredicateInfo,
    KnowledgeValue,
    NodeMarker,
    ProjectionOptions,
    RdfTerm,
    RdfTriple,
} from './types';

const RDF = WELL_KNOWN_PREFIXES.rdf;
const RDFS = WELL_KNOWN_PREFIXES.rdfs;
const OWL = WELL_KNOWN_PREFIXES.owl;
const XSD = WELL_KNOWN_PREFIXES.xsd;
const SKOS = WELL_KNOWN_PREFIXES.skos;
const DCTERMS = WELL_KNOWN_PREFIXES.dcterms;
const DC = WELL_KNOWN_PREFIXES.dc;

export const RDF_TYPE = `${RDF}type`;

/** Types whose subjects are vocabulary: they name classes and edges, they are not drawn */
export const VOCABULARY_TYPES = new Set([
    `${RDFS}Class`,
    `${RDFS}Datatype`,
    `${RDF}Property`,
    `${OWL}Class`,
    `${OWL}ObjectProperty`,
    `${OWL}DatatypeProperty`,
    `${OWL}AnnotationProperty`,
    `${OWL}OntologyProperty`,
    `${OWL}TransitiveProperty`,
    `${OWL}SymmetricProperty`,
    `${OWL}AsymmetricProperty`,
    `${OWL}FunctionalProperty`,
    `${OWL}InverseFunctionalProperty`,
    `${OWL}ReflexiveProperty`,
    `${OWL}IrreflexiveProperty`,
]);

/** Types whose subjects describe the document: they fill the header */
export const DATASET_TYPES = new Set([
    `${DCTERMS}Dataset`,
    `${OWL}Ontology`,
    `${WELL_KNOWN_PREFIXES.void}Dataset`,
    `${WELL_KNOWN_PREFIXES.dcat}Dataset`,
    `${WELL_KNOWN_PREFIXES.dcat}Catalog`,
]);

/** Types that never set the style when a more specific one is present */
const GENERIC_TYPES = new Set([`${OWL}Thing`, `${OWL}NamedIndividual`, `${RDFS}Resource`]);

/** Predicates giving the node title, in order of preference */
export const TITLE_PREDICATES = [
    `${SKOS}prefLabel`,
    `${RDFS}label`,
    `${DCTERMS}title`,
    `${DC}title`,
    `${WELL_KNOWN_PREFIXES.foaf}name`,
    `${WELL_KNOWN_PREFIXES.schema}name`,
];
const TITLE_SET = new Set(TITLE_PREDICATES);

/** Inverse pairs: the first predicate is drawn, the second is turned around into it */
const INVERSE_PAIRS: [string, string][] = [
    [`${SKOS}broader`, `${SKOS}narrower`],
    [`${SKOS}broaderTransitive`, `${SKOS}narrowerTransitive`],
    [`${SKOS}topConceptOf`, `${SKOS}hasTopConcept`],
    [`${DCTERMS}isPartOf`, `${DCTERMS}hasPart`],
    [`${DCTERMS}isReferencedBy`, `${DCTERMS}references`],
];

/** Symmetric predicates: `a p b` and `b p a` give one edge */
const SYMMETRIC_PREDICATES = new Set([
    `${SKOS}related`,
    `${SKOS}relatedMatch`,
    `${SKOS}exactMatch`,
    `${SKOS}closeMatch`,
    `${OWL}sameAs`,
]);

const DEFAULT_NODE_LIMIT = 2000;
/** Longest literal still shown in a box line */
const SHORT_VALUE = 40;
/** Deepest blank node nesting shown */
const MAX_BLANK_DEPTH = 4;

function termKey(term: RdfTerm): string {
    return term.termType === 'BlankNode' ? `_:${term.value}` : term.value;
}

/** Whether a literal is the boolean true */
function isTrueLiteral(term: RdfTerm): boolean {
    return term.termType === 'Literal'
        && term.datatype?.value === `${XSD}boolean`
        && (term.value === 'true' || term.value === '1');
}

/** Whether a language tag matches a wanted one by its primary subtag */
function languageMatches(tag: string, wanted: string): boolean {
    if (!wanted) return tag === '';
    const t = tag.toLowerCase();
    const w = wanted.toLowerCase();
    return t === w || t.split('-')[0] === w.split('-')[0];
}

/** Best literal of the given predicates: the language order outranks the predicate order */
export function pickLiteral(triples: RdfTriple[], predicates: string[], languages: string[]): string | undefined {
    const literals = triples.filter((t) => t.object.termType === 'Literal' && predicates.includes(t.predicate.value));
    if (literals.length === 0) return undefined;
    for (const lang of languages) {
        for (const p of predicates) {
            const hit = literals.find((t) => t.predicate.value === p && languageMatches(t.object.language ?? '', lang));
            if (hit) return hit.object.value;
        }
    }
    for (const p of predicates) {
        const hit = literals.find((t) => t.predicate.value === p);
        if (hit) return hit.object.value;
    }
    return undefined;
}

/** Language order for titles: chosen language, English, untagged, then anything */
function languageOrder(language?: string): string[] {
    const order: string[] = [];
    if (language) order.push(language);
    if (!order.some((l) => languageMatches('en', l))) order.push('en');
    order.push('');
    return order;
}

/** Text of a value for a box line or a table cell */
export function valueText(value: KnowledgeValue): string {
    switch (value.kind) {
        case 'literal':
            return value.value;
        case 'iri':
            return value.short;
        case 'blank':
            return '[…]';
    }
}

/** Shorten a literal for a box line */
function clip(text: string, max = SHORT_VALUE - 6): string {
    const single = text.replace(/\s+/g, ' ').trim();
    return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}

/** Subtitle lines of a node: the first value of each chosen attribute, at most two */
export function nodeSubtitles(node: KnowledgeNode, attributePredicates: string[], max = 2): string[] {
    const lines: string[] = [];
    for (const predicate of attributePredicates) {
        if (lines.length >= max) break;
        const attribute = node.attributes.find((a) => a.predicate === predicate);
        const value = attribute?.values[0];
        if (value && value.kind !== 'blank') lines.push(clip(valueText(value)));
    }
    if (lines.length === 0 && node.compact !== node.title) lines.push(node.compact);
    return lines;
}

/**
 * Attributes shown in the box by default: the two that most nodes carry with a short value,
 * never a title or a flag; an IRI value wins a tie
 */
export function defaultSubtitleAttributes(graph: KnowledgeGraph, max = 2): string[] {
    const flags = new Set(graph.flags.map((f) => f.iri));
    const scores = new Map<string, { short: number; total: number; iri: number }>();
    for (const node of graph.nodes) {
        for (const attribute of node.attributes) {
            if (TITLE_SET.has(attribute.predicate) || flags.has(attribute.predicate)) continue;
            const score = scores.get(attribute.predicate) ?? { short: 0, total: 0, iri: 0 };
            const first = attribute.values[0];
            score.total += 1;
            if (first?.kind === 'iri') {
                score.short += 1;
                score.iri += 1;
            } else if (first?.kind === 'literal' && first.value.length <= SHORT_VALUE) {
                score.short += 1;
            }
            scores.set(attribute.predicate, score);
        }
    }
    return [...scores.entries()]
        .filter(([, s]) => s.short > 0 && s.short * 2 >= s.total)
        .sort((a, b) => b[1].short - a[1].short || b[1].iri - a[1].iri)
        .slice(0, max)
        .map(([iri]) => iri);
}

/** Project triples into the graph KnowledgeLens draws */
export function projectGraph(triples: RdfTriple[], options: ProjectionOptions = {}): KnowledgeGraph {
    const shortener = createIriShortener(options.prefixes, options.base);
    const languages = languageOrder(options.language);
    const nodeLimit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;
    const palette = options.palette ?? LIGHT_CLASS_PALETTE;

    // Index the triples by subject, keeping document order
    const bySubject = new Map<string, RdfTriple[]>();
    const typesOf = new Map<string, string[]>();
    for (const t of triples) {
        if (t.subject.termType !== 'NamedNode' && t.subject.termType !== 'BlankNode') continue;
        const key = termKey(t.subject);
        let list = bySubject.get(key);
        if (!list) bySubject.set(key, (list = []));
        list.push(t);
        if (t.predicate.value === RDF_TYPE && t.object.termType === 'NamedNode') {
            const types = typesOf.get(key) ?? [];
            if (!types.includes(t.object.value)) types.push(t.object.value);
            typesOf.set(key, types);
        }
    }

    const isVocabulary = (key: string) => (typesOf.get(key) ?? []).some((c) => VOCABULARY_TYPES.has(c));
    const isDataset = (key: string) => (typesOf.get(key) ?? []).some((c) => DATASET_TYPES.has(c));

    // Inverse predicates: the built-in pairs, then owl:inverseOf from the document
    const inverseOf = new Map<string, string>();
    for (const [drawn, turned] of INVERSE_PAIRS) inverseOf.set(turned, drawn);
    for (const t of triples) {
        if (t.predicate.value !== `${OWL}inverseOf` || t.object.termType !== 'NamedNode') continue;
        const drawn = t.subject.value;
        const turned = t.object.value;
        if (!inverseOf.has(drawn) && !inverseOf.has(turned)) inverseOf.set(turned, drawn);
    }

    /** English label of a predicate or class, if the document gives one */
    const englishLabel = (iri: string): string | undefined => {
        const list = bySubject.get(iri);
        if (!list) return undefined;
        const literals = list.filter((t) => t.object.termType === 'Literal'
            && TITLE_SET.has(t.predicate.value)
            && languageMatches(t.object.language ?? '', 'en'));
        return literals[0]?.object.value;
    };
    const predicateNames = new Map<string, string>();
    const predicateName = (iri: string): string => {
        let name = predicateNames.get(iri);
        if (name === undefined) {
            name = englishLabel(iri) ?? humanize(localName(iri));
            predicateNames.set(iri, name);
        }
        return name;
    };

    // Described subjects become nodes, up to the limit
    const described: string[] = [];
    for (const key of bySubject.keys()) {
        if (key.startsWith('_:') || isVocabulary(key) || isDataset(key)) continue;
        described.push(key);
    }
    const drawn = described.slice(0, nodeLimit);
    const nodeIds = new Set(drawn);

    const isFlag = (predicate: string, object: RdfTerm): NodeMarker | null => {
        if (options.flagPredicates) {
            const marker = options.flagPredicates[predicate];
            return marker && isTrueLiteral(object) ? marker : null;
        }
        return isTrueLiteral(object) ? 'dashed' : null;
    };

    /** Values of the given triples, grouped by predicate; blank nodes nest */
    const collectAttributes = (
        list: RdfTriple[],
        depth: number,
        seen: Set<string>,
        skip: (t: RdfTriple) => boolean
    ): KnowledgeAttribute[] => {
        const byPredicate = new Map<string, KnowledgeAttribute>();
        for (const t of list) {
            if (skip(t)) continue;
            const o = t.object;
            let value: KnowledgeValue | null = null;
            if (o.termType === 'Literal') {
                value = { kind: 'literal', value: o.value, language: o.language ?? '', datatype: o.datatype?.value ?? '' };
            } else if (o.termType === 'NamedNode') {
                value = { kind: 'iri', iri: o.value, short: shortener.short(o.value), nodeId: nodeIds.has(o.value) ? o.value : null };
            } else if (o.termType === 'BlankNode') {
                const key = termKey(o);
                const nested = depth < MAX_BLANK_DEPTH && !seen.has(key)
                    ? collectAttributes(bySubject.get(key) ?? [], depth + 1, new Set([...seen, key]), () => false)
                    : [];
                value = { kind: 'blank', attributes: nested };
            }
            if (!value) continue;
            const p = t.predicate.value;
            let attribute = byPredicate.get(p);
            if (!attribute) byPredicate.set(p, (attribute = { predicate: p, name: predicateName(p), values: [] }));
            attribute.values.push(value);
        }
        return [...byPredicate.values()];
    };

    // Nodes and edge candidates
    const nodes: KnowledgeNode[] = [];
    const edgeKeys = new Set<string>();
    const edges: KnowledgeEdge[] = [];
    const flagCounts = new Map<string, { marker: NodeMarker; count: number }>();
    const titleLanguages = new Set<string>();

    for (const id of drawn) {
        const list = bySubject.get(id) ?? [];
        const types = typesOf.get(id) ?? [];
        const classIri = types.find((c) => !GENERIC_TYPES.has(c)) ?? types[0] ?? '';
        const flags: string[] = [];

        for (const t of list) {
            const p = t.predicate.value;
            if (t.object.termType === 'Literal') {
                if (TITLE_SET.has(p) && t.object.language) titleLanguages.add(t.object.language.toLowerCase());
                const marker = isFlag(p, t.object);
                if (marker && !flags.includes(p)) {
                    flags.push(p);
                    const entry = flagCounts.get(p) ?? { marker, count: 0 };
                    entry.count += 1;
                    flagCounts.set(p, entry);
                }
            } else if (t.object.termType === 'NamedNode' && p !== RDF_TYPE && nodeIds.has(t.object.value)) {
                // Edge: turn an inverse predicate around, merge symmetric pairs
                let source = id;
                let target = t.object.value;
                let predicate = p;
                const drawnPredicate = inverseOf.get(p);
                if (drawnPredicate) {
                    predicate = drawnPredicate;
                    [source, target] = [target, source];
                }
                const [a, b] = SYMMETRIC_PREDICATES.has(predicate) && source > target ? [target, source] : [source, target];
                const key = `${a}\u0000${predicate}\u0000${b}`;
                if (edgeKeys.has(key)) continue;
                edgeKeys.add(key);
                edges.push({ id: `e${edges.length}`, source, target, predicate, label: predicateName(predicate) });
            }
        }

        const attributes = collectAttributes(
            list,
            0,
            new Set(),
            (t) => t.predicate.value === RDF_TYPE || (t.object.termType === 'NamedNode' && nodeIds.has(t.object.value))
        );
        const short = shortener.short(id);
        nodes.push({
            id,
            short,
            compact: shortener.compact(id),
            title: pickLiteral(list, TITLE_PREDICATES, languages) ?? short,
            types,
            classIri,
            attributes,
            flags,
        });
    }

    // Classes in order of first use, each with its style
    const classCounts = new Map<string, number>();
    for (const node of nodes) classCounts.set(node.classIri, (classCounts.get(node.classIri) ?? 0) + 1);
    let paletteIndex = 0;
    const classes: KnowledgeClassInfo[] = [...classCounts.entries()].map(([iri, count]) => {
        if (!iri) {
            return { iri, name: '(untyped)', count, style: palette === DARK_CLASS_PALETTE ? UNTYPED_STYLE.dark : UNTYPED_STYLE.light };
        }
        const auto: ClassStyle = palette[paletteIndex++ % palette.length];
        const override = options.classStyles?.[iri];
        const classTriples = bySubject.get(iri) ?? [];
        return {
            iri,
            name: englishLabel(iri) ?? localName(iri),
            label: pickLiteral(classTriples, TITLE_PREDICATES, languages),
            count,
            style: { ...auto, ...override },
        };
    });

    // Predicates drawn as edges, and attribute predicates, with counts
    const edgeCounts = new Map<string, number>();
    for (const edge of edges) edgeCounts.set(edge.predicate, (edgeCounts.get(edge.predicate) ?? 0) + 1);
    const predicates: KnowledgePredicateInfo[] = [...edgeCounts.entries()]
        .map(([iri, count]) => ({ iri, name: predicateName(iri), count }));

    const attributeCounts = new Map<string, number>();
    for (const node of nodes) {
        for (const attribute of node.attributes) {
            attributeCounts.set(attribute.predicate, (attributeCounts.get(attribute.predicate) ?? 0) + 1);
        }
    }
    const attributes: KnowledgePredicateInfo[] = [...attributeCounts.entries()]
        .map(([iri, count]) => ({ iri, name: predicateName(iri), count }));

    const flags: KnowledgeFlagInfo[] = [...flagCounts.entries()]
        .map(([iri, { marker, count }]) => ({ iri, name: predicateName(iri), marker, count }));

    // Header from the first dataset or ontology subject
    const datasetKey = [...bySubject.keys()].find(isDataset);
    const header = datasetKey
        ? (() => {
              const list = bySubject.get(datasetKey) ?? [];
              const source = list.find((t) => t.predicate.value === `${DCTERMS}source`)?.object;
              return {
                  iri: datasetKey,
                  title: pickLiteral(list, TITLE_PREDICATES, languages),
                  source: source?.value,
              };
          })()
        : {};

    return {
        nodes,
        edges,
        classes,
        predicates,
        attributes,
        flags,
        header,
        languages: [...titleLanguages].sort(),
        totalNodes: described.length,
        truncated: described.length > drawn.length,
    };
}
