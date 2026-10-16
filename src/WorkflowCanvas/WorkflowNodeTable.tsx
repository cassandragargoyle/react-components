/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Workflow node table — maps workflow nodes to rows/columns for NodeTablePanel

import React, { type JSX, useMemo } from 'react';
import type { ColDef } from 'ag-grid-community';
import { NodeTablePanel } from '../NodeTablePanel';
import { WorkflowNode, TableFilter } from './types';

interface WorkflowNodeTableProps {
    nodes: WorkflowNode[];
    selectedNodeIds: Set<string>;
    filter: TableFilter;
    onFilterChange: (filter: TableFilter) => void;
    onNodeClick: (nodeId: string, ctrlKey: boolean) => void;
    height: number;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
}

/** Flatten node into a flat row object for the table */
function nodeToRow(node: WorkflowNode): Record<string, unknown> {
    return {
        id: node.id,
        label: node.label || node.id,
        type: node.type || '',
        ...Object.fromEntries(
            Object.entries(node.properties || {}).map(([k, v]) => [
                `prop_${k}`,
                v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v,
            ])
        ),
    };
}

/** Collect all unique property keys across nodes */
function collectPropertyColumns(nodes: WorkflowNode[]): string[] {
    const keys = new Set<string>();
    for (const node of nodes) {
        if (node.properties) {
            for (const key of Object.keys(node.properties)) {
                keys.add(key);
            }
        }
    }
    return Array.from(keys).sort();
}

export function WorkflowNodeTable({
    nodes,
    selectedNodeIds,
    filter,
    onFilterChange,
    onNodeClick,
    height,
    collapsed,
    onCollapsedChange,
}: WorkflowNodeTableProps): JSX.Element {
    const rows = useMemo(() => nodes.map(nodeToRow), [nodes]);

    const columns = useMemo<ColDef[]>(() => {
        const propCols = collectPropertyColumns(nodes);
        return [
            { field: 'id', headerName: 'ID', width: 120, sortable: true },
            { field: 'label', headerName: 'Label', width: 150, sortable: true },
            { field: 'type', headerName: 'Type', width: 100, sortable: true },
            ...propCols.map((key) => ({
                field: `prop_${key}`,
                headerName: key,
                width: 120,
                sortable: true,
            })),
        ];
    }, [nodes]);

    return (
        <NodeTablePanel
            rows={rows}
            columns={columns}
            selectedIds={selectedNodeIds}
            filter={filter}
            onFilterChange={onFilterChange}
            onRowClick={onNodeClick}
            height={height}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            countNoun="nodes"
            rowSelection="multiple"
        />
    );
}
