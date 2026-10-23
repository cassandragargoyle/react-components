/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Guards the package entry point against a component going missing from the barrel
// These names are the contract portunix-vscode's pilot-ui re-exports depend on

/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import pkg from '../package.json';
import * as api from './index';

// Every component barrel, keyed `./<Dir>/index.ts`; loaded on demand, like a subpath import
const barrels = import.meta.glob<Record<string, unknown>>('./*/index.ts');

// The component subpaths of package.json "exports" (INT-005), as [subpath, barrel key]
const subpaths = Object.entries(pkg.exports).flatMap(([subpath, target]) => {
    if (subpath === '.' || typeof target === 'string') return [];
    return [[subpath, target.types.replace(/^\.\/dist\//, './').replace(/\.d\.ts$/, '.ts')] as const];
});

const EXPECTED = [
    'Avatar',
    'BlockDocument',
    'canMoveBlock',
    'insertBlock',
    'isBlockDocument',
    'isFieldVisible',
    'moveBlock',
    'removeBlock',
    'updateBlock',
    'validateBlockDocument',
    'Carousel',
    'CodeEditor',
    'configureCodeEditor',
    'resolveMonacoLanguage',
    'runPreflightCheck',
    'GitHistory',
    'parseUnifiedDiff',
    'GraphCanvas',
    'GraphLens3D',
    'MarkdownView',
    'slugify',
    'NodeTablePanel',
    'OpenPanel',
    'shortenHomePath',
    'ProgressPanel',
    'RadialMenu',
    'useRadialMenu',
    'WorkflowCanvas',
] as const;

describe('package entry point', () => {
    it.each(EXPECTED)('exports %s', (name) => {
        expect(api).toHaveProperty(name);
        expect(api[name]).toBeTypeOf('function');
    });

    it('exports the OpenPanel default labels', () => {
        expect(api.DEFAULT_OPEN_PANEL_LABELS.title).toBe('Open a File or Project');
    });

    it('exports the BlockDocument dictionaries', () => {
        expect(api.blockDocumentMessages.en.delete).toBe('Delete');
        expect(api.blockDocumentMessages.cs.delete).toBe('Smazat');
    });

    it('exports nothing beyond the declared surface', () => {
        expect(Object.keys(api).sort()).toEqual(
            [...EXPECTED, 'DEFAULT_OPEN_PANEL_LABELS', 'DEFAULT_GIT_HISTORY_LABELS', 'blockDocumentMessages'].sort(),
        );
    });
});

describe('component entry points', () => {
    it('gives every component directory its own subpath', () => {
        expect(subpaths.map(([, barrel]) => barrel).sort()).toEqual(Object.keys(barrels).sort());
    });

    it('names each subpath in kebab case after its directory', () => {
        for (const [subpath, barrel] of subpaths) {
            const directory = barrel.split('/')[1];
            const kebab = directory.replace(/([a-z])(?=[A-Z0-9])/g, '$1-').toLowerCase();
            expect(subpath).toBe(`./${kebab}`);
        }
    });

    it.each(subpaths)('%s exports what the root entry exports for it', async (_subpath, barrel) => {
        const module = await barrels[barrel]();
        const names = Object.keys(module);
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            expect(api).toHaveProperty(name, module[name]);
        }
    });
});
