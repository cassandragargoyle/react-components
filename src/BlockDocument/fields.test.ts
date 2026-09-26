/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for field visibility (ADR-001)
// The block's override wins over the host's, and the host's over the type default

import { describe, expect, it } from 'vitest';

import { inheritedFieldVisibility, isFieldVisible } from './fields';
import type { AddressBlock, DocumentBlock } from './types';

const address = (visibility?: Record<string, boolean>): AddressBlock => ({
    id: 'a',
    type: 'address',
    city: 'Říčany',
    gps: { lat: 49.9917, lon: 14.6543 },
    ...(visibility ? { visibility } : {}),
});

describe('isFieldVisible', () => {
    it('falls back to the type default', () => {
        expect(isFieldVisible(address(), 'city')).toBe(true);
        expect(isFieldVisible(address(), 'gps')).toBe(false);
        expect(isFieldVisible(address(), 'ruianCode')).toBe(false);
    });

    it('lets the host override the type default', () => {
        expect(isFieldVisible(address(), 'gps', { address: { gps: true } })).toBe(true);
        expect(isFieldVisible(address(), 'city', { address: { city: false } })).toBe(false);
    });

    it('lets the block override the host, in both directions', () => {
        expect(isFieldVisible(address({ gps: false }), 'gps', { address: { gps: true } })).toBe(false);
        expect(isFieldVisible(address({ gps: true }), 'gps', { address: { gps: false } })).toBe(true);
    });

    it('keeps the level below for a field an override does not name', () => {
        expect(isFieldVisible(address({ country: false }), 'gps', { address: { city: false } })).toBe(false);
        expect(isFieldVisible(address({ country: false }), 'street')).toBe(true);
    });

    it('applies a host override only to its own block type', () => {
        const image: DocumentBlock = { id: 'i', type: 'image', src: 'a.png', alt: 'A' };
        expect(isFieldVisible(image, 'caption', { address: { caption: false } })).toBe(true);
        expect(isFieldVisible(image, 'caption', { image: { caption: false } })).toBe(false);
    });

    it('shows a field no level knows, also of an unknown type', () => {
        expect(isFieldVisible(address(), 'floor')).toBe(true);
        expect(isFieldVisible({ id: 'x', type: 'table' }, 'rows')).toBe(true);
    });

    it('ignores a value that is not a boolean', () => {
        const block = { ...address(), visibility: { gps: 'yes' } } as unknown as DocumentBlock;
        expect(isFieldVisible(block, 'gps')).toBe(false);
    });
});

describe('inheritedFieldVisibility', () => {
    it('is what the host and the type give, whatever the block says', () => {
        expect(inheritedFieldVisibility(address({ gps: true }), 'gps')).toBe(false);
        expect(inheritedFieldVisibility(address({ gps: false }), 'gps', { address: { gps: true } })).toBe(true);
    });
});
