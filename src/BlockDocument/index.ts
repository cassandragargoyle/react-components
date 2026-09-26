/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for BlockDocument (INT-001, INT-003)
// The component, the document format, its validation, the editing functions and field visibility

export { BlockDocument } from './BlockDocument';
export type { BlockDocumentProps } from './BlockDocument';
export { isBlockDocument, validateBlockDocument } from './validate';
export type { BlockDocumentValidation } from './validate';
export { insertBlock, removeBlock, moveBlock, updateBlock, canMoveBlock } from './operations';
export { isFieldVisible } from './fields';
export type {
    AddressBlock,
    BlockDocumentData,
    BlockFieldVisibility,
    BlockLocation,
    BlockPatch,
    ChapterBlock,
    DocumentBlock,
    FieldVisibility,
    GeoPoint,
    HouseNumberType,
    ImageBlock,
    KnownBlock,
    ParagraphBlock,
    RichText,
    TextSpan,
    UnknownBlock,
    VideoBlock,
} from './types';
