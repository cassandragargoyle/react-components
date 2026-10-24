/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for the GitHistory component
// The file and folder history view, its data-source contract, the diff parser and the graph layout

export { GitHistory, DEFAULT_GIT_HISTORY_LABELS } from './GitHistory';
export type { GitHistoryProps, GitHistoryLabels, GitHistoryLayout, GitHistoryOrientation } from './GitHistory';
export type { GitHistoryColumn, GitHistoryColumnWidths } from './CommitList';
export type { GitHistoryTab } from './DetailPanel';
export type { DiffViewMode } from './DiffView';
export { parseUnifiedDiff } from './parseUnifiedDiff';
export { layoutCommitGraph } from './layoutCommitGraph';
export { changeWeight, CHANGE_WEIGHT_LIMITS } from './changeWeight';
export type { ChangeWeight } from './changeWeight';
export { HeatGlyph } from './HeatGlyph';
export type { HeatGlyphProps, HeatLevel } from './HeatGlyph';
export type { GraphCommit, GraphRow, GraphSegment } from './layoutCommitGraph';
export type {
    GitHistoryTarget,
    GitCommit,
    GitCommitAction,
    GitCommitDetails,
    GitCommitStatus,
    GitChangedFile,
    GitFileStatus,
    GitLink,
    GitRef,
    GitRefKind,
    GitHistoryPage,
    GitHistoryQuery,
    GitHistorySource,
    DiffFile,
    DiffHunk,
    DiffLine,
    DiffLineKind,
} from './types';
