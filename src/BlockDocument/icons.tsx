/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Inline monochrome icons of BlockDocument, per the GUI design guidelines
// Stroke-based on a 20x20 grid, currentColor, hidden from assistive technology

import React from 'react';

const SVG_PROPS = {
    width: 16,
    height: 16,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
} as const;

/** The drag handle: two columns of dots */
export function GripIcon(): React.ReactElement {
    return (
        <svg {...SVG_PROPS}>
            <path d="M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01" strokeWidth={2.5} />
        </svg>
    );
}

/** Insert a block */
export function PlusIcon(): React.ReactElement {
    return (
        <svg {...SVG_PROPS}>
            <path d="M10 4.5v11M4.5 10h11" />
        </svg>
    );
}

/** An address: a map pin */
export function PinIcon(): React.ReactElement {
    return (
        <svg {...SVG_PROPS}>
            <path d="M10 17.5s-5.5-5.2-5.5-9.5a5.5 5.5 0 0 1 11 0c0 4.3-5.5 9.5-5.5 9.5z" />
            <circle cx="10" cy="8" r="2" />
        </svg>
    );
}

/** A field the document does not show: a crossed-out eye */
export function EyeOffIcon(): React.ReactElement {
    return (
        <svg {...SVG_PROPS}>
            <path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5z" />
            <circle cx="10" cy="10" r="2.2" />
            <path d="M3.5 16.5l13-13" />
        </svg>
    );
}
