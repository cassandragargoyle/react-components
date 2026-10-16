/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for BlockDocument validation (INT-001, INT-003, INT-004)
// The family house sample must pass; each broken shape must name where it is broken

import { describe, expect, it } from 'vitest';

import sample from './samples/family-house.blockdocument.json';
import czechSample from './samples/rodinny-dum.blockdocument.json';
import { isBlockDocument, validateBlockDocument } from './validate';

const base = { schemaVersion: 1, id: 'd', title: 'T' };

describe('validateBlockDocument', () => {
    it('accepts the family house sample', () => {
        const result = validateBlockDocument(sample);
        expect(result).toMatchObject({ ok: true });
        expect(isBlockDocument(sample)).toBe(true);
    });

    it('accepts the Czech family house sample, written in cs', () => {
        expect(validateBlockDocument(czechSample)).toMatchObject({ ok: true, document: { language: 'cs' } });
    });

    it('accepts a document language, and a document without one', () => {
        expect(isBlockDocument({ ...base, language: 'cs-CZ', blocks: [] })).toBe(true);
        expect(isBlockDocument({ ...base, blocks: [] })).toBe(true);
    });

    it('keeps an unknown block type', () => {
        expect(isBlockDocument({ ...base, blocks: [{ id: 'x', type: 'table', rows: [] }] })).toBe(true);
    });

    it('accepts an address, and visibility on any block', () => {
        const address = {
            id: 'a',
            type: 'address',
            street: 'Koliště',
            houseNumber: '1',
            houseNumberType: 'registration',
            ruianCode: 22376925,
            gps: { lat: 49.2, lon: 16.6 },
            visibility: { gps: true, floor: false },
        };
        const paragraph = { id: 'p', type: 'paragraph', text: [], visibility: { text: true } };
        expect(validateBlockDocument({ ...base, blocks: [address, paragraph] })).toMatchObject({ ok: true });
        expect(isBlockDocument({ ...base, blocks: [{ id: 'g', type: 'address', gps: { lat: 0, lon: 0 } }] })).toBe(true);
    });

    it.each([
        ['not an object', null, ''],
        ['no schema version', { id: 'd', title: 'T', blocks: [] }, 'schemaVersion'],
        ['a newer schema version', { ...base, schemaVersion: 2, blocks: [] }, 'schemaVersion'],
        ['blocks not an array', { ...base, blocks: {} }, 'blocks'],
        ['a language not a string', { ...base, language: 7, blocks: [] }, 'language'],
        ['an empty language', { ...base, language: ' ', blocks: [] }, 'language'],
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
        ['an empty address', { ...base, blocks: [{ id: 'a', type: 'address', city: ' ' }] }, 'blocks[0]'],
        ['an address field not a string', { ...base, blocks: [{ id: 'a', type: 'address', houseNumber: 12 }] }, 'blocks[0].houseNumber'],
        [
            'coordinates out of range',
            { ...base, blocks: [{ id: 'a', type: 'address', gps: { lat: 91, lon: 14 } }] },
            'blocks[0].gps',
        ],
        ['coordinates without lon', { ...base, blocks: [{ id: 'a', type: 'address', gps: { lat: 49 } }] }, 'blocks[0].gps'],
        [
            'an unknown house number type',
            { ...base, blocks: [{ id: 'a', type: 'address', houseNumber: '1', houseNumberType: 'cp' }] },
            'blocks[0].houseNumberType',
        ],
        ['a RÚIAN code as a string', { ...base, blocks: [{ id: 'a', type: 'address', ruianCode: '1' }] }, 'blocks[0].ruianCode'],
        [
            'a non-boolean visibility',
            { ...base, blocks: [{ id: 'p', type: 'paragraph', text: [], visibility: { text: 'yes' } }] },
            'blocks[0].visibility.text',
        ],
        [
            'visibility not an object',
            { ...base, blocks: [{ id: 'x', type: 'table', visibility: ['gps'] }] },
            'blocks[0].visibility',
        ],
    ])('rejects %s', (_name, data, path) => {
        const result = validateBlockDocument(data);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.path).toBe(path);
    });
});
