/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// GraphLens node table — maps graphlens nodes to rows/columns for NodeTablePanel

import React, { type JSX, useMemo } from 'react';
import type { ColDef } from 'ag-grid-community';
import { NodeTablePanel } from '../NodeTablePanel';
import { GraphLensNode, TableFilter, kindOf, kindColor } from './types';

interface GraphLensNodeTableProps {
    nodes: GraphLensNode[];
    selectedId: string | null;
    filter: TableFilter;
    onFilterChange: (filter: TableFilter) => void;
    onNodeClick: (id: string) => void;
    degreeOf: (id: string) => number;
    height: number;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
}

/** Flatten node into a flat row object for the table */
function nodeToRow(node: GraphLensNode, degreeOf: (id: string) => number): Record<string, unknown> {
    return {
        id: node.id,
        label: node.label || node.title || node.id,
        kind: kindOf(node),
        degree: degreeOf(node.id),
        ...Object.fromEntries(
            Object.entries(node.meta || {}).map(([k, v]) => [
                `meta_${k}`,
                v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v,
            ])
        ),
    };
}

/** Collect all unique meta keys across nodes */
function collectMetaColumns(nodes: GraphLensNode[]): string[] {
    const keys = new Set<string>();
    for (const node of nodes) {
        if (node.meta) {
            for (const key of Object.keys(node.meta)) {
                keys.add(key);
            }
        }
    }
    return Array.from(keys).sort();
}

/** Renders the kind color swatch next to the kind value */
function KindCellRenderer({ value }: { value: string }): JSX.Element {
    return (
        <span className="graphlens-node-table-kind">
            <span className="graphlens-swatch" style={{ background: kindColor(value) }} />
            {value}
        </span>
    );
}

export function GraphLensNodeTable({
    nodes,
    selectedId,
    filter,
    onFilterChange,
    onNodeClick,
    degreeOf,
    height,
    collapsed,
    onCollapsedChange,
}: GraphLensNodeTableProps): JSX.Element {
    const rows = useMemo(
        () => nodes.map((n) => nodeToRow(n, degreeOf)),
        [nodes, degreeOf]
    );

    const columns = useMemo<ColDef[]>(() => {
        const metaCols = collectMetaColumns(nodes);
        return [
            { field: 'id', headerName: 'ID', width: 120, sortable: true },
            { field: 'label', headerName: 'Label', width: 150, sortable: true },
            { field: 'kind', headerName: 'Kind', width: 100, sortable: true, cellRenderer: KindCellRenderer },
            { field: 'degree', headerName: 'Degree', width: 90, sortable: true },
            ...metaCols.map((key) => ({
                field: `meta_${key}`,
                headerName: key,
                width: 120,
                sortable: true,
            })),
        ];
    }, [nodes]);

    // Bridge the single-select model to the panel's Set-based selection
    const selectedIds = useMemo(
        () => (selectedId ? new Set([selectedId]) : new Set<string>()),
        [selectedId]
    );

    return (
        <NodeTablePanel
            rows={rows}
            columns={columns}
            selectedIds={selectedIds}
            filter={filter}
            onFilterChange={onFilterChange}
            onRowClick={(id) => onNodeClick(id)}
            height={height}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            countNoun="nodes"
            rowSelection="single"
        />
    );
}
