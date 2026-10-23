/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for layoutCommitGraph: linear history, a branch and its merge, an octopus
// merge, two branch tips, a root commit and a lane that runs into the next page

import { describe, it, expect } from 'vitest';
import { layoutCommitGraph, type GraphCommit, type GraphRow } from './layoutCommitGraph';

const c = (sha: string, ...parents: string[]): GraphCommit => ({ sha, parents });

// Compact view of a row's segments, e.g. "t0>0 b0>1"
function segs(row: GraphRow): string {
    return row.segments
        .map((s) => `${s.half[0]}${s.from}>${s.to}`)
        .sort()
        .join(' ');
}

describe('layoutCommitGraph', () => {
    it('keeps a linear history in one lane', () => {
        const rows = layoutCommitGraph([c('c', 'b'), c('b', 'a'), c('a')]);
        expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
        expect(rows.map(segs)).toEqual(['b0>0', 'b0>0 t0>0', 't0>0']);
        expect(rows.every((r) => r.width === 1 && !r.merge)).toBe(true);
        expect(new Set(rows.map((r) => r.color)).size).toBe(1);
    });

    it('opens a lane for the second parent of a merge and closes it at the fork', () => {
        // m merges f (feature) into b; f and b both come from a
        const rows = layoutCommitGraph([c('m', 'b', 'f'), c('f', 'a'), c('b', 'a'), c('a')]);
        expect(rows.map((r) => r.lane)).toEqual([0, 1, 0, 0]);
        expect(rows[0].merge).toBe(true);
        expect(segs(rows[0])).toBe('b0>0 b0>1');
        expect(segs(rows[1])).toBe('b0>0 b1>1 t0>0 t1>1');
        // a: lane 0 waits for a (from b) and lane 1 waits for a (from f): both converge
        expect(segs(rows[3])).toBe('t0>0 t1>0');
        expect(rows[3].width).toBe(2);
        expect(rows[1].color).not.toBe(rows[0].color);
    });

    it('fans out an octopus merge into one lane per extra parent', () => {
        const rows = layoutCommitGraph([c('o', 'p1', 'p2', 'p3'), c('p3'), c('p2'), c('p1')]);
        expect(segs(rows[0])).toBe('b0>0 b0>1 b0>2');
        expect(rows.slice(1).map((r) => r.lane)).toEqual([2, 1, 0]);
        expect(rows[0].width).toBe(3);
    });

    it('gives a second branch tip its own lane', () => {
        const rows = layoutCommitGraph([c('x', 'a'), c('y', 'a'), c('a')]);
        expect(rows.map((r) => r.lane)).toEqual([0, 1, 0]);
        expect(segs(rows[1])).toBe('b0>0 b1>1 t0>0');
        expect(segs(rows[2])).toBe('t0>0 t1>0');
    });

    it('reuses a freed lane and narrows again', () => {
        const rows = layoutCommitGraph([c('m', 'b', 'f'), c('f', 'b'), c('b', 'a'), c('a')]);
        expect(rows[2].lane).toBe(0);
        expect(segs(rows[2])).toBe('b0>0 t0>0 t1>0');
        expect(rows[3].width).toBe(1);
    });

    it('leaves a lane open at the bottom when its commit is on a later page', () => {
        const rows = layoutCommitGraph([c('m', 'b', 'f'), c('b', 'a')]);
        // f is not loaded yet: lane 1 passes through b's row to the bottom edge
        expect(segs(rows[1])).toBe('b0>0 b1>1 t0>0 t1>1');
    });

    it('treats commits without parents as roots and draws nothing below them', () => {
        const rows = layoutCommitGraph([{ sha: 'a' }]);
        expect(rows[0].segments).toEqual([]);
        expect(rows[0].merge).toBe(false);
    });
});
