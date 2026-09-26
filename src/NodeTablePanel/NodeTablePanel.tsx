/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Shared bottom table panel: AG Grid with All/Selected filter, count, selection
// sync, and a top-left minimize toggle — reused by all viewer node tables

import { type JSX, useMemo, useRef, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type RowClickedEvent, type GridReadyEvent, type GridApi } from 'ag-grid-community';
import nodeTablePanelStyles from './NodeTablePanel.css';

// Inject styles once under the 'text' loader (single-file bundles); under the 'css'
// loader the import is a non-string and the stylesheet is emitted as a sibling file.
if (
    typeof document !== 'undefined' &&
    typeof nodeTablePanelStyles === 'string' &&
    nodeTablePanelStyles &&
    !document.getElementById('node-table-panel-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'node-table-panel-styles';
    styleEl.textContent = nodeTablePanelStyles;
    document.head.appendChild(styleEl);
}

// Register all AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

/** All/Selected filter shared by every node table */
export type TableFilter = 'all' | 'selected';

/** Flat row object; must expose a stable id (see getRowId) */
export type NodeTableRow = Record<string, unknown>;

/** Shared dark theme params — kept identical across all viewer tables */
const NODE_TABLE_THEME = themeQuartz.withParams({
    backgroundColor: 'transparent',
    foregroundColor: '#cccccc',
    borderColor: 'transparent',
    wrapperBorder: false,
    headerBackgroundColor: '#2d2d2d',
    headerTextColor: '#cccccc',
    wrapperBorderRadius: 0,
    rowBorder: { color: '#3c3c3c' },
    columnBorder: false,
    spacing: 0,
});

interface NodeTablePanelProps {
    /** All rows (unfiltered) — the panel applies the All/Selected filter itself */
    rows: NodeTableRow[];
    /** Column definitions supplied by the caller */
    columns: ColDef[];
    /** External selection state (single-select callers pass a one-element set) */
    selectedIds: Set<string>;
    /** All/Selected filter state (owned by the caller) */
    filter: TableFilter;
    onFilterChange: (filter: TableFilter) => void;
    /** Row click — ctrlKey is always false for single-select callers */
    onRowClick: (id: string, ctrlKey: boolean) => void;
    /** Panel pixel height when expanded (caller owns the resize handle) */
    height: number;
    /** Minimized state (external, so each viewer keeps it) */
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    /** Noun for the "Showing: X of Y <noun>" count (default "rows") */
    countNoun?: string;
    /** AG Grid selection mode (default "multiple") */
    rowSelection?: 'single' | 'multiple';
    /** Resolve a row's id (default reads row.id) */
    getRowId?: (row: NodeTableRow) => string;
}

export function NodeTablePanel({
    rows,
    columns,
    selectedIds,
    filter,
    onFilterChange,
    onRowClick,
    height,
    collapsed,
    onCollapsedChange,
    countNoun = 'rows',
    rowSelection = 'multiple',
    getRowId,
}: NodeTablePanelProps): JSX.Element {
    const gridApiRef = useRef<GridApi | null>(null);

    const rowId = useCallback(
        (row: NodeTableRow) => (getRowId ? getRowId(row) : (row.id as string)),
        [getRowId]
    );

    const filteredRows = useMemo(() => {
        if (filter === 'selected') {
            return rows.filter((r) => selectedIds.has(rowId(r)));
        }
        return rows;
    }, [rows, filter, selectedIds, rowId]);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        suppressMovable: true,
    }), []);

    const onGridReady = useCallback((params: GridReadyEvent) => {
        gridApiRef.current = params.api;
    }, []);

    const onRowClicked = useCallback((event: RowClickedEvent) => {
        const id = event.data?.id as string;
        if (id) {
            const ctrlKey = (event.event as MouseEvent)?.ctrlKey || (event.event as MouseEvent)?.metaKey || false;
            onRowClick(id, ctrlKey);
        }
    }, [onRowClick]);

    // Sync selection highlight from external state
    useEffect(() => {
        const api = gridApiRef.current;
        if (!api) return;
        api.forEachNode((node) => {
            const isSelected = selectedIds.has(node.data?.id);
            if (node.isSelected() !== isSelected) {
                node.setSelected(isSelected);
            }
        });
    }, [selectedIds, filteredRows]);

    // Collapsed: only the header (reduced to the top-left restore button) shows
    if (collapsed) {
        return (
            <div className="node-table-panel node-table-panel--collapsed" style={{ flexShrink: 0 }}>
                <div className="node-table-panel-header">
                    <button
                        className="node-table-panel-minimize"
                        title="Expand table"
                        aria-label="Expand table"
                        aria-expanded={false}
                        onClick={() => onCollapsedChange(false)}
                    >
                        <span className="node-table-panel-chevron">▸</span>
                        <span className="node-table-panel-count">
                            {rows.length} {countNoun}
                        </span>
                    </button>
                </div>
            </div>
        );
    }

    // AG Grid needs an explicit pixel height — subtract header bar (28px)
    const gridHeight = Math.max(50, height - 28);

    return (
        <div className="node-table-panel" style={{ height, flexShrink: 0 }}>
            <div className="node-table-panel-header">
                <button
                    className="node-table-panel-minimize"
                    title="Minimize table"
                    aria-label="Minimize table"
                    aria-expanded={true}
                    onClick={() => onCollapsedChange(true)}
                >
                    <span className="node-table-panel-chevron">▾</span>
                </button>
                <button
                    className={`node-table-panel-filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => onFilterChange('all')}
                >
                    All
                </button>
                <button
                    className={`node-table-panel-filter-btn ${filter === 'selected' ? 'active' : ''}`}
                    onClick={() => onFilterChange('selected')}
                >
                    Selected
                </button>
                <span className="node-table-panel-count">
                    Showing: {filteredRows.length} of {rows.length} {countNoun}
                </span>
            </div>
            <div className="node-table-panel-grid" style={{ height: gridHeight }}>
                <AgGridReact
                    theme={NODE_TABLE_THEME}
                    rowData={filteredRows}
                    columnDefs={columns}
                    defaultColDef={defaultColDef}
                    rowSelection={rowSelection}
                    suppressRowClickSelection={true}
                    onGridReady={onGridReady}
                    onRowClicked={onRowClicked}
                    headerHeight={28}
                    rowHeight={26}
                    getRowId={(params) => (getRowId ? getRowId(params.data) : (params.data.id as string))}
                />
            </div>
        </div>
    );
}
