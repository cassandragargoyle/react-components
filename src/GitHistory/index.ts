/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for the GitHistory component
// The file history view, its data-source contract and the unified-diff parser

export { GitHistory, DEFAULT_GIT_HISTORY_LABELS } from './GitHistory';
export type { GitHistoryProps, GitHistoryLabels } from './GitHistory';
export { parseUnifiedDiff } from './parseUnifiedDiff';
export type {
    GitCommit,
    GitHistoryPage,
    GitHistoryQuery,
    GitHistorySource,
    DiffFile,
    DiffHunk,
    DiffLine,
    DiffLineKind,
} from './types';
