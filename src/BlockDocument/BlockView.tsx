/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Rendering of the block tree: each block, its handle and menu, and the gaps between blocks
// Read-only it is plain semantic HTML; with an editor it gains the editing chrome

import React, { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

import { ADDRESS_FIELDS, addressLines, formatGeoPoint, type AddressField } from './address';
import { AddressForm } from './AddressForm';
import { DisplaySettings } from './DisplaySettings';
import { EditableText } from './EditableText';
import { useEditor, type Editor } from './editor';
import { declaredFields, FieldVisibilityContext, isFieldVisible, useFieldVisibility } from './fields';
import { EyeOffIcon, GearIcon, GripIcon, PencilIcon, PinIcon, PlusIcon } from './icons';
import { MediaForm } from './MediaForm';
import { useMessages, type BlockDocumentMessages } from './messages';
import { Menu, type MenuItem } from './Menu';
import { richTextToPlain, safeHref } from './richText';
import {
    isAddressBlock,
    isChapterBlock,
    isImageBlock,
    isKnownBlock,
    isParagraphBlock,
    isVideoBlock,
    type AddressBlock,
    type BlockFieldVisibility,
    type BlockLocation,
    type DocumentBlock,
    type RichText,
} from './types';

const DRAG_TYPE = 'application/x-block-document-block';

/** Formatted text as elements — React escapes every string, no HTML is ever parsed */
export function RichTextView({ spans }: { spans: RichText }): React.ReactElement {
    return (
        <>
            {spans.map((span, i) => {
                let node: React.ReactNode = span.text;
                if (span.code) node = <code>{node}</code>;
                if (span.italic) node = <em>{node}</em>;
                if (span.bold) node = <strong>{node}</strong>;
                const href = safeHref(span.href);
                if (href) {
                    node = (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                            {node}
                        </a>
                    );
                }
                return <React.Fragment key={i}>{node}</React.Fragment>;
            })}
        </>
    );
}

function headingTag(depth: number): 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
    return `h${Math.min(depth + 2, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

function sameLocation(a: BlockLocation, b: BlockLocation): boolean {
    return a.parentId === b.parentId && a.index === b.index;
}

interface ListProps {
    blocks: DocumentBlock[];
    parentId?: string;
    depth: number;
}

/** A list of sibling blocks, with an insertion gap before, between and after them */
export function BlockList({ blocks, parentId, depth }: ListProps): React.ReactElement {
    const editor = useEditor();
    const items: React.ReactNode[] = [];
    blocks.forEach((block, index) => {
        if (editor) items.push(<InsertGap key={`gap-${index}`} parentId={parentId} index={index} />);
        items.push(
            <BlockView
                key={block.id}
                block={block}
                parentId={parentId}
                index={index}
                count={blocks.length}
                depth={depth}
            />,
        );
    });
    if (editor) items.push(<InsertGap key={`gap-${blocks.length}`} parentId={parentId} index={blocks.length} />);
    return <>{items}</>;
}

interface GapProps {
    parentId?: string;
    index: number;
}

/** Where a new block can be inserted, and where a dragged block can be dropped */
function InsertGap({ parentId, index }: GapProps): React.ReactElement | null {
    const editor = useEditor()!;
    const host = useContext(FieldVisibilityContext);
    const text = useMessages();
    const [menuOpen, setMenuOpen] = useState(false);
    const [over, setOver] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const location: BlockLocation = { parentId, index };
    const form = editor.mediaForm;
    const insertType = form?.kind === 'insert' && sameLocation(form.location, location) ? form.type : null;
    const droppable = editor.draggingId !== null && editor.canDropAt(editor.draggingId, location);

    const closeMenu = useCallback((restoreFocus: boolean) => {
        setMenuOpen(false);
        if (restoreFocus) buttonRef.current?.focus();
    }, []);

    return (
        <div
            className={`bd-gap${over && droppable ? ' bd-gap--over' : ''}${droppable ? ' bd-gap--droppable' : ''}`}
            onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const id = editor.draggingId ?? e.dataTransfer.getData(DRAG_TYPE);
                editor.setDraggingId(null);
                if (id) editor.dropAt(id, location);
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                className="bd-gap-add"
                tabIndex={-1}
                aria-label={text.insertHere}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
            >
                <PlusIcon />
            </button>
            {menuOpen && (
                <Menu
                    label={text.insertMenu}
                    onClose={closeMenu}
                    items={insertItems(editor, location, text.insert)}
                />
            )}
            {insertType === 'address' && (
                <AddressForm
                    mode="insert"
                    visible={(field) => isFieldVisible({ id: '', type: 'address' }, field, host)}
                    onCancel={() => editor.setMediaForm(null)}
                    onSubmit={(fields) => {
                        editor.setMediaForm(null);
                        editor.insertAddress(location, fields);
                    }}
                />
            )}
            {insertType && insertType !== 'address' && (
                <MediaForm
                    type={insertType}
                    mode="insert"
                    onCancel={() => editor.setMediaForm(null)}
                    onSubmit={(fields) => {
                        editor.setMediaForm(null);
                        editor.insertMedia(insertType, location, fields);
                    }}
                />
            )}
        </div>
    );
}

function insertItems(editor: Editor, location: BlockLocation, labels: BlockDocumentMessages['insert']): MenuItem[] {
    return [
        { label: labels.paragraph, onSelect: () => editor.insertText('paragraph', location) },
        { label: labels.chapter, onSelect: () => editor.insertText('chapter', location) },
        {
            label: labels.image,
            onSelect: () => editor.setMediaForm({ kind: 'insert', type: 'image', location }),
        },
        {
            label: labels.video,
            onSelect: () => editor.setMediaForm({ kind: 'insert', type: 'video', location }),
        },
        {
            label: labels.address,
            onSelect: () => editor.setMediaForm({ kind: 'insert', type: 'address', location }),
        },
    ];
}

interface BlockProps {
    block: DocumentBlock;
    parentId?: string;
    index: number;
    count: number;
    depth: number;
}

function BlockView({ block, parentId, index, count, depth }: BlockProps): React.ReactElement {
    const editor = useEditor();
    const host = useContext(FieldVisibilityContext);
    const text = useMessages();
    const ref = useRef<HTMLDivElement>(null);
    const headingId = useId();
    const [menuOpen, setMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const handleRef = useRef<HTMLButtonElement>(null);
    const settingsRef = useRef<HTMLButtonElement>(null);
    const textual = isParagraphBlock(block) || isChapterBlock(block);

    // A block without text of its own takes focus on its wrapper
    useEffect(() => {
        if (!editor || textual) return undefined;
        return editor.registerFocus(block.id, {
            focus: () => ref.current?.focus(),
            caret: () => undefined,
        });
    }, [editor, textual, block.id]);

    const closeMenu = useCallback((restoreFocus: boolean) => {
        setMenuOpen(false);
        if (restoreFocus) handleRef.current?.focus();
    }, []);

    const closeSettings = useCallback((restoreFocus: boolean) => {
        setSettingsOpen(false);
        if (restoreFocus) settingsRef.current?.focus();
    }, []);

    const onKeyDown = (e: React.KeyboardEvent): void => {
        if (!editor || !e.altKey || e.ctrlKey || e.metaKey) return;
        const actions: Record<string, () => void> = {
            ArrowUp: () => editor.moveBy(block.id, -1),
            ArrowDown: () => editor.moveBy(block.id, 1),
            ArrowRight: () => editor.indent(block.id),
            ArrowLeft: () => editor.outdent(block.id),
        };
        const action = actions[e.key];
        if (!action) return;
        // The innermost block handles it; a chapter must not move along with its child
        e.preventDefault();
        e.stopPropagation();
        action();
    };

    const content = renderContent(block, depth, headingId, editor, text, host);
    if (!editor) {
        return <div className={`bd-block bd-block--${blockClass(block)}`}>{content}</div>;
    }

    const below: BlockLocation = { parentId, index: index + 1 };
    const hasForm = isImageBlock(block) || isVideoBlock(block) || isAddressBlock(block);
    const hasSettings = declaredFields(block, text.fields).length > 0;
    // Text is edited in place, so its edit button puts the caret at the end of it
    const editingMedia = editor.mediaForm?.kind === 'edit' && editor.mediaForm.blockId === block.id;
    // A form opens on the first press and closes on the second
    const edit = hasForm
        ? () => editor.setMediaForm(editingMedia ? null : { kind: 'edit', blockId: block.id })
        : textual
          ? () => editor.focusBlock(block.id, 'end')
          : null;
    const menuItems: MenuItem[] = [
        ...insertItems(editor, below, text.insertBelow),
        ...(index > 0 ? [{ label: text.moveUp, onSelect: () => editor.moveBy(block.id, -1) }] : []),
        ...(index < count - 1 ? [{ label: text.moveDown, onSelect: () => editor.moveBy(block.id, 1) }] : []),
        ...(editor.canIndent(block.id)
            ? [{ label: text.moveIntoChapter, onSelect: () => editor.indent(block.id) }]
            : []),
        ...(parentId ? [{ label: text.moveOutOfChapter, onSelect: () => editor.outdent(block.id) }] : []),
        ...(hasForm
            ? [
                  {
                      label: text.editMenu[block.type as keyof BlockDocumentMessages['editMenu']],
                      onSelect: () => editor.setMediaForm({ kind: 'edit', blockId: block.id }),
                  },
              ]
            : []),
        { label: text.delete, danger: true, onSelect: () => editor.remove(block.id) },
    ];
    const blockName = describeBlock(block, text);

    return (
        <div
            ref={ref}
            className={`bd-block bd-block--${blockClass(block)}${editor.draggingId === block.id ? ' bd-block--dragging' : ''}`}
            data-block-id={block.id}
            tabIndex={-1}
            aria-label={textual ? undefined : blockName}
            onKeyDown={onKeyDown}
        >
            <div className="bd-handle-slot">
                <button
                    ref={handleRef}
                    type="button"
                    className="bd-handle"
                    aria-label={text.actionsFor(blockName)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    draggable
                    onClick={() => setMenuOpen((open) => !open)}
                    onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData(DRAG_TYPE, block.id);
                        if (ref.current) e.dataTransfer.setDragImage?.(ref.current, 0, 0);
                        editor.setDraggingId(block.id);
                    }}
                    onDragEnd={() => editor.setDraggingId(null)}
                >
                    <GripIcon />
                </button>
                {menuOpen && (
                    <Menu label={text.actionsFor(blockName)} items={menuItems} onClose={closeMenu} anchorRef={handleRef} />
                )}
            </div>
            {(edit || hasSettings) && (
                <div className="bd-tools">
                    {edit && (
                        <button
                            type="button"
                            className="bd-tool"
                            aria-label={text.editBlock(blockName)}
                            aria-pressed={hasForm ? editingMedia : undefined}
                            onClick={edit}
                        >
                            <PencilIcon />
                        </button>
                    )}
                    {hasSettings && (
                        <button
                            ref={settingsRef}
                            type="button"
                            className="bd-tool"
                            aria-label={text.displaySettingsFor(blockName)}
                            aria-haspopup="dialog"
                            aria-expanded={settingsOpen}
                            onClick={() => setSettingsOpen((open) => !open)}
                        >
                            <GearIcon />
                        </button>
                    )}
                    {settingsOpen && (
                        <DisplaySettings
                            block={block}
                            blockName={blockName}
                            fieldVisibility={host}
                            onChange={(visibility) => editor.update(block.id, { visibility })}
                            onClose={closeSettings}
                            anchorRef={settingsRef}
                        />
                    )}
                </div>
            )}
            {content}
            {editingMedia && isAddressBlock(block) && (
                <AddressForm
                    mode="edit"
                    initial={block}
                    visible={(field) => isFieldVisible(block, field, host)}
                    onCancel={() => editor.setMediaForm(null)}
                    onSubmit={(fields) => {
                        editor.setMediaForm(null);
                        editor.update(block.id, fields);
                        editor.requestFocus(block.id, 'start');
                    }}
                />
            )}
            {editingMedia && (isImageBlock(block) || isVideoBlock(block)) && (
                <MediaForm
                    type={block.type}
                    mode="edit"
                    initial={
                        isImageBlock(block) ? { src: block.src, alt: block.alt } : { src: block.src, poster: block.poster }
                    }
                    onCancel={() => editor.setMediaForm(null)}
                    onSubmit={(fields) => {
                        editor.setMediaForm(null);
                        editor.editMedia(block.id, fields);
                    }}
                />
            )}
        </div>
    );
}

function blockClass(block: DocumentBlock): string {
    return isKnownBlock(block) ? block.type : 'unknown';
}

function describeBlock(block: DocumentBlock, text: BlockDocumentMessages): string {
    const name = text.blockName;
    if (isChapterBlock(block)) return name.chapter(richTextToPlain(block.title));
    if (isParagraphBlock(block)) return name.paragraph;
    if (isImageBlock(block)) return name.image(block.alt);
    if (isVideoBlock(block)) return name.video(richTextToPlain(block.caption) || block.src);
    if (isAddressBlock(block)) return name.address(addressLines(block)[0] ?? '').trim();
    return name.unknown(block.type);
}

function Caption({ block, caption, editor }: { block: DocumentBlock; caption?: RichText; editor: Editor | null }) {
    const visible = useFieldVisibility(block)('caption');
    const text = useMessages();
    if (editor) {
        return (
            <>
                <EditableText
                    as="figcaption"
                    className={`bd-caption${visible ? '' : ' bd-field--hidden'}`}
                    value={caption ?? []}
                    label={text.caption}
                    placeholder={text.captionPlaceholder}
                    onChange={(next) => editor.update(block.id, { caption: next.length ? next : undefined })}
                />
                {!visible && <HiddenNote what={text.caption} />}
            </>
        );
    }
    if (!visible || !caption?.length) return null;
    return (
        <figcaption className="bd-caption">
            <RichTextView spans={caption} />
        </figcaption>
    );
}

/** The marker of a field the document does not show, seen only while editing */
function HiddenNote({ what }: { what?: string }): React.ReactElement {
    const text = useMessages();
    return (
        <span className="bd-hidden-note">
            <EyeOffIcon />
            {what ? text.fieldNotShown(what) : text.notShown}
        </span>
    );
}

/** An address as the reader sees it; while editing, its hidden fields follow, dimmed and marked */
function AddressView({ block, editing }: { block: AddressBlock; editing: boolean }): React.ReactElement {
    const visible = useFieldVisibility(block);
    const text = useMessages();
    const lines = addressLines(block, visible);
    if (block.ruianCode !== undefined && visible('ruianCode')) lines.push(`RÚIAN ${block.ruianCode}`);
    if (block.gps && visible('gps')) lines.push(formatGeoPoint(block.gps));

    const hidden = editing
        ? ADDRESS_FIELDS.filter((field) => !visible(field) && fieldText(block, field))
        : [];

    return (
        <div className="bd-address-block">
            <PinIcon />
            <div>
                {lines.length > 0 && (
                    <address className="bd-address">
                        {lines.map((line, i) => (
                            <span key={i} className="bd-address-line">
                                {line}
                            </span>
                        ))}
                    </address>
                )}
                {hidden.map((field) => (
                    <span key={field} className="bd-address-line bd-field--hidden">
                        <span className="bd-visually-hidden">{text.fields.address[field]}: </span>
                        {fieldText(block, field)} <HiddenNote />
                    </span>
                ))}
            </div>
        </div>
    );
}

function fieldText(block: AddressBlock, field: AddressField): string {
    if (field === 'gps') return block.gps ? formatGeoPoint(block.gps) : '';
    if (field === 'ruianCode') return block.ruianCode !== undefined ? String(block.ruianCode) : '';
    return block[field]?.trim() ?? '';
}

function renderContent(
    block: DocumentBlock,
    depth: number,
    headingId: string,
    editor: Editor | null,
    text: BlockDocumentMessages,
    host?: BlockFieldVisibility,
): React.ReactNode {
    if (isChapterBlock(block)) {
        const Heading = headingTag(depth);
        return (
            <section className="bd-chapter" aria-labelledby={headingId}>
                {editor ? (
                    <EditableText
                        as={Heading}
                        id={headingId}
                        className="bd-heading"
                        value={block.title}
                        label={text.chapterTitle}
                        placeholder={text.chapterTitle}
                        focusKey={block.id}
                        onChange={(title) => editor.update(block.id, { title })}
                        onEnter={() => {
                            editor.openChapter(block.id);
                            return true;
                        }}
                    />
                ) : (
                    <Heading id={headingId} className="bd-heading">
                        <RichTextView spans={block.title} />
                    </Heading>
                )}
                <div className="bd-chapter-body">
                    <BlockList blocks={block.children} parentId={block.id} depth={depth + 1} />
                </div>
            </section>
        );
    }
    if (isParagraphBlock(block)) {
        if (!editor) {
            return (
                <p className="bd-paragraph">
                    <RichTextView spans={block.text} />
                </p>
            );
        }
        return (
            <EditableText
                className="bd-paragraph"
                value={block.text}
                label={text.paragraph}
                placeholder={text.paragraphPlaceholder}
                multiline
                focusKey={block.id}
                onChange={(text) => editor.update(block.id, { text })}
                onEnter={({ offset }) => {
                    editor.splitParagraph(block.id, offset);
                    return true;
                }}
                onBackspaceAtStart={() => {
                    editor.backspaceAtStart(block.id);
                    return true;
                }}
            />
        );
    }
    if (isImageBlock(block)) {
        return (
            <figure className="bd-figure">
                <MediaImage src={block.src} alt={block.alt} />
                <Caption block={block} caption={block.caption} editor={editor} />
            </figure>
        );
    }
    if (isVideoBlock(block)) {
        return (
            <figure className="bd-figure">
                <MediaVideo
                    src={block.src}
                    poster={block.poster}
                    showPoster={!!editor || isFieldVisible(block, 'poster', host)}
                    label={richTextToPlain(block.caption) || text.video}
                />
                <Caption block={block} caption={block.caption} editor={editor} />
            </figure>
        );
    }
    if (isAddressBlock(block)) {
        return <AddressView block={block} editing={!!editor} />;
    }
    return (
        <div className="bd-unknown" role="note">
            {text.unsupportedBlock(block.type)}
        </div>
    );
}

/** The host's mapping from a stored media path to a URL, read-only or not */
export const MediaUrlContext = React.createContext<(src: string) => string>((src) => src);

function MediaImage({ src, alt }: { src: string; alt: string }): React.ReactElement {
    const resolve = React.useContext(MediaUrlContext);
    return <img className="bd-image" src={resolve(src)} alt={alt} loading="lazy" />;
}

function MediaVideo({
    src,
    poster,
    showPoster,
    label,
}: {
    src: string;
    poster?: string;
    showPoster: boolean;
    label: string;
}): React.ReactElement {
    const resolve = React.useContext(MediaUrlContext);
    return (
        <video
            className="bd-video"
            src={resolve(src)}
            poster={poster && showPoster ? resolve(poster) : undefined}
            controls
            preload="metadata"
            aria-label={label}
        />
    );
}
