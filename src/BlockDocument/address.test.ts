/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the address layout (INT-003)
// The Czech cases are the samples of decree 359/2011 Sb., annex 1

import { describe, expect, it } from 'vitest';

import { addressLines, formatGeoPoint, hasAddressContent, isGeoPoint, isRuianCode } from './address';

describe('addressLines, the samples of decree 359/2011 Sb.', () => {
    it('1. Prague: the cadastral area as the part, the district with the city', () => {
        expect(
            addressLines({
                street: 'Studentská',
                houseNumber: '1903',
                houseNumberType: 'conscription',
                orientationNumber: '14a',
                municipalityPart: 'Dejvice',
                postalCode: '16000',
                city: 'Praha 6',
            }),
        ).toEqual(['Studentská 1903/14a', 'Dejvice', '16000 Praha 6']);
    });

    it('2. A registration number always reads č.ev.', () => {
        expect(
            addressLines({
                street: 'Koliště',
                houseNumber: '1',
                houseNumberType: 'registration',
                municipalityPart: 'Brno-město',
                postalCode: '60200',
                city: 'Brno',
            }),
        ).toEqual(['Koliště č.ev. 1', 'Brno-město', '60200 Brno']);
    });

    it('3. Streets, the part differing from the city', () => {
        expect(
            addressLines({
                street: 'Lhenická',
                houseNumber: '1120',
                houseNumberType: 'conscription',
                orientationNumber: '1',
                municipalityPart: 'České Budějovice 2',
                postalCode: '37005',
                city: 'České Budějovice',
            }),
        ).toEqual(['Lhenická 1120/1', 'České Budějovice 2', '37005 České Budějovice']);
    });

    it('4. Streets, the part the same as the city: the part is left out', () => {
        expect(
            addressLines({
                street: 'Žamberecká',
                houseNumber: '339',
                houseNumberType: 'conscription',
                municipalityPart: 'Vamberk',
                postalCode: '51601',
                city: 'Vamberk',
            }),
        ).toEqual(['Žamberecká 339', '51601 Vamberk']);
    });

    it('5. No streets, the part differing from the city: the number follows the part', () => {
        expect(
            addressLines({
                houseNumber: '13',
                houseNumberType: 'conscription',
                municipalityPart: 'Dolní Adršpach',
                postalCode: '54957',
                city: 'Adršpach',
            }),
        ).toEqual(['Dolní Adršpach 13', '54957 Adršpach']);
    });

    it('6. No streets, the part the same as the city: č.p. before the number', () => {
        expect(
            addressLines({
                houseNumber: '111',
                houseNumberType: 'conscription',
                municipalityPart: 'Praskačka',
                postalCode: '50333',
                city: 'Praskačka',
            }),
        ).toEqual(['č.p. 111', '50333 Praskačka']);
    });
});

describe('addressLines, anywhere', () => {
    it('writes a number without a type as it is, with no Czech prefix', () => {
        expect(addressLines({ houseNumber: '12', postalCode: '10115', city: 'Berlin', country: 'Germany' })).toEqual([
            '12',
            '10115 Berlin',
            'Germany',
        ]);
    });

    it('leaves no gap for an empty field and no line for an empty group', () => {
        expect(addressLines({ street: 'Lipová', houseNumber: '  ', city: 'Říčany' })).toEqual(['Lipová', 'Říčany']);
        expect(addressLines({ country: 'Czech Republic' })).toEqual(['Czech Republic']);
    });

    it('uses only the fields the filter shows', () => {
        const fields = { street: 'Lipová', houseNumber: '1234', orientationNumber: '12', city: 'Říčany', country: 'CZ' };
        expect(addressLines(fields, (field) => field !== 'country' && field !== 'houseNumber')).toEqual([
            'Lipová 12',
            'Říčany',
        ]);
    });
});

describe('address values', () => {
    it('accepts a WGS 84 point in range only', () => {
        expect(isGeoPoint({ lat: 49.9917, lon: 14.6543 })).toBe(true);
        expect(isGeoPoint({ lat: -90, lon: 180 })).toBe(true);
        expect(isGeoPoint({ lat: 91, lon: 0 })).toBe(false);
        expect(isGeoPoint({ lat: 0, lon: -181 })).toBe(false);
        expect(isGeoPoint({ lat: '49', lon: 14 })).toBe(false);
        expect(isGeoPoint({ lat: Number.NaN, lon: 14 })).toBe(false);
    });

    it('accepts a positive whole RÚIAN code only', () => {
        expect(isRuianCode(22376925)).toBe(true);
        expect(isRuianCode(0)).toBe(false);
        expect(isRuianCode(1.5)).toBe(false);
        expect(isRuianCode('22376925')).toBe(false);
    });

    it('formats coordinates in decimal degrees', () => {
        expect(formatGeoPoint({ lat: 49.9917, lon: 14.6543 })).toBe('49.9917, 14.6543');
    });

    it('counts an address with only coordinates or only a code as filled', () => {
        expect(hasAddressContent({})).toBe(false);
        expect(hasAddressContent({ street: ' ' })).toBe(false);
        expect(hasAddressContent({ gps: { lat: 0, lon: 0 } })).toBe(true);
        expect(hasAddressContent({ ruianCode: 1 })).toBe(true);
    });
});
