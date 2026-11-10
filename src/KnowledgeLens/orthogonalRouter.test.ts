/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the orthogonal edge router: right angles, joined last segments, going around
// boxes in the way, and the conversion to Cytoscape segment values

import { describe, expect, it } from 'vitest';
import { routeOrthogonal, segmentHitsBox, simplify, toSegments, type Box, type Point } from './orthogonalRouter';

const box = (cx: number, cy: number, w = 100, h = 40): Box => ({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 });

function rightAngles(points: Point[]): boolean {
    return points.every((p, i) => i === 0 || p[0] === points[i - 1][0] || p[1] === points[i - 1][1]);
}

function crossesOthers(points: Point[], boxes: Map<string, Box>, ends: string[]): string[] {
    const hits: string[] = [];
    for (const [id, b] of boxes) {
        if (ends.includes(id)) continue;
        for (let i = 1; i < points.length; i++) if (segmentHitsBox(points[i - 1], points[i], b)) hits.push(id);
    }
    return hits;
}

describe('routeOrthogonal', () => {
    it('joins edges into one box on a common segment at the same height', () => {
        const boxes = new Map([['t', box(200, 0)], ['a', box(0, 150)], ['b', box(200, 150)], ['c', box(400, 150)]]);
        const routes = routeOrthogonal(boxes, ['a', 'b', 'c'].map((s) => ({ id: s, source: s, target: 't' })));
        // The side edges turn in at y 44; the edge straight below runs through that point
        expect(routes.get('a')!.points.slice(-2)).toEqual([[200, 44], [200, 20]]);
        expect(routes.get('c')!.points.slice(-2)).toEqual([[200, 44], [200, 20]]);
        expect(routes.get('b')!.points).toEqual([[200, 130], [200, 20]]);
        for (const r of routes.values()) {
            expect(rightAngles(r.points)).toBe(true);
            expect(r.points[r.points.length - 1]).toEqual([200, 20]);
        }
    });

    it('goes around a box between source and target', () => {
        // The plain path would run up through "m"
        const boxes = new Map([['t', box(0, 0)], ['m', box(0, 150, 160)], ['s', box(0, 300)]]);
        const route = routeOrthogonal(boxes, [{ id: 'e', source: 's', target: 't' }]).get('e')!;
        expect(route.blocked).toBe(false);
        expect(rightAngles(route.points)).toBe(true);
        expect(crossesOthers(route.points, boxes, ['s', 't'])).toEqual([]);
        expect(route.points[0]).toEqual([0, 280]);
        expect(route.points[route.points.length - 1]).toEqual([0, 20]);
    });

    it('enters from above when the target is lower', () => {
        const boxes = new Map([['s', box(0, 0)], ['t', box(300, 200)]]);
        const route = routeOrthogonal(boxes, [{ id: 'e', source: 's', target: 't' }]).get('e')!;
        expect(route.points[0]).toEqual([0, 20]);
        expect(route.points[route.points.length - 1]).toEqual([300, 180]);
        expect(rightAngles(route.points)).toBe(true);
    });

    it('marks an edge blocked when no path is free and keeps the plain path', () => {
        // The target is walled in on every side
        const boxes = new Map([
            ['t', box(0, 0)],
            ['s', box(0, 400)],
            ['w1', box(0, 90, 2000, 60)],
            ['w2', box(0, -90, 2000, 60)],
            ['w3', box(-200, 0, 200, 300)],
            ['w4', box(200, 0, 200, 300)],
        ]);
        const route = routeOrthogonal(boxes, [{ id: 'e', source: 's', target: 't' }]).get('e')!;
        expect(route.blocked).toBe(true);
        expect(rightAngles(route.points)).toBe(true);
    });

    it('takes the plain path above the obstacle limit and skips self loops', () => {
        const boxes = new Map([['t', box(0, 0)], ['m', box(0, 150, 160)], ['s', box(0, 300)]]);
        const routes = routeOrthogonal(boxes, [{ id: 'e', source: 's', target: 't' }, { id: 'l', source: 's', target: 's' }], { maxObstacles: 2 });
        expect(routes.get('e')!.points).toEqual([[0, 280], [0, 20]]);
        expect(routes.has('l')).toBe(false);
    });
});

describe('toSegments', () => {
    it('gives weights and distances that rebuild the bends', () => {
        const points: Point[] = [[0, 280], [0, 200], [100, 200], [100, 44], [50, 44], [50, 20]];
        const seg = toSegments({ points, blocked: false }, [0, 300], [50, 0]);
        expect(seg.sourceEndpoint).toBe('0px -20px');
        expect(seg.targetEndpoint).toBe('0px 20px');
        const [p1, p2] = [points[0], points[points.length - 1]];
        const [dx, dy] = [p2[0] - p1[0], p2[1] - p1[1]];
        const l = Math.hypot(dx, dy);
        const n = [-dy / l, dx / l];
        seg.weights.forEach((w, i) => {
            const x = p1[0] + w * dx + seg.distances[i] * n[0];
            const y = p1[1] + w * dy + seg.distances[i] * n[1];
            expect(x).toBeCloseTo(points[i + 1][0], 6);
            expect(y).toBeCloseTo(points[i + 1][1], 6);
        });
    });

    it('gives a straight edge one middle point', () => {
        const seg = toSegments({ points: [[0, 0], [0, 100]], blocked: false }, [0, -20], [0, 120]);
        expect(seg.weights).toEqual([0.5]);
        expect(seg.distances).toEqual([0]);
    });
});

describe('simplify', () => {
    it('drops repeated points and straight middles', () => {
        expect(simplify([[0, 0], [0, 0], [0, 10], [0, 20], [10, 20]])).toEqual([[0, 0], [0, 20], [10, 20]]);
    });
});
