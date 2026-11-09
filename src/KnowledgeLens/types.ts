/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions for KnowledgeLens: the RDF terms it reads, the projected graph it draws,
// the saved view layout and the message protocol between the host and the component

/** RDF term in the RDF/JS shape; N3.js quads satisfy it directly */
export interface RdfTerm {
    termType: 'NamedNode' | 'BlankNode' | 'Literal' | 'DefaultGraph' | 'Variable';
    value: string;
    /** Language tag of a literal, '' when none */
    language?: string;
    /** Datatype of a literal */
    datatype?: { value: string };
}

/** One triple; the graph part of a quad is ignored */
export interface RdfTriple {
    subject: RdfTerm;
    predicate: RdfTerm;
    object: RdfTerm;
}

/** Prefix name to namespace IRI, as declared by `@prefix` */
export type PrefixMap = Record<string, string>;

/** Result of parsing a Turtle document */
export type TurtleParseResult =
    | { ok: true; triples: RdfTriple[]; prefixes: PrefixMap; base?: string }
    | { ok: false; error: TurtleSyntaxError };

/** Syntax error with a 1-based line and column (column 0 when unknown) */
export interface TurtleSyntaxError {
    message: string;
    line: number;
    column: number;
}

/** Marker a flag predicate puts on a node */
export type NodeMarker = 'dashed';

/** Visual style of one class */
export interface ClassStyle {
    fill: string;
    border: string;
    shape?: 'round-rectangle' | 'rectangle' | 'ellipse' | 'hexagon' | 'diamond';
}

/** Value of an attribute shown in the property panel */
export type KnowledgeValue =
    | { kind: 'literal'; value: string; language: string; datatype: string }
    | { kind: 'iri'; iri: string; short: string; nodeId: string | null }
    | { kind: 'blank'; attributes: KnowledgeAttribute[] };

/** All values of one predicate on one subject */
export interface KnowledgeAttribute {
    predicate: string;
    /** Display name of the predicate */
    name: string;
    values: KnowledgeValue[];
}

/** Drawn node */
export interface KnowledgeNode {
    /** Subject IRI */
    id: string;
    /** Prefixed or base-relative IRI */
    short: string;
    /** Compact IRI for the box, e.g. `…/par_4/odst_1` */
    compact: string;
    /** Title from the label predicates in the chosen language, else the short IRI */
    title: string;
    /** Every rdf:type, in document order */
    types: string[];
    /** Class that sets the style, or '' for an untyped node */
    classIri: string;
    /** Literal and non-node values, grouped by predicate */
    attributes: KnowledgeAttribute[];
    /** Flag predicates set to true */
    flags: string[];
}

/** Drawn edge */
export interface KnowledgeEdge {
    id: string;
    source: string;
    target: string;
    predicate: string;
    label: string;
}

/** Entry of the class list and the legend */
export interface KnowledgeClassInfo {
    iri: string;
    name: string;
    /** Label in the chosen language, when the document has one */
    label?: string;
    count: number;
    style: ClassStyle;
}

/** Entry of the predicate and attribute lists */
export interface KnowledgePredicateInfo {
    iri: string;
    name: string;
    count: number;
}

/** Entry of the flag legend */
export interface KnowledgeFlagInfo {
    iri: string;
    name: string;
    marker: NodeMarker;
    count: number;
}

/** Header filled from the dataset or ontology description */
export interface KnowledgeHeader {
    title?: string;
    source?: string;
    /** IRI of the dataset subject */
    iri?: string;
}

/** Result of the projection */
export interface KnowledgeGraph {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    classes: KnowledgeClassInfo[];
    predicates: KnowledgePredicateInfo[];
    attributes: KnowledgePredicateInfo[];
    flags: KnowledgeFlagInfo[];
    header: KnowledgeHeader;
    /** Language tags found in title literals, sorted */
    languages: string[];
    /** Number of described subjects before the node limit */
    totalNodes: number;
    /** True when the node limit cut the graph */
    truncated: boolean;
}

/** Options of the projection */
export interface ProjectionOptions {
    prefixes?: PrefixMap;
    base?: string;
    /** Preferred language of titles; then `en`, then any */
    language?: string;
    /** Class IRI to style; classes left out get the automatic palette */
    classStyles?: Record<string, Partial<ClassStyle>>;
    /**
     * Predicate IRI to marker. Without it every predicate whose value is the boolean `true`
     * marks the node dashed
     */
    flagPredicates?: Record<string, NodeMarker>;
    /** Most nodes drawn; default 2000 */
    nodeLimit?: number;
    /** Automatic palette to use; default the light palette */
    palette?: ClassStyle[];
}

/** Layout algorithms offered in the toolbar */
export type KnowledgeLayoutAlgorithm = 'dagre' | 'cose' | 'breadthfirst';

/** View state saved next to the Turtle file, e.g. `sz-4.ttl.lens.json` */
export interface KnowledgeLensLayout {
    version: 1;
    /** Layout algorithm last chosen */
    layout?: KnowledgeLayoutAlgorithm;
    /** Node IRI to position */
    positions?: Record<string, { x: number; y: number }>;
    /** Classes turned off in the left panel */
    hiddenClasses?: string[];
    /** Predicates turned off in the left panel */
    hiddenPredicates?: string[];
    /** Attribute predicates shown as subtitle lines, in order */
    subtitleAttributes?: string[];
    /** Language of the titles */
    language?: string;
}

/** Options the host may send with the document */
export interface KnowledgeLensOptions {
    /** Language of the editor, used as the default title language */
    language?: string;
    classStyles?: ProjectionOptions['classStyles'];
    flagPredicates?: ProjectionOptions['flagPredicates'];
    nodeLimit?: number;
}

/** Selected element */
export interface KnowledgeSelectedElement {
    type: 'node' | 'edge';
    id: string;
}

/** Messages from the host to the component */
export type KnowledgeLensHostMessage =
    | {
          type: 'setTurtleData';
          text: string;
          fileName: string;
          options?: KnowledgeLensOptions;
          /** Saved view state, null or absent when there is none */
          layout?: KnowledgeLensLayout | null;
      }
    | { type: 'selectNode'; ids: string[] }
    | { type: 'layoutSaved' };

/** Messages from the component to the host */
export type KnowledgeLensMessage =
    | { type: 'ready' }
    | { type: 'selectionChanged'; elements: KnowledgeSelectedElement[] }
    | { type: 'openExternal'; iri: string }
    | { type: 'requestSave'; layout: KnowledgeLensLayout };
