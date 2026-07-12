/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Type definitions for Workflow Canvas React components
// Extends shared WorkflowFile types with UI-specific state

import { WorkflowFile, WorkflowNode, WorkflowEdge } from '../../../../shared/types/workflowFile';

export type { WorkflowFile, WorkflowNode, WorkflowEdge };

/** Selected element — either a node or an edge */
export interface SelectedElement {
    type: 'node' | 'edge';
    id: string;
}

/** Table filter mode */
export type TableFilter = 'all' | 'selected';

/** Messages from extension to webview */
export type ExtensionToWebviewMessage =
    | { type: 'setWorkflowData'; data: WorkflowFile }
    | { type: 'selectNode'; ids: string[] };

/** Messages from webview to extension */
export type WebviewToExtensionMessage =
    | { type: 'ready' }
    | { type: 'selectionChanged'; elements: SelectedElement[] }
    | { type: 'workflowDataChanged'; data: WorkflowFile }
    | { type: 'requestSave'; data: WorkflowFile };
