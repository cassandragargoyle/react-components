/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Colours of KnowledgeLens: the automatic class palettes for light and dark themes,
// and the theme colours of text, edges and accent read from the VS Code variables

import { toCytoscapeColor } from '../GraphCanvas/graphTheme';
import type { ClassStyle } from './types';

/** Light fill and strong border, in order of first use */
export const LIGHT_CLASS_PALETTE: ClassStyle[] = [
    { fill: '#e8eef8', border: '#3b5b8c' },
    { fill: '#e3f4e6', border: '#2f7d43' },
    { fill: '#efe2fb', border: '#7a3fb0' },
    { fill: '#e3f3f5', border: '#227a86' },
    { fill: '#fdf0dc', border: '#a8650f' },
    { fill: '#fbe4e4', border: '#a83a3a' },
    { fill: '#f6f6f6', border: '#777777' },
    { fill: '#f4f1d8', border: '#7d7420' },
    { fill: '#fce4f1', border: '#a43a77' },
    { fill: '#e4ecf0', border: '#4c6675' },
];

/** Dark fill and bright border, the same hues as the light palette */
export const DARK_CLASS_PALETTE: ClassStyle[] = [
    { fill: '#1f2b3d', border: '#6f9ad6' },
    { fill: '#1d3324', border: '#5fbf79' },
    { fill: '#2e2240', border: '#b184e0' },
    { fill: '#1a3236', border: '#4fb7c4' },
    { fill: '#3a2c17', border: '#e0a14a' },
    { fill: '#3d2222', border: '#e07070' },
    { fill: '#2d2d2d', border: '#a0a0a0' },
    { fill: '#33311a', border: '#c9bd52' },
    { fill: '#3b2131', border: '#e07ab6' },
    { fill: '#243038', border: '#8fb0c2' },
];

/** Style of nodes without a type */
export const UNTYPED_STYLE: Record<'light' | 'dark', ClassStyle> = {
    light: { fill: '#ffffff', border: '#9a9a9a' },
    dark: { fill: '#252526', border: '#6a6a6a' },
};

/** Theme colours the Cytoscape stylesheet is built from */
export interface KnowledgeTheme {
    mode: 'light' | 'dark';
    text: string;
    subtleText: string;
    edgeLine: string;
    edgeText: string;
    accent: string;
    background: string;
}

const DARK_THEME: KnowledgeTheme = {
    mode: 'dark',
    text: '#e0e0e0',
    subtleText: '#a0a0a0',
    edgeLine: '#7a7a7a',
    edgeText: '#a0a0a0',
    accent: '#75beff',
    background: '#1e1e1e',
};

const LIGHT_THEME: KnowledgeTheme = {
    mode: 'light',
    text: '#222222',
    subtleText: '#555555',
    edgeLine: '#555555',
    edgeText: '#555555',
    accent: '#0090f1',
    background: '#ffffff',
};

/** Relative luminance of a hex or rgb() colour, or null when it cannot be read */
export function luminance(color: string): number | null {
    const c = toCytoscapeColor(color);
    if (!c) return null;
    let rgb: number[];
    if (c.startsWith('#')) {
        const digits = c.length === 4 ? c.slice(1).split('').map((d) => d + d).join('') : c.slice(1);
        rgb = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
    } else {
        const parts = /\(([^)]+)\)/.exec(c)?.[1].split(',').map((p) => parseFloat(p));
        if (!parts || parts.length < 3 || c.startsWith('hsl')) return null;
        rgb = parts.slice(0, 3);
    }
    const [r, g, b] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Read the theme colours visible at the element; dark when the background is unknown */
export function resolveKnowledgeTheme(element: Element | null): KnowledgeTheme {
    if (!element || typeof getComputedStyle === 'undefined') return { ...DARK_THEME };
    const style = getComputedStyle(element);
    const read = (name: string): string | null => toCytoscapeColor(style.getPropertyValue(name));
    const background = read('--vscode-editor-background');
    const lum = background ? luminance(background) : null;
    const base = lum !== null && lum > 0.5 ? LIGHT_THEME : DARK_THEME;
    return {
        mode: base.mode,
        text: read('--vscode-editor-foreground') ?? read('--vscode-foreground') ?? base.text,
        subtleText: read('--vscode-descriptionForeground') ?? base.subtleText,
        edgeLine: base.edgeLine,
        edgeText: read('--vscode-descriptionForeground') ?? base.edgeText,
        accent: read('--vscode-focusBorder') ?? base.accent,
        background: background ?? base.background,
    };
}

/** Automatic palette for the theme mode */
export function classPalette(mode: 'light' | 'dark'): ClassStyle[] {
    return mode === 'light' ? LIGHT_CLASS_PALETTE : DARK_CLASS_PALETTE;
}
