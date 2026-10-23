/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Lane layout of the commit graph: which column each commit sits in and the line segments of each row
// Pure and incremental over the loaded commits, so a lane that runs into the next page stays open

/** Number of lane colours; a lane's colour index is taken modulo this */
export const GRAPH_COLOR_COUNT = 8;

/**
 * One line segment inside a row. A `top` segment runs from the top edge at `from` to the
 * row's middle at `to`; a `bottom` segment from the middle at `from` to the bottom edge at `to`
 */
export interface GraphSegment {
    half: 'top' | 'bottom';
    from: number;
    to: number;
    color: number;
}

/** The graph cell of one row */
export interface GraphRow {
    /** Lane of the commit's dot */
    lane: number;
    /** Colour index of the dot */
    color: number;
    /** More than one parent */
    merge: boolean;
    segments: GraphSegment[];
    /** Lanes the row spans (highest used lane + 1) */
    width: number;
}

/** The minimal commit shape the layout needs */
export interface GraphCommit {
    sha: string;
    parents?: readonly string[];
}

// Index of the first free lane, or a new one at the end
function freeLane(lanes: Array<string | null>): number {
    const free = lanes.indexOf(null);
    return free === -1 ? lanes.length : free;
}

/**
 * Lays out the commits, newest first, into lanes. Each lane waits for one SHA: the commit
 * that continues it. A commit takes the leftmost lane waiting for it (or a free lane when
 * none does, e.g. a branch tip); other lanes waiting for it converge into its dot. Its first
 * parent continues its lane, further parents open or join other lanes
 */
export function layoutCommitGraph(commits: readonly GraphCommit[]): GraphRow[] {
    const lanes: Array<string | null> = [];
    const colors: number[] = [];
    let nextColor = 0;
    const rows: GraphRow[] = [];

    const open = (lane: number, sha: string): void => {
        while (lanes.length <= lane) {
            lanes.push(null);
            colors.push(0);
        }
        lanes[lane] = sha;
        colors[lane] = nextColor++ % GRAPH_COLOR_COUNT;
    };

    for (const commit of commits) {
        const before = lanes.slice();
        const segments: GraphSegment[] = [];

        // Lanes waiting for this commit; the leftmost becomes its lane
        const waiting: number[] = [];
        before.forEach((sha, i) => {
            if (sha === commit.sha) waiting.push(i);
        });
        let lane: number;
        if (waiting.length > 0) {
            lane = waiting[0];
        } else {
            lane = freeLane(lanes);
            open(lane, commit.sha);
        }
        const color = colors[lane];

        // Top half: lanes passing by go straight, waiting lanes bend into the dot
        before.forEach((sha, i) => {
            if (sha === null) return;
            segments.push({ half: 'top', from: i, to: sha === commit.sha ? lane : i, color: colors[i] });
        });
        for (const i of waiting) {
            if (i !== lane) lanes[i] = null;
        }

        // Bottom half: the first parent continues this lane, others open or join a lane
        const parents = commit.parents ?? [];
        if (parents.length === 0) {
            lanes[lane] = null;
        } else {
            lanes[lane] = parents[0];
            segments.push({ half: 'bottom', from: lane, to: lane, color });
            for (const parent of parents.slice(1)) {
                let target = lanes.findIndex((sha, i) => sha === parent && i !== lane);
                if (target === -1) {
                    target = freeLane(lanes);
                    open(target, parent);
                }
                segments.push({ half: 'bottom', from: lane, to: target, color: colors[target] });
            }
        }
        lanes.forEach((sha, i) => {
            if (sha === null || i === lane) return;
            // A lane already waiting before this row and not touched by it passes straight on
            if (before[i] === sha && sha !== commit.sha) {
                segments.push({ half: 'bottom', from: i, to: i, color: colors[i] });
            }
        });

        // Trailing free lanes are dropped, so the graph narrows again
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
            lanes.pop();
            colors.pop();
        }

        let width = lane + 1;
        for (const s of segments) width = Math.max(width, s.from + 1, s.to + 1);
        rows.push({ lane, color, merge: parents.length > 1, segments, width });
    }

    return rows;
}
