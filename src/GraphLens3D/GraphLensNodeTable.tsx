/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// GraphLens node table — maps graphlens nodes to rows/columns for NodeTablePanel

import React, { type JSX, useMemo } from 'react';
import type { ColDef } from 'ag-grid-community';
import { NodeTablePanel } from '../NodeTablePanel';
import { GraphLensGroups, GraphLensNode, TableFilter, kindOf, kindColor, kindLabel } from './types';

interface GraphLensNodeTableProps {
    nodes: GraphLensNode[];
    /** Group definitions of the document (meta.groups) */
    groups?: GraphLensGroups;
    selectedId: string | null;
    filter: TableFilter;
    onFilterChange: (filter: TableFilter) => void;
    onNodeClick: (id: string) => void;
    degreeOf: (id: string) => number;
    height: number;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
}

const MIN_KIND_WIDTH = 100;
const MAX_KIND_WIDTH = 260;

/** Flatten node into a flat row object for the table */
function nodeToRow(
    node: GraphLensNode,
    degreeOf: (id: string) => number,
    groups?: GraphLensGroups
): Record<string, unknown> {
    const kind = kindOf(node);
    return {
        id: node.id,
        label: node.label || node.title || node.id,
        kind: kindLabel(kind, groups),
        kindColor: kindColor(kind, groups),
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

/** Width for the longest kind label, about 7px per character plus swatch and padding, within limits */
export function kindColumnWidth(rows: Record<string, unknown>[]): number {
    let longest = 0;
    for (const row of rows) longest = Math.max(longest, String(row.kind).length);
    return Math.min(MAX_KIND_WIDTH, Math.max(MIN_KIND_WIDTH, longest * 7 + 44));
}

/** Renders the kind color swatch next to the kind value */
function KindCellRenderer({ value, data }: { value: string; data: { kindColor: string } }): JSX.Element {
    return (
        <span className="graphlens-node-table-kind" title={value}>
            <span className="graphlens-swatch" style={{ background: data.kindColor }} />
            <span className="graphlens-ellipsis">{value}</span>
        </span>
    );
}

export function GraphLensNodeTable({
    nodes,
    groups,
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
        () => nodes.map((n) => nodeToRow(n, degreeOf, groups)),
        [nodes, degreeOf, groups]
    );

    const columns = useMemo<ColDef[]>(() => {
        const metaCols = collectMetaColumns(nodes);
        return [
            { field: 'id', headerName: 'ID', width: 120, sortable: true },
            { field: 'label', headerName: 'Label', width: 150, sortable: true },
            { field: 'kind', headerName: 'Kind', width: kindColumnWidth(rows), sortable: true, cellRenderer: KindCellRenderer },
            { field: 'degree', headerName: 'Degree', width: 90, sortable: true },
            ...metaCols.map((key) => ({
                field: `meta_${key}`,
                headerName: key,
                width: 120,
                sortable: true,
            })),
        ];
    }, [nodes, rows]);

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
