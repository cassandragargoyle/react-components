/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// One row of the commit graph as an inline SVG: the lane segments and the commit's dot
// Colours come from the --git-history-lane-N custom properties, so a theme can restyle them

import React from 'react';
import type { GraphRow } from './layoutCommitGraph';

/** Horizontal distance between lanes, in pixels */
export const LANE_WIDTH = 14;

export interface CommitGraphCellProps {
    row: GraphRow;
    /** Lanes of the whole column, so every row has the same width */
    lanes: number;
    height: number;
    selected: boolean;
}

const laneColor = (index: number): string => `var(--git-history-lane-${index})`;
const laneX = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2;

// A straight line, or a smooth bend between two lanes
function segmentPath(x1: number, y1: number, x2: number, y2: number): string {
    if (x1 === x2) return `M${x1},${y1} L${x2},${y2}`;
    const midY = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
}

export function CommitGraphCell({ row, lanes, height, selected }: CommitGraphCellProps): React.ReactElement {
    const middle = height / 2;
    const radius = selected ? 5 : 4;
    return (
        <svg className="git-history-graph" width={lanes * LANE_WIDTH} height={height} aria-hidden="true">
            {row.segments.map((s, i) => {
                const [y1, y2] = s.half === 'top' ? [0, middle] : [middle, height];
                return (
                    <path
                        key={i}
                        d={segmentPath(laneX(s.from), y1, laneX(s.to), y2)}
                        stroke={laneColor(s.color)}
                        strokeWidth={s.from === row.lane || s.to === row.lane ? 2 : 1.5}
                        fill="none"
                    />
                );
            })}
            <circle
                className="git-history-graph-dot"
                cx={laneX(row.lane)}
                cy={middle}
                r={radius}
                fill={row.merge ? 'var(--git-history-graph-hollow)' : laneColor(row.color)}
                stroke={laneColor(row.color)}
                strokeWidth={2}
            />
        </svg>
    );
}
