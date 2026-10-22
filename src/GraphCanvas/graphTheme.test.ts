/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for the Graph Canvas theme palette and the stored-position layout choice
// Covers color normalization, theme variable lookup and the preset layout rule

import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_PALETTE, resolveGraphPalette, toCytoscapeColor } from './graphTheme';
import { initialLayoutOptions } from './GraphViewport';

describe('toCytoscapeColor', () => {
    it('keeps the forms Cytoscape parses', () => {
        expect(toCytoscapeColor(' #3794ff ')).toBe('#3794ff');
        expect(toCytoscapeColor('#abc')).toBe('#abc');
        expect(toCytoscapeColor('rgba(1, 2, 3, 0.5)')).toBe('rgba(1, 2, 3, 0.5)');
    });

    it('turns alpha hex into rgba', () => {
        expect(toCytoscapeColor('#cccccc80')).toBe('rgba(204, 204, 204, 0.5)');
        expect(toCytoscapeColor('#fff0')).toBe('rgba(255, 255, 255, 0)');
    });

    it('rejects what it cannot read', () => {
        expect(toCytoscapeColor('')).toBeNull();
        expect(toCytoscapeColor('var(--x)')).toBeNull();
    });
});

describe('resolveGraphPalette', () => {
    afterEach(() => document.body.removeAttribute('style'));

    it('falls back to the default palette without theme variables', () => {
        expect(resolveGraphPalette(document.body)).toEqual(DEFAULT_GRAPH_PALETTE);
        expect(resolveGraphPalette(null)).toEqual(DEFAULT_GRAPH_PALETTE);
    });

    it('reads VS Code theme variables', () => {
        document.body.style.setProperty('--vscode-charts-blue', '#3794ff');
        document.body.style.setProperty('--vscode-descriptionForeground', '#ccccccb3');
        const palette = resolveGraphPalette(document.body);
        expect(palette.nodePrimary).toBe('#3794ff');
        expect(palette.edgeText).toBe('rgba(204, 204, 204, 0.7)');
        expect(palette.nodeDatabase).toBe(DEFAULT_GRAPH_PALETTE.nodeDatabase);
    });
});

describe('initialLayoutOptions', () => {
    it('keeps stored positions when every node has one', () => {
        const nodes = [
            { id: 'a', position: { x: 0, y: 0 } },
            { id: 'b', position: { x: 10, y: 20 } },
        ];
        expect(initialLayoutOptions(nodes, 'dagre').name).toBe('preset');
    });

    it('runs the chosen algorithm when a position is missing', () => {
        const nodes = [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b' }];
        expect(initialLayoutOptions(nodes, 'circle').name).toBe('circle');
        expect(initialLayoutOptions([], 'grid').name).toBe('grid');
    });
});
