/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for BlockDocument validation (INT-001)
// The family house sample must pass; each broken shape must name where it is broken

import { describe, expect, it } from 'vitest';

import sample from './samples/family-house.blockdocument.json';
import { isBlockDocument, validateBlockDocument } from './validate';

const base = { schemaVersion: 1, id: 'd', title: 'T' };

describe('validateBlockDocument', () => {
    it('accepts the family house sample', () => {
        const result = validateBlockDocument(sample);
        expect(result).toMatchObject({ ok: true });
        expect(isBlockDocument(sample)).toBe(true);
    });

    it('keeps an unknown block type', () => {
        expect(isBlockDocument({ ...base, blocks: [{ id: 'x', type: 'table', rows: [] }] })).toBe(true);
    });

    it.each([
        ['not an object', null, ''],
        ['no schema version', { id: 'd', title: 'T', blocks: [] }, 'schemaVersion'],
        ['a newer schema version', { ...base, schemaVersion: 2, blocks: [] }, 'schemaVersion'],
        ['blocks not an array', { ...base, blocks: {} }, 'blocks'],
        ['a block without an id', { ...base, blocks: [{ type: 'paragraph', text: [] }] }, 'blocks[0].id'],
        [
            'a duplicate id',
            { ...base, blocks: [{ id: 'a', type: 'paragraph', text: [] }, { id: 'a', type: 'paragraph', text: [] }] },
            'blocks[1].id',
        ],
        ['an image without alt', { ...base, blocks: [{ id: 'i', type: 'image', src: 'a.png' }] }, 'blocks[0].alt'],
        ['an image with an empty alt', { ...base, blocks: [{ id: 'i', type: 'image', src: 'a.png', alt: ' ' }] }, 'blocks[0].alt'],
        ['a video without src', { ...base, blocks: [{ id: 'v', type: 'video' }] }, 'blocks[0].src'],
        [
            'a span with a non-boolean flag',
            { ...base, blocks: [{ id: 'p', type: 'paragraph', text: [{ text: 'x', bold: 'yes' }] }] },
            'blocks[0].text[0].bold',
        ],
        [
            'a broken block inside a chapter',
            { ...base, blocks: [{ id: 'c', type: 'chapter', title: [], children: [{ id: 'p', type: 'paragraph' }] }] },
            'blocks[0].children[0].text',
        ],
    ])('rejects %s', (_name, data, path) => {
        const result = validateBlockDocument(data);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.path).toBe(path);
    });
});
