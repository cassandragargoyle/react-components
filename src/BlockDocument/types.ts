/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The BlockDocument format (INT-001): a document is a tree of typed blocks
// Version 1 knows chapters, paragraphs, images and videos; anything else is kept as is

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

/** A heading that holds its own blocks; its level is its nesting depth */
export interface ChapterBlock {
    id: string;
    type: 'chapter';
    title: RichText;
    children: DocumentBlock[];
}

/** A paragraph of formatted text */
export interface ParagraphBlock {
    id: string;
    type: 'paragraph';
    text: RichText;
}

/** A picture; `alt` is required */
export interface ImageBlock {
    id: string;
    type: 'image';
    src: string;
    alt: string;
    caption?: RichText;
}

/** A video played with the browser's native controls */
export interface VideoBlock {
    id: string;
    type: 'video';
    src: string;
    poster?: string;
    caption?: RichText;
}

/** A block of a type this version does not know — rendered as a placeholder and preserved */
export interface UnknownBlock {
    id: string;
    type: string;
    [key: string]: unknown;
}

/** A block this version knows how to render and edit */
export type KnownBlock = ChapterBlock | ParagraphBlock | ImageBlock | VideoBlock;

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

/** Whether a block is of a type this version knows */
export function isKnownBlock(block: DocumentBlock): block is KnownBlock {
    return KNOWN_BLOCK_TYPES.has(block.type);
}
