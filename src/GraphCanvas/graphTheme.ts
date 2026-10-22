/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Graph Canvas color palette resolved from VS Code theme custom properties
// Falls back to the built-in dark palette when the host defines no theme variables

/** Colors the Cytoscape stylesheet is built from */
export interface GraphPalette {
    /** Default and `compute` node fill */
    nodePrimary: string;
    /** `database` node fill */
    nodeDatabase: string;
    /** `network` node fill */
    nodeNetwork: string;
    /** Text on colored node fills */
    nodeText: string;
    /** Selection and hover accent */
    accent: string;
    /** Edge line and arrow */
    edgeLine: string;
    /** Edge label text */
    edgeText: string;
    /** Label outline, matches the canvas background */
    background: string;
}

/** Theme variable and fallback for each palette entry */
const PALETTE_SOURCES: Record<keyof GraphPalette, { cssVar: string | null; fallback: string }> = {
    nodePrimary: { cssVar: '--vscode-charts-blue', fallback: '#4a9eff' },
    nodeDatabase: { cssVar: '--vscode-charts-orange', fallback: '#e6994a' },
    nodeNetwork: { cssVar: '--vscode-charts-green', fallback: '#4ae699' },
    nodeText: { cssVar: null, fallback: '#ffffff' },
    accent: { cssVar: '--vscode-focusBorder', fallback: '#75beff' },
    edgeLine: { cssVar: '--vscode-editorWidget-border', fallback: '#555555' },
    edgeText: { cssVar: '--vscode-descriptionForeground', fallback: '#858585' },
    background: { cssVar: '--vscode-editor-background', fallback: '#1e1e1e' },
};

/** Fallback palette used outside VS Code, e.g. in the Electron viewer */
export const DEFAULT_GRAPH_PALETTE: GraphPalette = Object.fromEntries(
    Object.entries(PALETTE_SOURCES).map(([key, source]) => [key, source.fallback])
) as unknown as GraphPalette;

/**
 * Turn a CSS color into a form Cytoscape parses, or null when it cannot
 * Cytoscape reads #rgb, #rrggbb, rgb(a)() and hsl(a)() but not the #rrggbbaa VS Code uses
 */
export function toCytoscapeColor(value: string): string | null {
    const color = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(color)) return color;
    const alphaHex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(color);
    if (!alphaHex) return null;
    const digits = alphaHex[1].length === 4
        ? alphaHex[1].split('').map((d) => d + d).join('')
        : alphaHex[1];
    const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(digits.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

/** Read the palette from the theme variables visible at the given element */
export function resolveGraphPalette(element: Element | null): GraphPalette {
    if (!element || typeof getComputedStyle === 'undefined') return { ...DEFAULT_GRAPH_PALETTE };
    const style = getComputedStyle(element);
    const palette = { ...DEFAULT_GRAPH_PALETTE };
    for (const [key, source] of Object.entries(PALETTE_SOURCES) as [keyof GraphPalette, typeof PALETTE_SOURCES[keyof GraphPalette]][]) {
        if (!source.cssVar) continue;
        const resolved = toCytoscapeColor(style.getPropertyValue(source.cssVar));
        if (resolved) palette[key] = resolved;
    }
    return palette;
}
