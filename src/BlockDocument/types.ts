/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The BlockDocument format (INT-001): a document is a tree of typed blocks
// Version 1 knows chapters, paragraphs, images, videos and addresses; anything else is kept as is

/** The format version this component reads and writes */
export const BLOCK_DOCUMENT_SCHEMA_VERSION = 1;

/** A run of text with one formatting; `href` makes it a link */
export interface TextSpan {
    text: string;
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    /** Only http:, https: and mailto: are rendered as a link */
    href?: string;
}

/** Formatted text — never HTML */
export type RichText = TextSpan[];

/**
 * Which fields of a block the document shows, by field name (ADR-001).
 * An override: a field it does not name keeps the value from the level below
 */
export type FieldVisibility = Record<string, boolean>;

/** A host's field visibility per block type, e.g. `{ address: { gps: true } }` */
export type BlockFieldVisibility = Partial<Record<string, FieldVisibility>>;

/** A heading that holds its own blocks; its level is its nesting depth */
export interface ChapterBlock {
    id: string;
    type: 'chapter';
    /** Overrides which fields the document shows (ADR-001) */
    visibility?: FieldVisibility;
    title: RichText;
    children: DocumentBlock[];
}

/** A paragraph of formatted text */
export interface ParagraphBlock {
    id: string;
    type: 'paragraph';
    /** Overrides which fields the document shows (ADR-001) */
    visibility?: FieldVisibility;
    text: RichText;
}

/** A picture; `alt` is required */
export interface ImageBlock {
    id: string;
    type: 'image';
    /** Overrides which fields the document shows (ADR-001) */
    visibility?: FieldVisibility;
    src: string;
    alt: string;
    caption?: RichText;
}

/** A video played with the browser's native controls */
export interface VideoBlock {
    id: string;
    type: 'video';
    /** Overrides which fields the document shows (ADR-001) */
    visibility?: FieldVisibility;
    src: string;
    poster?: string;
    caption?: RichText;
}

/** A point in WGS 84, in decimal degrees */
export interface GeoPoint {
    /** -90..90 */
    lat: number;
    /** -180..180 */
    lon: number;
}

/** Whether a Czech house number is a conscription number (`č.p.`) or a registration number (`č.ev.`) */
export type HouseNumberType = 'conscription' | 'registration';

/**
 * A postal address; every field is optional, but not all of them at once.
 * Laid out per the Czech decree 359/2011 Sb., § 6, which also fits most of Europe.
 * `ruianCode` and `gps` are hidden by default
 */
export interface AddressBlock {
    id: string;
    type: 'address';
    street?: string;
    /** The building number; in Czechia the conscription or registration number, `1903` */
    houseNumber?: string;
    /** Set only for a Czech address; absent, the house number is shown as it is */
    houseNumberType?: HouseNumberType;
    /** The Czech orientation number with its letter, `14a`; written after the house number, `1903/14a` */
    orientationNumber?: string;
    /** The part of the municipality, in Prague the cadastral area; shown only when it differs from the city */
    municipalityPart?: string;
    postalCode?: string;
    /** The municipality, in Prague with its district, `Praha 6` */
    city?: string;
    country?: string;
    /** The code of the address place in the Czech register RÚIAN */
    ruianCode?: number;
    gps?: GeoPoint;
    /** Overrides which fields the document shows (ADR-001) */
    visibility?: FieldVisibility;
}

/** A block of a type this version does not know — rendered as a placeholder and preserved */
export interface UnknownBlock {
    id: string;
    type: string;
    [key: string]: unknown;
}

/** A block this version knows how to render and edit */
export type KnownBlock = ChapterBlock | ParagraphBlock | ImageBlock | VideoBlock | AddressBlock;

/** Any block of a document */
export type DocumentBlock = KnownBlock | UnknownBlock;

/** The type names of the blocks this version knows */
export type KnownBlockType = KnownBlock['type'];

/** The type names of the blocks this version knows, for runtime checks */
export const KNOWN_BLOCK_TYPES: ReadonlySet<string> = new Set<KnownBlockType>([
    'chapter',
    'paragraph',
    'image',
    'video',
    'address',
]);

/** A whole document */
export interface BlockDocumentData {
    schemaVersion: number;
    id: string;
    title: string;
    blocks: DocumentBlock[];
}

/** A position in the tree: `index` within the children of `parentId`, or of the root */
export interface BlockLocation {
    /** The chapter to place the block in; absent for the top level */
    parentId?: string;
    index: number;
}

/** Fields of a block that `updateBlock` may change; `id`, `type` and `children` are not among them */
export type BlockPatch = Partial<{
    title: RichText;
    text: RichText;
    src: string;
    alt: string;
    poster: string | undefined;
    caption: RichText | undefined;
    street: string | undefined;
    houseNumber: string | undefined;
    houseNumberType: HouseNumberType | undefined;
    orientationNumber: string | undefined;
    municipalityPart: string | undefined;
    postalCode: string | undefined;
    city: string | undefined;
    country: string | undefined;
    ruianCode: number | undefined;
    gps: GeoPoint | undefined;
    visibility: FieldVisibility | undefined;
}>;

/** Narrows a block to a chapter */
export function isChapterBlock(block: DocumentBlock): block is ChapterBlock {
    return block.type === 'chapter' && Array.isArray((block as ChapterBlock).children);
}

/** Narrows a block to a paragraph */
export function isParagraphBlock(block: DocumentBlock): block is ParagraphBlock {
    return block.type === 'paragraph';
}

/** Narrows a block to an image */
export function isImageBlock(block: DocumentBlock): block is ImageBlock {
    return block.type === 'image';
}

/** Narrows a block to a video */
export function isVideoBlock(block: DocumentBlock): block is VideoBlock {
    return block.type === 'video';
}

/** Narrows a block to an address */
export function isAddressBlock(block: DocumentBlock): block is AddressBlock {
    return block.type === 'address';
}

/** Whether a block is of a type this version knows */
export function isKnownBlock(block: DocumentBlock): block is KnownBlock {
    return KNOWN_BLOCK_TYPES.has(block.type);
}
