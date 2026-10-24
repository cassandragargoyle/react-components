/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The four-step heat glyph shared by the change weight of the Files tab and Pilot's commit heat
// marks: a faint dot, a ring, a filled dot, a filled dot with a halo; level 0 draws nothing

import React from 'react';

/** 0 = nothing to show … 4 = the strongest mark */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatGlyphProps {
    level: HeatLevel;
    /** Pixel size of the square glyph (default 12) */
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

const SHAPES: Record<1 | 2 | 3 | 4, React.ReactElement> = {
    1: <circle cx="6" cy="6" r="1.5" fill="currentColor" />,
    2: <circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />,
    3: <circle cx="6" cy="6" r="3.2" fill="currentColor" />,
    4: (
        <>
            <circle cx="6" cy="6" r="3.2" fill="currentColor" />
            <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1" />
        </>
    ),
};

/** Monochrome glyph in currentColor; decorative, so the caller gives the words */
export function HeatGlyph({ level, size = 12, className, style }: HeatGlyphProps): React.ReactElement | null {
    if (level === 0) return null;
    return (
        <svg className={className} style={style} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
            {SHAPES[level]}
        </svg>
    );
}
