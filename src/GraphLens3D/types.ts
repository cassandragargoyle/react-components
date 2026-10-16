/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions and shared helpers for the GraphLens 3D viewer components
// Re-exports the graphlens contract and adds UI selection/coloring utilities

import {
    GraphLensFile,
    GraphLensNode,
    GraphLensLink,
    GraphLensMeta,
} from '../../../../shared/types/graphLensFile';

export type { GraphLensFile, GraphLensNode, GraphLensLink, GraphLensMeta };

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
