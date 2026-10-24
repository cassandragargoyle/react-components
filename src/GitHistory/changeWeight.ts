/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Change weight of a file in a commit: the share of the file the commit touched, in four levels
// Relative to the file's size, so ten lines rewrite a small file and barely touch a big one

import type { HeatLevel } from './HeatGlyph';
import type { GitChangedFile } from './types';

/** Upper bounds of levels 1, 2 and 3 as a share of the file; above the last is level 4 */
export const CHANGE_WEIGHT_LIMITS = [0.05, 0.2, 0.5] as const;

export interface ChangeWeight {
    /** Changed lines over the file's size, 0 … 1; null when it cannot be told */
    ratio: number | null;
    level: HeatLevel;
    /** Changed lines (additions + deletions) */
    changed: number;
    /** The larger of the file's line count before and after the commit */
    size: number | null;
}

/**
 * Weight of one changed file. The size is the larger of the line counts before and after
 * the commit (before = after − additions + deletions). An added or deleted file is changed
 * through; a pure rename or a binary file has nothing to weigh; without a line count the
 * ratio is unknown and the level is 0
 */
export function changeWeight(file: GitChangedFile): ChangeWeight {
    const additions = file.additions ?? 0;
    const deletions = file.deletions ?? 0;
    const changed = additions + deletions;
    const counted = file.additions !== undefined || file.deletions !== undefined;
    if (!counted || changed === 0) return { ratio: null, level: 0, changed, size: null };

    if (file.status === 'added' || file.status === 'deleted') {
        const size = file.status === 'added' ? additions : deletions;
        return { ratio: 1, level: 4, changed, size };
    }
    if (file.lines === undefined) return { ratio: null, level: 0, changed, size: null };

    const after = file.lines;
    const before = Math.max(0, after - additions + deletions);
    const size = Math.max(before, after, 1);
    const ratio = Math.min(1, changed / size);
    const [l1, l2, l3] = CHANGE_WEIGHT_LIMITS;
    const level: HeatLevel = ratio <= l1 ? 1 : ratio <= l2 ? 2 : ratio <= l3 ? 3 : 4;
    return { ratio, level, changed, size };
}
