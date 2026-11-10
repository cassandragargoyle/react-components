/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Orthogonal edge router of KnowledgeLens: right-angle paths that go around the boxes
// they do not connect, and that join edges into one node on a common last segment

/** Axis-aligned box */
export interface Box {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export type Point = [number, number];

/** Edge to route */
export interface RouteEdge {
    id: string;
    source: string;
    target: string;
}

/** Polyline of an edge, from the border of its source to the border of its target */
export interface Route {
    points: Point[];
    /** True when no path around the other boxes was found and the plain path is used */
    blocked: boolean;
}

export interface RouterOptions {
    /** Distance of the joining segment from the target box */
    join?: number;
    /** Length of the stub out of the source box */
    stub?: number;
    /** Clearance kept around boxes */
    clearance?: number;
    /** Most obstacles searched around; above it every edge takes the plain path */
    maxObstacles?: number;
}

const BEND_COST = 40;

/** Whether an axis-aligned segment runs through the inside of a box */
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
    const x1 = Math.min(a[0], b[0]);
    const x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]);
    const y2 = Math.max(a[1], b[1]);
    return x2 > box.x1 && x1 < box.x2 && y2 > box.y1 && y1 < box.y2;
}

/** Drop repeated points and middle points of straight runs */
export function simplify(points: Point[]): Point[] {
    const out: Point[] = [];
    for (const p of points) {
        const last = out[out.length - 1];
        if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue;
        if (out.length >= 2) {
            const a = out[out.length - 2];
            const b = out[out.length - 1];
            const straight = (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(b[0] - p[0]) < 0.01)
                || (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(b[1] - p[1]) < 0.01);
            if (straight) {
                out[out.length - 1] = p;
                continue;
            }
        }
        out.push(p);
    }
    return out;
}

function cost(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]);
    }
    return length + BEND_COST * Math.max(0, points.length - 2);
}

/**
 * Route edges with right angles. An edge leaves its source towards its target vertically
 * (top when the target is higher, else bottom) and enters the target vertically; all edges
 * entering a box from one side turn into it at the same height, so they share that segment.
 * Paths go around the other boxes when a way exists
 */
export function routeOrthogonal(boxes: Map<string, Box>, edges: RouteEdge[], options: RouterOptions = {}): Map<string, Route> {
    const join = options.join ?? 24;
    const stub = options.stub ?? 12;
    const clearance = options.clearance ?? 6;
    const maxObstacles = options.maxObstacles ?? 200;
    const avoid = boxes.size <= maxObstacles;

    const inflated = new Map<string, Box>();
    for (const [id, b] of boxes) inflated.set(id, { x1: b.x1 - clearance, y1: b.y1 - clearance, x2: b.x2 + clearance, y2: b.y2 + clearance });

    // Free columns and levels just outside each box, shared by all edges
    const gap = clearance + 8;
    const columns = [...new Set([...boxes.values()].flatMap((b) => [b.x1 - gap, b.x2 + gap]))];
    const levels = [...new Set([...boxes.values()].flatMap((b) => [b.y1 - gap, b.y2 + gap]))];

    const routes = new Map<string, Route>();
    for (const edge of edges) {
        const s = boxes.get(edge.source);
        const t = boxes.get(edge.target);
        if (!s || !t || edge.source === edge.target) continue;
        const sx = (s.x1 + s.x2) / 2;
        const tx = (t.x1 + t.x2) / 2;
        const up = (t.y1 + t.y2) / 2 <= (s.y1 + s.y2) / 2;
        const start: Point = [sx, up ? s.y1 : s.y2];
        const end: Point = [tx, up ? t.y2 : t.y1];
        const stubY = start[1] + (up ? -stub : stub);
        const joinY = end[1] + (up ? join : -join);
        const plain = simplify([start, [sx, joinY], [tx, joinY], end]);

        if (!avoid) {
            routes.set(edge.id, { points: plain, blocked: false });
            continue;
        }

        const obstacles = [...inflated].filter(([id]) => id !== edge.source && id !== edge.target).map(([, b]) => b);
        const free = (points: Point[]) => {
            for (let i = 1; i < points.length; i++) {
                for (const o of obstacles) if (segmentHitsBox(points[i - 1], points[i], o)) return false;
            }
            return true;
        };
        const lo = Math.min(start[1], end[1]);
        const hi = Math.max(start[1], end[1]);
        const between = levels.filter((y) => y > lo && y < hi);

        // Candidate stages, from the simplest; the first stage with a free path wins
        const stages: (() => Point[][])[] = [
            () => [plain],
            () => columns.map((xc) => [start, [sx, stubY], [xc, stubY], [xc, joinY], [tx, joinY], end] as Point[]),
            () => between.flatMap((y1) => [sx, ...columns].map((xc) => [start, [sx, y1], [xc, y1], [xc, joinY], [tx, joinY], end] as Point[])),
            () => [
                ...between.map((y2) => [start, [sx, y2], [tx, y2], end] as Point[]),
                ...between.flatMap((y2) => columns.map((xc) => [start, [sx, stubY], [xc, stubY], [xc, y2], [tx, y2], end] as Point[])),
            ],
        ];
        let best: Point[] | null = null;
        for (const stage of stages) {
            let bestCost = Infinity;
            for (const candidate of stage()) {
                const path = simplify(candidate);
                const c = cost(path);
                if (c < bestCost && free(path)) {
                    best = path;
                    bestCost = c;
                }
            }
            if (best) break;
        }
        routes.set(edge.id, best ? { points: best, blocked: false } : { points: plain, blocked: true });
    }
    return routes;
}

/**
 * Cytoscape `segments` values of a route: the endpoint offsets from the node centers, and
 * each bend as a weight along and a distance across the line between the endpoints
 */
export function toSegments(route: Route, sourceCenter: Point, targetCenter: Point): {
    sourceEndpoint: string;
    targetEndpoint: string;
    weights: number[];
    distances: number[];
} {
    const pts = route.points;
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    let dx = p2[0] - p1[0];
    let dy = p2[1] - p1[1];
    let l = Math.hypot(dx, dy);
    if (l < 0.01) {
        dx = 0;
        dy = 1;
        l = 1;
    }
    const n: Point = [-dy / l, dx / l];
    const bends = pts.slice(1, -1);
    const weights: number[] = [];
    const distances: number[] = [];
    for (const b of bends) {
        const vx = b[0] - p1[0];
        const vy = b[1] - p1[1];
        weights.push((vx * dx + vy * dy) / (l * l));
        distances.push(vx * n[0] + vy * n[1]);
    }
    if (bends.length === 0) {
        weights.push(0.5);
        distances.push(0);
    }
    const offset = (p: Point, c: Point) => `${Math.round((p[0] - c[0]) * 100) / 100}px ${Math.round((p[1] - c[1]) * 100) / 100}px`;
    return {
        sourceEndpoint: offset(p1, sourceCenter),
        targetEndpoint: offset(p2, targetCenter),
        weights,
        distances,
    };
}
