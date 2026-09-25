/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for BlockDocument (INT-001)
// The component, the document format, its validation and the editing functions

export { BlockDocument } from './BlockDocument';
export type { BlockDocumentProps } from './BlockDocument';
export { isBlockDocument, validateBlockDocument } from './validate';
export type { BlockDocumentValidation } from './validate';
export { insertBlock, removeBlock, moveBlock, updateBlock, canMoveBlock } from './operations';
export type {
    BlockDocumentData,
    BlockLocation,
    BlockPatch,
    ChapterBlock,
    DocumentBlock,
    ImageBlock,
    KnownBlock,
    ParagraphBlock,
    RichText,
    TextSpan,
    UnknownBlock,
    VideoBlock,
} from './types';
