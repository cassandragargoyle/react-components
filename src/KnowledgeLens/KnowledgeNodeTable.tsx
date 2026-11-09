/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Node table of KnowledgeLens: maps the drawn nodes to rows of the shared NodeTablePanel,
// with the prefixed IRI, label, class and one column per chosen attribute

import React, { type JSX, useMemo } from 'react';
import type { ColDef } from 'ag-grid-community';
import { NodeTablePanel, type TableFilter } from '../NodeTablePanel';
import { valueText } from './projectGraph';
import type { KnowledgeClassInfo, KnowledgeNode, KnowledgePredicateInfo } from './types';

interface KnowledgeNodeTableProps {
    nodes: KnowledgeNode[];
    classesByIri: Map<string, KnowledgeClassInfo>;
    attributeColumns: KnowledgePredicateInfo[];
    selectedNodeIds: Set<string>;
    filter: TableFilter;
    onFilterChange: (filter: TableFilter) => void;
    onNodeClick: (nodeId: string, ctrlKey: boolean) => void;
    height: number;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
}

export function KnowledgeNodeTable({
    nodes,
    classesByIri,
    attributeColumns,
    selectedNodeIds,
    filter,
    onFilterChange,
    onNodeClick,
    height,
    collapsed,
    onCollapsedChange,
}: KnowledgeNodeTableProps): JSX.Element {
    const rows = useMemo(
        () =>
            nodes.map((node) => {
                const row: Record<string, unknown> = {
                    id: node.id,
                    iri: node.short,
                    label: node.title,
                    type: classesByIri.get(node.classIri)?.name ?? '',
                };
                attributeColumns.forEach((column, i) => {
                    const attribute = node.attributes.find((a) => a.predicate === column.iri);
                    row[`attr_${i}`] = attribute ? attribute.values.map(valueText).join('; ') : '';
                });
                return row;
            }),
        [nodes, classesByIri, attributeColumns]
    );

    const columns = useMemo<ColDef[]>(
        () => [
            { field: 'iri', headerName: 'IRI', width: 200, sortable: true },
            { field: 'label', headerName: 'Label', width: 220, sortable: true },
            { field: 'type', headerName: 'Type', width: 140, sortable: true },
            ...attributeColumns.map((column, i) => ({
                field: `attr_${i}`,
                headerName: column.name,
                width: 200,
                sortable: true,
            })),
        ],
        [attributeColumns]
    );

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
