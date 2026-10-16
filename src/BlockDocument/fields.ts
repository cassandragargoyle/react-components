/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Field visibility of the BlockDocument blocks (ADR-001): the fields each type declares
// A field is shown per the block's override, else the host's, else the type's default

import { createContext, useContext } from 'react';

import { blockDocumentMessages, type BlockDocumentMessages } from './messages';
import type { BlockFieldVisibility, DocumentBlock, FieldVisibility, KnownBlockType } from './types';

/**
 * The fields each known type can show or hide, with whether the document shows them by default.
 * Chapter and paragraph declare none: hiding their only content would hide the block
 */
export const BLOCK_FIELDS: Readonly<Record<KnownBlockType, Readonly<Record<string, boolean>>>> = {
    chapter: {},
    paragraph: {},
    image: { caption: true },
    video: { poster: true, caption: true },
    address: {
        street: true,
        houseNumber: true,
        orientationNumber: true,
        municipalityPart: true,
        postalCode: true,
        city: true,
        country: true,
        ruianCode: false,
        gps: false,
    },
};

/**
 * The fields of a block the display settings offer, with their labels from `labels`
 * (English by default); empty for a type with none
 */
export function declaredFields(
    block: DocumentBlock,
    labels: BlockDocumentMessages['fields'] = blockDocumentMessages.en.fields,
): { field: string; label: string }[] {
    const declared = (BLOCK_FIELDS as Record<string, Record<string, boolean> | undefined>)[block.type] ?? {};
    const named = (labels as Readonly<Record<string, Readonly<Record<string, string>> | undefined>>)[block.type];
    return Object.keys(declared).map((field) => ({ field, label: named?.[field] ?? field }));
}

/**
 * Whether the document shows `field` of `block`: the block's `visibility`, else the host's
 * `fieldVisibility` for the block type, else the type default; a field no level knows is shown
 */
export function isFieldVisible(
    block: DocumentBlock,
    field: string,
    fieldVisibility?: BlockFieldVisibility,
): boolean {
    const own = block.visibility as Record<string, unknown> | undefined;
    if (typeof own?.[field] === 'boolean') return own[field] as boolean;
    const host = fieldVisibility?.[block.type]?.[field];
    if (typeof host === 'boolean') return host;
    const declared = (BLOCK_FIELDS as Record<string, Record<string, boolean> | undefined>)[block.type]?.[field];
    return declared ?? true;
}

/** What `field` of `block` inherits from the host and the type, ignoring the block's own override */
export function inheritedFieldVisibility(
    block: DocumentBlock,
    field: string,
    fieldVisibility?: BlockFieldVisibility,
): boolean {
    return isFieldVisible({ id: block.id, type: block.type }, field, fieldVisibility);
}

/** The host's `fieldVisibility`, for the blocks below `BlockDocument` */
export const FieldVisibilityContext = createContext<BlockFieldVisibility | undefined>(undefined);

/** Whether the document shows a field of `block`, under the host's `fieldVisibility` */
export function useFieldVisibility(block: DocumentBlock): (field: string) => boolean {
    const host = useContext(FieldVisibilityContext);
    return (field) => isFieldVisible(block, field, host);
}

/**
 * The block's `visibility` after showing or hiding `field`: a value equal to what the field
 * inherits is no override and is dropped; names this does not touch are kept.
 * `undefined` when no override is left
 */
export function withFieldShown(
    block: DocumentBlock,
    field: string,
    shown: boolean,
    fieldVisibility?: BlockFieldVisibility,
): FieldVisibility | undefined {
    const next: FieldVisibility = { ...(block.visibility as FieldVisibility | undefined) };
    if (shown === inheritedFieldVisibility(block, field, fieldVisibility)) delete next[field];
    else next[field] = shown;
    return Object.keys(next).length ? next : undefined;
}
