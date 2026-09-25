/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public entry point of @cassandragargoyle/react-components (ADR-012)
// Components migrate here from portunix-vscode; see its issue 125

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarKind } from './Avatar';

export { BlockDocument, isBlockDocument, validateBlockDocument, insertBlock, removeBlock, moveBlock, updateBlock, canMoveBlock } from './BlockDocument';
export type {
    BlockDocumentProps,
    BlockDocumentValidation,
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
} from './BlockDocument';

export { Carousel } from './Carousel';
export type { CarouselItem, CarouselProps } from './Carousel';

export { NodeTablePanel } from './NodeTablePanel';
export type { TableFilter, NodeTableRow } from './NodeTablePanel';

export { ProgressPanel } from './Progress';
export type {
    ProgressPanelProps,
    ProgressStep,
    ProgressStepState,
    ProgressField,
    ProgressSpinnerVariant,
} from './Progress';

export { RadialMenu, useRadialMenu } from './RadialMenu';
export type {
    RadialMenuAction,
    RadialMenuOptions,
    RadialMenuActive,
    UseRadialMenu,
} from './RadialMenu';
