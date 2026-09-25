/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the BlockDocument editing functions (INT-001)
// Pure functions over the tree: no React, and the input is never mutated

import { describe, expect, it } from 'vitest';

import { canMoveBlock, findBlock, flattenBlocks, insertBlock, moveBlock, removeBlock, updateBlock } from './operations';
import type { BlockDocumentData, ChapterBlock, DocumentBlock } from './types';

const p = (id: string, text = id): DocumentBlock => ({ id, type: 'paragraph', text: [{ text }] });
const chapter = (id: string, children: DocumentBlock[]): ChapterBlock => ({
    id,
    type: 'chapter',
    title: [{ text: id }],
    children,
});

function fixture(): BlockDocumentData {
    return {
        schemaVersion: 1,
        id: 'doc',
        title: 'Doc',
        blocks: [p('a'), chapter('c1', [p('c1a'), chapter('c2', [p('c2a')])]), p('b')],
    };
}

const ids = (doc: BlockDocumentData): string[] => flattenBlocks(doc.blocks).map((found) => found.block.id);

describe('flattenBlocks / findBlock', () => {
    it('lists blocks in document order, a chapter before its children', () => {
        expect(ids(fixture())).toEqual(['a', 'c1', 'c1a', 'c2', 'c2a', 'b']);
    });

    it('reports parent, index and depth', () => {
        expect(findBlock(fixture(), 'c2a')).toMatchObject({ parentId: 'c2', index: 0, depth: 2 });
        expect(findBlock(fixture(), 'b')).toMatchObject({ parentId: undefined, index: 2, depth: 0 });
        expect(findBlock(fixture(), 'nope')).toBeUndefined();
    });
});

describe('insertBlock', () => {
    it('inserts at the top level and inside a chapter', () => {
        const doc = fixture();
        expect(ids(insertBlock(doc, p('x'), { index: 1 }))).toEqual(['a', 'x', 'c1', 'c1a', 'c2', 'c2a', 'b']);
        expect(ids(insertBlock(doc, p('y'), { parentId: 'c2', index: 0 }))).toEqual([
            'a', 'c1', 'c1a', 'c2', 'y', 'c2a', 'b',
        ]);
    });

    it('clamps the index to the list', () => {
        expect(ids(insertBlock(fixture(), p('x'), { index: 99 })).slice(-1)[0]).toBe('x');
        expect(ids(insertBlock(fixture(), p('x'), { index: -5 }))[0]).toBe('x');
    });

    it('does not mutate its input and keeps untouched subtrees', () => {
        const doc = fixture();
        const before = JSON.stringify(doc);
        const next = insertBlock(doc, p('x'), { index: 0 });
        expect(JSON.stringify(doc)).toBe(before);
        expect(next.blocks[2]).toBe(doc.blocks[1]);
    });

    it('refuses a taken id, also inside an inserted chapter', () => {
        expect(() => insertBlock(fixture(), p('a'), { index: 0 })).toThrow(/already/);
        expect(() => insertBlock(fixture(), chapter('new', [p('c2a')]), { index: 0 })).toThrow(/already/);
    });

    it('refuses a parent that is missing or not a chapter', () => {
        expect(() => insertBlock(fixture(), p('x'), { parentId: 'nope', index: 0 })).toThrow(/No block/);
        expect(() => insertBlock(fixture(), p('x'), { parentId: 'a', index: 0 })).toThrow(/only a chapter/);
    });
});

describe('removeBlock', () => {
    it('removes a block with everything inside it', () => {
        expect(ids(removeBlock(fixture(), 'c1'))).toEqual(['a', 'b']);
        expect(ids(removeBlock(fixture(), 'c2a'))).toEqual(['a', 'c1', 'c1a', 'c2', 'b']);
    });

    it('throws for an unknown id', () => {
        expect(() => removeBlock(fixture(), 'nope')).toThrow(/No block/);
    });
});

describe('moveBlock', () => {
    it('moves within a list, the index counted after the block is taken out', () => {
        expect(ids(moveBlock(fixture(), 'a', { index: 1 }))).toEqual(['c1', 'c1a', 'c2', 'c2a', 'a', 'b']);
        expect(ids(moveBlock(fixture(), 'b', { index: 0 }))).toEqual(['b', 'a', 'c1', 'c1a', 'c2', 'c2a']);
    });

    it('moves into and out of a chapter', () => {
        const into = moveBlock(fixture(), 'b', { parentId: 'c2', index: 1 });
        expect(findBlock(into, 'b')).toMatchObject({ parentId: 'c2', index: 1, depth: 2 });
        const out = moveBlock(into, 'c2a', { index: 0 });
        expect(findBlock(out, 'c2a')).toMatchObject({ parentId: undefined, index: 0 });
    });

    it('moves a chapter with its children', () => {
        const next = moveBlock(fixture(), 'c2', { index: 0 });
        expect(ids(next)).toEqual(['c2', 'c2a', 'a', 'c1', 'c1a', 'b']);
    });

    it('never moves a chapter into itself or its own subtree', () => {
        expect(canMoveBlock(fixture(), 'c1', { parentId: 'c1', index: 0 })).toBe(false);
        expect(canMoveBlock(fixture(), 'c1', { parentId: 'c2', index: 0 })).toBe(false);
        expect(() => moveBlock(fixture(), 'c1', { parentId: 'c2', index: 0 })).toThrow(/cannot be moved/);
        expect(canMoveBlock(fixture(), 'c2', { parentId: 'c1', index: 0 })).toBe(true);
    });

    it('refuses a missing block or a target that is not a chapter', () => {
        expect(canMoveBlock(fixture(), 'nope', { index: 0 })).toBe(false);
        expect(canMoveBlock(fixture(), 'a', { parentId: 'b', index: 0 })).toBe(false);
    });
});

describe('updateBlock', () => {
    it('changes fields and removes those set to undefined', () => {
        const doc: BlockDocumentData = {
            ...fixture(),
            blocks: [{ id: 'v', type: 'video', src: 'a.mp4', poster: 'a.jpg' }],
        };
        const next = updateBlock(doc, 'v', { src: 'b.mp4', poster: undefined });
        expect(next.blocks[0]).toEqual({ id: 'v', type: 'video', src: 'b.mp4' });
    });

    it('updates a nested block', () => {
        const next = updateBlock(fixture(), 'c2a', { text: [{ text: 'new' }] });
        expect(findBlock(next, 'c2a')!.block).toEqual({ id: 'c2a', type: 'paragraph', text: [{ text: 'new' }] });
    });

    it('never changes id, type or children', () => {
        const patch = { id: 'x', type: 'image', children: [] } as unknown as Parameters<typeof updateBlock>[2];
        const next = updateBlock(fixture(), 'c1', patch);
        expect(findBlock(next, 'c1')!.block).toEqual(fixture().blocks[1]);
    });

    it('throws for an unknown id', () => {
        expect(() => updateBlock(fixture(), 'nope', {})).toThrow(/No block/);
    });
});
