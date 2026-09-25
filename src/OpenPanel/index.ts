/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for the reusable OpenPanel component
// A host-neutral launcher: open file, open folder and a filterable recent list

export { OpenPanel, DEFAULT_OPEN_PANEL_LABELS, shortenHomePath } from './OpenPanel';
export type {
    OpenPanelProps,
    OpenPanelRecentItem,
    OpenPanelItemType,
    OpenPanelLabels,
} from './OpenPanel';
