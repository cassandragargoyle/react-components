/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions for Graph Canvas React components
// The graph shape the canvas renders, plus UI-specific state and the message protocol

/** Graph the canvas renders and edits: nodes, edges and optional metadata */
export interface GraphDocument {
    /** Schema version */
    version: '1.0';
    /** Optional graph metadata */
    metadata?: {
        title?: string;
        description?: string;
        [key: string]: unknown;
    };
    /** Node definitions */
    nodes: GraphNode[];
    /** Edge definitions */
    edges: GraphEdge[];
}

/** Single node in the graph */
export interface GraphNode {
    /** Unique node identifier */
    id: string;
    /** Display label (defaults to id if absent) */
    label?: string;
    /** Node type for visual styling */
    type?: string;
    /** Stored position; when every node has one the layout is skipped and they are kept */
    position?: { x: number; y: number };
    /** Arbitrary properties shown in property panel and table */
    properties?: Record<string, unknown>;
}

/** Single edge in the graph */
export interface GraphEdge {
    /** Unique edge identifier */
    id: string;
    /** Source node id */
    source: string;
    /** Target node id */
    target: string;
    /** Display label on the edge */
    label?: string;
    /** Edge type for visual styling */
    type?: string;
    /** Arbitrary properties shown in property panel */
    properties?: Record<string, unknown>;
}

/** Available layout algorithms */
export type LayoutAlgorithm = 'dagre' | 'cose' | 'breadthfirst' | 'circle' | 'grid';

/** Selected element — either a node or an edge */
export interface SelectedElement {
    type: 'node' | 'edge';
    id: string;
}

/** Sort configuration for the node table */
export interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

/** Table filter mode */
export type TableFilter = 'all' | 'selected';

/** Messages from extension to webview */
export type ExtensionToWebviewMessage =
    | { type: 'setGraphData'; data: GraphDocument }
    | { type: 'selectNode'; ids: string[] };

/** Messages from webview to extension */
export type WebviewToExtensionMessage =
    | { type: 'ready' }
    | { type: 'selectionChanged'; elements: SelectedElement[] }
    | { type: 'graphDataChanged'; data: GraphDocument }
    | { type: 'requestSave' };
