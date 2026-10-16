/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public entry point of @cassandragargoyle/react-components (ADR-012)
// Components migrate here from portunix-vscode; see its issues 125 and 132

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarKind } from './Avatar';

export { BlockDocument, isBlockDocument, validateBlockDocument, insertBlock, removeBlock, moveBlock, updateBlock, canMoveBlock, isFieldVisible, blockDocumentMessages } from './BlockDocument';
export type {
    AddressBlock,
    BlockDocumentProps,
    BlockDocumentValidation,
    BlockDocumentData,
    BlockDocumentMessages,
    BlockDocumentMessageOverrides,
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
} from './BlockDocument';

export { Carousel } from './Carousel';
export type { CarouselItem, CarouselProps } from './Carousel';

export { CodeEditor, resolveMonacoLanguage, configureCodeEditor, runPreflightCheck } from './CodeEditor';
export type {
    CodeEditorProps,
    CodeEditorConfig,
    CodeEditorDiagnosticLevel,
    CodeEditorDiagnosticSink,
    PreflightResult,
    PreflightFailureReason,
} from './CodeEditor';

export { GraphCanvas } from './GraphCanvas';
export type { GraphCanvasProps, GraphCanvasPort, GraphDocument, GraphNode, GraphEdge, LayoutAlgorithm } from './GraphCanvas';

export { GraphLens3D } from './GraphLens3D';
export type {
    GraphLens3DProps,
    GraphLensDocument,
    GraphLensMeta,
    GraphLensNode,
    GraphLensLink,
    GraphLensStatus,
    GraphLensSource,
    GraphLensPhase,
} from './GraphLens3D';

export { NodeTablePanel } from './NodeTablePanel';
export type { TableFilter, NodeTableRow } from './NodeTablePanel';

export { OpenPanel, DEFAULT_OPEN_PANEL_LABELS, shortenHomePath } from './OpenPanel';
export type {
    OpenPanelProps,
    OpenPanelRecentItem,
    OpenPanelItemType,
    OpenPanelLabels,
} from './OpenPanel';

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

export { WorkflowCanvas } from './WorkflowCanvas';
export type { WorkflowCanvasProps, WorkflowCanvasPort, WorkflowDocument, WorkflowNode, WorkflowEdge } from './WorkflowCanvas';
