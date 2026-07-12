/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Monochrome stroke icons for the GraphLens 3D node radial menu
// Stroke/size come from RadialMenu.css (stroke: currentColor, 16px); paths only here

import React from 'react';

// 16x16 stroke glyphs; RadialMenu.css sets fill:none, stroke:currentColor, width/height
export const nodeIcons = {
    focus: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1 V4 M8 12 V15 M1 8 H4 M12 8 H15" />
        </svg>
    ),
    isolate: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
    ),
    filter: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3 H14 L9.5 8.5 V13 L6.5 14 V8.5 Z" />
        </svg>
    ),
    hide: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 8 C3 4 13 4 15 8 C13 12 3 12 1 8 Z" />
            <circle cx="8" cy="8" r="1.8" />
            <path d="M3 13 L13 3" />
        </svg>
    ),
    search: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10 L14 14" />
        </svg>
    ),
    showAll: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 8 C3 4 13 4 15 8 C13 12 3 12 1 8 Z" />
            <circle cx="8" cy="8" r="1.8" />
        </svg>
    ),
    back: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" />
        </svg>
    ),
    forward: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3 L11 8 L6 13" />
        </svg>
    ),
};
