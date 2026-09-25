/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Rendering of the block tree: each block, its handle and menu, and the gaps between blocks
// Read-only it is plain semantic HTML; with an editor it gains the editing chrome

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { EditableText } from './EditableText';
import { useEditor, type Editor } from './editor';
import { GripIcon, PlusIcon } from './icons';
import { MediaForm } from './MediaForm';
import { Menu, type MenuItem } from './Menu';
import { richTextToPlain, safeHref } from './richText';
import {
    isChapterBlock,
    isImageBlock,
    isParagraphBlock,
    isVideoBlock,
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [over, setOver] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const location: BlockLocation = { parentId, index };
    const form = editor.mediaForm;
    const formHere = form?.kind === 'insert' && sameLocation(form.location, location);
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
                aria-label="Insert block here"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
            >
                <PlusIcon />
            </button>
            {menuOpen && (
                <Menu
                    label="Insert block"
                    onClose={closeMenu}
                    items={insertItems(editor, location)}
                />
            )}
            {formHere && (
                <MediaForm
                    type={form.type}
                    mode="insert"
                    onCancel={() => editor.setMediaForm(null)}
                    onSubmit={(fields) => {
                        editor.setMediaForm(null);
                        editor.insertMedia(form.type, location, fields);
                    }}
                />
            )}
        </div>
    );
}

function insertItems(editor: Editor, location: BlockLocation, suffix = ''): MenuItem[] {
    return [
        { label: `Insert paragraph${suffix}`, onSelect: () => editor.insertText('paragraph', location) },
        { label: `Insert chapter${suffix}`, onSelect: () => editor.insertText('chapter', location) },
        {
            label: `Insert image${suffix}`,
            onSelect: () => editor.setMediaForm({ kind: 'insert', type: 'image', location }),
        },
        {
            label: `Insert video${suffix}`,
            onSelect: () => editor.setMediaForm({ kind: 'insert', type: 'video', location }),
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
    const ref = useRef<HTMLDivElement>(null);
    const headingId = useId();
    const [menuOpen, setMenuOpen] = useState(false);
    const handleRef = useRef<HTMLButtonElement>(null);
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

    const content = renderContent(block, depth, headingId, editor);
    if (!editor) {
        return <div className={`bd-block bd-block--${blockClass(block)}`}>{content}</div>;
    }

    const below: BlockLocation = { parentId, index: index + 1 };
    const menuItems: MenuItem[] = [
        ...insertItems(editor, below, ' below'),
        ...(index > 0 ? [{ label: 'Move up', onSelect: () => editor.moveBy(block.id, -1) }] : []),
        ...(index < count - 1 ? [{ label: 'Move down', onSelect: () => editor.moveBy(block.id, 1) }] : []),
        ...(editor.canIndent(block.id)
            ? [{ label: 'Move into chapter above', onSelect: () => editor.indent(block.id) }]
            : []),
        ...(parentId ? [{ label: 'Move out of chapter', onSelect: () => editor.outdent(block.id) }] : []),
        ...(isImageBlock(block) || isVideoBlock(block)
            ? [
                  {
                      label: `Edit ${block.type}…`,
                      onSelect: () => editor.setMediaForm({ kind: 'edit', blockId: block.id }),
                  },
              ]
            : []),
        { label: 'Delete', danger: true, onSelect: () => editor.remove(block.id) },
    ];
    const editingMedia = editor.mediaForm?.kind === 'edit' && editor.mediaForm.blockId === block.id;
    const blockName = describeBlock(block);

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
                    aria-label={`Actions for ${blockName}`}
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
                {menuOpen && <Menu label={`Actions for ${blockName}`} items={menuItems} onClose={closeMenu} />}
            </div>
            {content}
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
    return isChapterBlock(block) || isParagraphBlock(block) || isImageBlock(block) || isVideoBlock(block)
        ? block.type
        : 'unknown';
}

function describeBlock(block: DocumentBlock): string {
    if (isChapterBlock(block)) return `chapter ${richTextToPlain(block.title) || '(untitled)'}`;
    if (isParagraphBlock(block)) return 'paragraph';
    if (isImageBlock(block)) return `image ${block.alt}`;
    if (isVideoBlock(block)) return `video ${richTextToPlain(block.caption) || block.src}`;
    return `unsupported block ${block.type}`;
}

function Caption({ blockId, caption, editor }: { blockId: string; caption?: RichText; editor: Editor | null }) {
    if (editor) {
        return (
            <EditableText
                as="figcaption"
                className="bd-caption"
                value={caption ?? []}
                label="Caption"
                placeholder="Add a caption"
                onChange={(next) => editor.update(blockId, { caption: next.length ? next : undefined })}
            />
        );
    }
    if (!caption?.length) return null;
    return (
        <figcaption className="bd-caption">
            <RichTextView spans={caption} />
        </figcaption>
    );
}

function renderContent(
    block: DocumentBlock,
    depth: number,
    headingId: string,
    editor: Editor | null,
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
                        label="Chapter title"
                        placeholder="Chapter title"
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
                label="Paragraph"
                placeholder="Type something…"
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
                <Caption blockId={block.id} caption={block.caption} editor={editor} />
            </figure>
        );
    }
    if (isVideoBlock(block)) {
        return (
            <figure className="bd-figure">
                <MediaVideo
                    src={block.src}
                    poster={block.poster}
                    label={richTextToPlain(block.caption) || 'Video'}
                />
                <Caption blockId={block.id} caption={block.caption} editor={editor} />
            </figure>
        );
    }
    return (
        <div className="bd-unknown" role="note">
            Unsupported block: {block.type}
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
    label,
}: {
    src: string;
    poster?: string;
    label: string;
}): React.ReactElement {
    const resolve = React.useContext(MediaUrlContext);
    return (
        <video
            className="bd-video"
            src={resolve(src)}
            poster={poster ? resolve(poster) : undefined}
            controls
            preload="metadata"
            aria-label={label}
        />
    );
}
