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
    kindOf,
    linkKey,
    nodeKindColor,
    type GraphLensNode,
} from './types';

const tag: GraphLensNode = { id: 't1', type: 'tag', label: 'Pricing' };
const voice: GraphLensNode = { id: 'v1', type: 'voice', label: 'Too expensive', voice: 'VoC' };

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
});
