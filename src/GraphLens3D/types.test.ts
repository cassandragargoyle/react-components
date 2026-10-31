/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the GraphLens3D helpers: link endpoint resolution, link keys
// and the node coloring by kind

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_NODE_COLOR,
    TAG_COLOR,
    VOICE_COLORS,
    endId,
    kindColor,
    kindLabel,
    kindOf,
    linkKey,
    nodeKindColor,
    type GraphLensGroups,
    type GraphLensNode,
} from './types';

const tag: GraphLensNode = { id: 't1', type: 'tag', label: 'Pricing' };
const voice: GraphLensNode = { id: 'v1', type: 'voice', label: 'Too expensive', voice: 'VoC' };
const language: GraphLensNode = { id: 'l1', type: 'language', label: 'C' };
const groups: GraphLensGroups = {
    language: { label: 'Programming language', color: '#AABBCC' },
    tag: { color: '#112233' },
    VoC: { label: 'Customer' },
};

describe('GraphLens3D helpers', () => {
    it('resolves a link endpoint given as an id or as a node object', () => {
        expect(endId('n1')).toBe('n1');
        expect(endId({ id: 'n2', x: 1 })).toBe('n2');
    });

    it('builds the same key for string and object endpoints', () => {
        expect(linkKey('a', { id: 'b' })).toBe(linkKey({ id: 'a' }, 'b'));
        expect(linkKey('a', 'b')).not.toBe(linkKey('b', 'a'));
    });

    it('groups tags and voices by kind', () => {
        expect(kindOf(tag)).toBe('tag');
        expect(kindOf(voice)).toBe('VoC');
        expect(kindOf({ ...voice, voice: undefined })).toBe('voice');
    });

    it('colors nodes by kind with a neutral fallback', () => {
        expect(nodeKindColor(tag)).toBe(TAG_COLOR);
        expect(nodeKindColor(voice)).toBe(VOICE_COLORS.VoC);
        expect(nodeKindColor({ id: 'x', type: 'other', label: 'x' })).toBe(DEFAULT_NODE_COLOR);
        expect(kindColor('VoX')).toBe(DEFAULT_NODE_COLOR);
    });

    it('resolves the group in the order group, tag, voice, type', () => {
        expect(kindOf({ ...tag, group: 'g' })).toBe('g');
        expect(kindOf({ ...voice, group: 'g' })).toBe('g');
        expect(kindOf({ ...tag, voice: 'VoC' })).toBe('tag');
        expect(kindOf({ ...language, voice: 'VoC' })).toBe('VoC');
        expect(kindOf(language)).toBe('language');
    });

    it('ignores group, voice and type values that are not text', () => {
        for (const value of [{ a: 1 }, 5, true, null, '']) {
            const invalid = value as unknown as string;
            expect(kindOf({ ...language, group: invalid })).toBe('language');
            expect(kindOf({ ...language, voice: invalid })).toBe('language');
            expect(kindOf({ ...language, type: invalid })).toBe('voice');
        }
    });

    it('falls back to the voice kind for a node without a type', () => {
        expect(kindOf({ id: 'x', label: 'x' } as unknown as GraphLensNode)).toBe('voice');
    });

    it('resolves the color in the order group definition, palette, default', () => {
        expect(nodeKindColor(language, groups)).toBe('#AABBCC');
        expect(nodeKindColor(tag, groups)).toBe('#112233');
        expect(nodeKindColor(voice, groups)).toBe(VOICE_COLORS.VoC);
        expect(nodeKindColor({ ...language, type: 'other' }, groups)).toBe(DEFAULT_NODE_COLOR);
    });

    it('falls back to default styling for an invalid group definition', () => {
        const invalid = {
            a: { color: 'red', label: '' },
            b: { color: '#12345', label: 42 },
            c: null,
            tag: 'gold',
        } as unknown as GraphLensGroups;
        expect(kindColor('a', invalid)).toBe(DEFAULT_NODE_COLOR);
        expect(kindColor('b', invalid)).toBe(DEFAULT_NODE_COLOR);
        expect(kindColor('c', invalid)).toBe(DEFAULT_NODE_COLOR);
        expect(kindColor('tag', invalid)).toBe(TAG_COLOR);
        expect(kindLabel('a', invalid)).toBe('a');
        expect(kindLabel('b', invalid)).toBe('b');
        expect(kindLabel('c', invalid)).toBe('c');
        expect(kindColor('a', 'groups' as unknown as GraphLensGroups)).toBe(DEFAULT_NODE_COLOR);
    });

    it('never reads a kind from Object.prototype', () => {
        expect(kindColor('constructor')).toBe(DEFAULT_NODE_COLOR);
        expect(kindColor('constructor', groups)).toBe(DEFAULT_NODE_COLOR);
        expect(kindLabel('constructor', groups)).toBe('constructor');
    });

    it('labels a group from its definition, or with the key', () => {
        expect(kindLabel('language', groups)).toBe('Programming language');
        expect(kindLabel('tag', groups)).toBe('tag');
        expect(kindLabel('other', groups)).toBe('other');
        expect(kindLabel('other')).toBe('other');
    });
});
