/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Guards the package entry point against a component going missing from the barrel
// These names are the contract portunix-vscode's pilot-ui re-exports depend on

import { describe, expect, it } from 'vitest';

import * as api from './index';

const EXPECTED = [
    'Avatar',
    'BlockDocument',
    'canMoveBlock',
    'insertBlock',
    'isBlockDocument',
    'moveBlock',
    'removeBlock',
    'updateBlock',
    'validateBlockDocument',
    'Carousel',
    'NodeTablePanel',
    'OpenPanel',
    'shortenHomePath',
    'ProgressPanel',
    'RadialMenu',
    'useRadialMenu',
] as const;

describe('package entry point', () => {
    it.each(EXPECTED)('exports %s', (name) => {
        expect(api).toHaveProperty(name);
        expect(api[name]).toBeTypeOf('function');
    });

    it('exports the OpenPanel default labels', () => {
        expect(api.DEFAULT_OPEN_PANEL_LABELS.title).toBe('Open a File or Project');
    });

    it('exports nothing beyond the declared surface', () => {
        expect(Object.keys(api).sort()).toEqual([...EXPECTED, 'DEFAULT_OPEN_PANEL_LABELS'].sort());
    });
});
