/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The address block (INT-003): its fields, how it is laid out, and what makes it valid
// The layout follows the Czech decree 359/2011 Sb., § 6; the fields follow OFN Adresy

import type { AddressBlock, GeoPoint, HouseNumberType } from './types';

/** The text fields of an address, in the order the form lists them */
export const ADDRESS_TEXT_FIELDS = [
    'street',
    'houseNumber',
    'orientationNumber',
    'municipalityPart',
    'postalCode',
    'city',
    'country',
] as const;

export type AddressTextField = (typeof ADDRESS_TEXT_FIELDS)[number];

/** The fields of an address the document can show or hide */
export type AddressField = AddressTextField | 'ruianCode' | 'gps';

/** Every field that can be shown or hidden, in form order */
export const ADDRESS_FIELDS: readonly AddressField[] = [...ADDRESS_TEXT_FIELDS, 'ruianCode', 'gps'];

/** The field values of an address, without its id and type */
export type AddressFields = Omit<AddressBlock, 'id' | 'type'>;

/** Every field of an address named, `undefined` where it is cleared — a patch for `updateBlock` */
export type AddressPatch = { [K in AddressKey]: AddressFields[K] | undefined };

// A plain key union, so the mapped type above keeps `undefined` in every property
type AddressKey = keyof AddressFields;

export const HOUSE_NUMBER_TYPES: readonly HouseNumberType[] = ['conscription', 'registration'];

/** Whether `value` is a WGS 84 point with both coordinates in range */
export function isGeoPoint(value: unknown): value is GeoPoint {
    if (typeof value !== 'object' || value === null) return false;
    const { lat, lon } = value as Record<string, unknown>;
    return (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
    );
}

/** Whether `value` can be a RÚIAN code: a positive whole number */
export function isRuianCode(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** `49.9917, 14.6543` */
export function formatGeoPoint(point: GeoPoint): string {
    return `${point.lat}, ${point.lon}`;
}

/** Whether an address has at least one field filled */
export function hasAddressContent(fields: Partial<AddressFields>): boolean {
    return (
        ADDRESS_TEXT_FIELDS.some((field) => !!fields[field]?.trim()) ||
        fields.ruianCode !== undefined ||
        fields.gps !== undefined
    );
}

const same = (a: string, b: string): boolean => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/**
 * The text lines of an address, per decree 359/2011 Sb., § 6:
 *
 * - street with `house number/orientation number`, `Studentská 1903/14a`
 * - part of municipality, only when it differs from the city
 * - postal code and city, `16000 Praha 6`
 * - country
 *
 * Without a street, the number follows the part of municipality, `Dolní Adršpach 13`; with
 * neither, a conscription number reads `č.p. 111`. A registration number always reads
 * `č.ev. 1`. Only the fields `show` accepts are used, and an empty field leaves no gap
 */
export function addressLines(
    fields: Partial<AddressFields>,
    show: (field: AddressTextField) => boolean = () => true,
): string[] {
    const value = (field: AddressTextField): string => (show(field) ? (fields[field]?.trim() ?? '') : '');
    const street = value('street');
    const house = value('houseNumber');
    const orientation = value('orientationNumber');
    const city = value('city');
    // The part of municipality is left out where it only repeats the city, shown or not
    const partName = value('municipalityPart');
    const part = partName && !same(partName, fields.city?.trim() ?? '') ? partName : '';

    let number = [house, orientation].filter(Boolean).join('/');
    if (house && fields.houseNumberType === 'registration') number = `č.ev. ${number}`;

    const lines: string[] = [];
    const join = (...parts: string[]): string => parts.filter(Boolean).join(' ');
    if (street) {
        lines.push(join(street, number));
        if (part) lines.push(part);
    } else if (part) {
        lines.push(join(part, number));
    } else if (number) {
        lines.push(house && fields.houseNumberType === 'conscription' ? `č.p. ${number}` : number);
    }
    const postal = join(value('postalCode'), city);
    if (postal) lines.push(postal);
    if (value('country')) lines.push(value('country'));
    return lines;
}
