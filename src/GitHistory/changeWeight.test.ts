/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for changeWeight: relative to the file's size, added and deleted files, renames,
// binaries, a missing line count and the level limits

import { describe, it, expect } from 'vitest';
import { changeWeight } from './changeWeight';
import type { GitChangedFile } from './types';

const modified = (additions: number, deletions: number, lines?: number): GitChangedFile => ({
    path: 'f.ts',
    status: 'modified',
    additions,
    deletions,
    lines,
});

describe('changeWeight', () => {
    it('weighs ten lines heavily in a small file and lightly in a big one', () => {
        expect(changeWeight(modified(9, 0, 10))).toMatchObject({ level: 4, ratio: 0.9, size: 10 });
        expect(changeWeight(modified(10, 0, 10_000)).level).toBe(1);
    });

    it('takes the larger of the sizes before and after the commit', () => {
        // 100 lines before, 40 deleted and 0 added: 60 after; 40 of 100 is 40 %
        expect(changeWeight(modified(0, 40, 60))).toMatchObject({ size: 100, ratio: 0.4, level: 3 });
    });

    it('keeps to the level limits 5, 20 and 50 %', () => {
        expect(changeWeight(modified(5, 0, 100)).level).toBe(1);
        expect(changeWeight(modified(6, 0, 100)).level).toBe(2);
        expect(changeWeight(modified(20, 0, 100)).level).toBe(2);
        expect(changeWeight(modified(21, 0, 100)).level).toBe(3);
        expect(changeWeight(modified(50, 0, 100)).level).toBe(3);
        expect(changeWeight(modified(51, 0, 100)).level).toBe(4);
    });

    it('treats an added or deleted file as changed through, without a line count', () => {
        expect(changeWeight({ path: 'n.ts', status: 'added', additions: 120, deletions: 0 })).toMatchObject({ level: 4, ratio: 1, size: 120 });
        expect(changeWeight({ path: 'o.ts', status: 'deleted', additions: 0, deletions: 30, lines: 0 })).toMatchObject({ level: 4, size: 30 });
    });

    it('has nothing to weigh for a pure rename, a binary file or a missing line count', () => {
        expect(changeWeight({ path: 'b.md', oldPath: 'a.md', status: 'renamed', additions: 0, deletions: 0 }).level).toBe(0);
        expect(changeWeight({ path: 'logo.png', status: 'modified' })).toMatchObject({ level: 0, ratio: null });
        expect(changeWeight(modified(3, 1))).toMatchObject({ level: 0, ratio: null, changed: 4 });
    });
});
