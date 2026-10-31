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

/** Free-form document metadata; `title` and `groups` are the known keys, others are allowed */
export interface GraphLensMeta {
    /** Document title */
    title?: string;
    /** Group definitions by group key (see GraphLensNode.group) */
    groups?: GraphLensGroups;
    [key: string]: unknown;
}

/** Display definition of one node group */
export interface GraphLensGroup {
    /** Legend and filter label; the group key is shown when missing */
    label?: string;
    /** Color as #RRGGBB; the default color is used when missing */
    color?: string;
}

/** Group definitions by group key */
export type GraphLensGroups = Record<string, GraphLensGroup>;

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
    /** Optional group key, usually defined in meta.groups */
    group?: string;
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

const GROUP_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Own-key lookup, so a kind such as 'constructor' never reads from Object.prototype
function ownValue<T>(record: Record<string, T> | undefined, key: string): T | undefined {
    if (!record || typeof record !== 'object') return undefined;
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

// A non-empty text value; anything else in a document counts as not set
function textOf(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value : undefined;
}

/** Grouping key for stats/filters: node.group, 'tag', a voice's VoX type, or the node type */
export function kindOf(node: GraphLensNode): string {
    const group = textOf(node.group);
    if (group) return group;
    if (node.type === 'tag') return 'tag';
    return textOf(node.voice) ?? textOf(node.type) ?? 'voice';
}

/** Swatch/render color for a grouping kind: meta.groups, the palette, then the default */
export function kindColor(kind: string, groups?: GraphLensGroups): string {
    const color = ownValue(groups, kind)?.color;
    if (typeof color === 'string' && GROUP_COLOR_PATTERN.test(color)) return color;
    if (kind === 'tag') return TAG_COLOR;
    return ownValue(VOICE_COLORS, kind) ?? DEFAULT_NODE_COLOR;
}

/** Display label for a grouping kind: the meta.groups label, or the key itself */
export function kindLabel(kind: string, groups?: GraphLensGroups): string {
    return textOf(ownValue(groups, kind)?.label) ?? kind;
}

/** Color for a node by its kind */
export function nodeKindColor(node: GraphLensNode, groups?: GraphLensGroups): string {
    return kindColor(kindOf(node), groups);
}
