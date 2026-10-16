/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions for Workflow Canvas React components
// The workflow shape the canvas renders, plus UI-specific state and the message protocol

/** Workflow the canvas renders and edits: placed nodes, edges and optional metadata */
export interface WorkflowDocument {
    /** Schema version */
    version: '1.0';
    /** Optional workflow metadata */
    metadata?: {
        title?: string;
        description?: string;
        [key: string]: unknown;
    };
    /** Node definitions */
    nodes: WorkflowNode[];
    /** Edge definitions */
    edges: WorkflowEdge[];
}

/** Single node in the workflow graph */
export interface WorkflowNode {
    /** Unique node identifier */
    id: string;
    /** Display label (defaults to id if absent) */
    label?: string;
    /** Node type for visual styling and behavior */
    type?: string;
    /** Position (required — user-placed) */
    position: { x: number; y: number };
    /** Width and height overrides */
    size?: { width: number; height: number };
    /** Arbitrary properties shown in property panel and table */
    properties?: Record<string, unknown>;
}

/** Single edge in the workflow graph */
export interface WorkflowEdge {
    /** Unique edge identifier */
    id: string;
    /** Source node id */
    source: string;
    /** Source handle id (output port) */
    sourceHandle?: string;
    /** Target node id */
    target: string;
    /** Target handle id (input port) */
    targetHandle?: string;
    /** Display label on the edge */
    label?: string;
    /** Edge type for visual styling (default, step, smoothstep) */
    type?: string;
    /** Arbitrary properties shown in property panel */
    properties?: Record<string, unknown>;
}

/** Selected element — either a node or an edge */
export interface SelectedElement {
    type: 'node' | 'edge';
    id: string;
}

/** Table filter mode */
export type TableFilter = 'all' | 'selected';

/** Messages from extension to webview */
export type ExtensionToWebviewMessage =
    | { type: 'setWorkflowData'; data: WorkflowDocument }
    | { type: 'selectNode'; ids: string[] };

/** Messages from webview to extension */
export type WebviewToExtensionMessage =
    | { type: 'ready' }
    | { type: 'selectionChanged'; elements: SelectedElement[] }
    | { type: 'workflowDataChanged'; data: WorkflowDocument }
    | { type: 'requestSave'; data: WorkflowDocument };
