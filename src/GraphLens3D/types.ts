/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions and helpers for the GraphLens 3D viewer components
// The graph shape the viewer renders (meta + nodes + links) and UI selection/coloring utilities

/** Graph the viewer renders: nodes and links with optional document metadata */
export interface GraphLensDocument {
    /** Optional document format version (semver), independent of the schema version */
    version?: string;
    /** Optional document metadata (title shown in header) */
    meta?: GraphLensMeta;
    /** Node definitions */
    nodes: GraphLensNode[];
    /** Link definitions (note: links, not edges) */
    links: GraphLensLink[];
}

/** Free-form document metadata; `title` is the known key, others are allowed */
export interface GraphLensMeta {
    /** Document title */
    title?: string;
    [key: string]: unknown;
}

/** Single node in the graph */
export interface GraphLensNode {
    /** Unique node identifier, referenced by link.source and link.target */
    id: string;
    /** Node kind, e.g. 'tag' or 'voice' (drives coloring) */
    type: string;
    /** Display label */
    label: string;
    /** Voice subtype for voice nodes, e.g. 'VoC' */
    voice?: string;
    /** Optional title shown in the detail panel */
    title?: string;
    /** Optional long-form description */
    description?: string;
    /** Arbitrary free-form metadata shown in the detail panel */
    meta?: Record<string, unknown>;
}

/** Single link between two nodes */
export interface GraphLensLink {
    /** Source node id (string in the source document; resolved to a node by the renderer) */
    source: string;
    /** Target node id */
    target: string;
    /** Optional human-readable description */
    description?: string;
    /** Optional relation kind, e.g. 'related' */
    rel?: string;
}

/** Current selection — either a node or a link */
export type GraphLensSelection =
    | { kind: 'node'; id: string }
    | { kind: 'link'; source: string; target: string };

/** Node table filter mode */
export type TableFilter = 'all' | 'selected';

/** Where the viewer is sourcing its document from */
export type GraphLensSource = 'standalone' | 'webview' | 'electron' | 'unknown';

/** Progress phase while the document is being loaded */
export type GraphLensPhase = 'detecting' | 'connecting' | 'receiving';

/** Detailed load status shown before the document arrives */
export interface GraphLensStatus {
    /** Resolved data source / runtime */
    source: GraphLensSource;
    /** Current progress phase */
    phase: GraphLensPhase;
    /** Human-readable description of the current action */
    message: string;
    /** When set, the current phase is rendered as failed and this is shown */
    error?: string;
    /** Optional recovery hint shown under an error */
    hint?: string;
}

/**
 * Resolve a link endpoint to its node id. The 3d-force-graph engine mutates
 * link endpoints from string ids into node object references after layout, so
 * accept both forms.
 */
export function endId(value: unknown): string {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
        return String((value as { id: unknown }).id);
    }
    return String(value);
}

/** Build a stable key for a link from its endpoints (order-sensitive) */
export function linkKey(source: unknown, target: unknown): string {
    return JSON.stringify([endId(source), endId(target)]);
}

// Node palette — tags are gold hubs; voices are colored by their VoX type
export const VOICE_COLORS: Record<string, string> = {
    VoB: '#58a6ff', // business — blue
    VoC: '#3fb950', // customer — green
    VoS: '#f85149', // standards/legal — red
    VoE: '#bc8cff', // engineering — purple
};
export const TAG_COLOR = '#d29922'; // gold
export const DEFAULT_NODE_COLOR = '#8b949e';

// Link palette
export const HUB_LINK_COLOR = '#9aa4af'; // hub -> voice (grey, straight)
export const RELATED_LINK_COLOR = '#fb923c'; // voice <-> voice "related" (orange, curved)

/** Grouping key for stats/filters: a voice's VoX type, or 'tag' */
export function kindOf(node: GraphLensNode): string {
    return node.type === 'tag' ? 'tag' : node.voice || 'voice';
}

/** Swatch/render color for a grouping kind (as produced by kindOf) */
export function kindColor(kind: string): string {
    if (kind === 'tag') return TAG_COLOR;
    return VOICE_COLORS[kind] || DEFAULT_NODE_COLOR;
}

/** Color for a node by its kind */
export function nodeKindColor(node: GraphLensNode): string {
    if (node.type === 'tag') return TAG_COLOR;
    if (node.type === 'voice') return VOICE_COLORS[node.voice || ''] || DEFAULT_NODE_COLOR;
    return DEFAULT_NODE_COLOR;
}
