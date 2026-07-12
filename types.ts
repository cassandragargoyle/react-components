/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions for Graph Canvas React components
// Extends shared GraphFile types with UI-specific state

import { GraphFile, GraphNode, GraphEdge } from '../../../../shared/types/graphFile';

export type { GraphFile, GraphNode, GraphEdge };

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
    | { type: 'setGraphData'; data: GraphFile }
    | { type: 'selectNode'; ids: string[] };

/** Messages from webview to extension */
export type WebviewToExtensionMessage =
    | { type: 'ready' }
    | { type: 'selectionChanged'; elements: SelectedElement[] }
    | { type: 'graphDataChanged'; data: GraphFile }
    | { type: 'requestSave' };
