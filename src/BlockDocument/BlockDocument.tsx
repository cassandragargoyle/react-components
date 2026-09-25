/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// BlockDocument (INT-001): a document of blocks shown as one page, edited in place
// The host owns the document; every edit is proposed to it whole through onChange

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import blockDocumentStyles from './BlockDocument.css';

import { BlockList, MediaUrlContext } from './BlockView';
import { EditableText } from './EditableText';
import { createEditorActions, EditorContext, type Caret, type Editor, type FocusTarget, type MediaFormState } from './editor';
import { richTextToPlain, plainToRichText } from './richText';
import type { BlockDocumentData } from './types';
import { validateBlockDocument } from './validate';

// Inject styles once when bundled as a string; under test the import is '' and this is skipped
if (
    typeof document !== 'undefined' &&
    typeof blockDocumentStyles === 'string' &&
    blockDocumentStyles &&
    !document.getElementById('block-document-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'block-document-styles';
    styleEl.textContent = blockDocumentStyles;
    document.head.appendChild(styleEl);
}

export interface BlockDocumentProps {
    /** The document to show */
    document: BlockDocumentData;
    /** Receives the whole new document after each edit; without it the document is read-only */
    onChange?: (next: BlockDocumentData) => void;
    /** Shows the document read-only even when onChange is given */
    readOnly?: boolean;
    /** Maps a stored `src` or `poster` to the URL to load; identity by default */
    resolveMediaUrl?: (src: string) => string;
    /** Makes ids for new blocks; a random id by default */
    createBlockId?: () => string;
    className?: string;
    style?: React.CSSProperties;
    ref?: React.Ref<HTMLElement>;
}

function defaultBlockId(): string {
    const random =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return `b-${random}`;
}

const identity = (src: string): string => src;

export function BlockDocument({
    document: doc,
    onChange,
    readOnly = false,
    resolveMediaUrl = identity,
    createBlockId = defaultBlockId,
    className,
    style,
    ref,
}: BlockDocumentProps): React.ReactElement {
    const editable = !!onChange && !readOnly;
    const validation = useMemo(() => validateBlockDocument(doc), [doc]);

    // The latest document, ahead of the host's next render, so edits in one event compose
    const docRef = useRef(doc);
    docRef.current = doc;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const createIdRef = useRef(createBlockId);
    createIdRef.current = createBlockId;

    const focusTargets = useRef(new Map<string, FocusTarget>()).current;
    const pendingFocus = useRef<{ blockId: string; caret: Caret } | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [mediaForm, setMediaForm] = useState<MediaFormState | null>(null);

    const flushFocus = useCallback((): void => {
        const pending = pendingFocus.current;
        const target = pending && focusTargets.get(pending.blockId);
        if (!pending || !target) return;
        pendingFocus.current = null;
        target.focus(pending.caret);
    }, [focusTargets]);

    const actions = useMemo(
        () =>
            createEditorActions({
                getDocument: () => docRef.current,
                commit: (next) => {
                    docRef.current = next;
                    onChangeRef.current?.(next);
                },
                createId: () => createIdRef.current(),
                focusTargets,
                requestFocus: (blockId, caret) => {
                    pendingFocus.current = { blockId, caret };
                },
            }),
        [focusTargets],
    );

    const editor = useMemo<Editor | null>(
        () =>
            editable
                ? {
                      ...actions,
                      registerFocus(blockId, target) {
                          focusTargets.set(blockId, target);
                          // A block that mounts after the edit asking for it takes the focus now
                          if (pendingFocus.current?.blockId === blockId) flushFocus();
                          return () => {
                              if (focusTargets.get(blockId) === target) focusTargets.delete(blockId);
                          };
                      },
                      requestFocus(blockId, caret) {
                          pendingFocus.current = { blockId, caret };
                      },
                      draggingId,
                      setDraggingId,
                      mediaForm,
                      setMediaForm,
                  }
                : null,
        [editable, actions, focusTargets, flushFocus, draggingId, mediaForm],
    );

    // After each render: a block that already existed (moved, joined) takes the focus it was promised
    useLayoutEffect(() => {
        flushFocus();
    });

    const classes = ['bd-document', editable && 'bd-document--editable', draggingId && 'bd-document--dragging', className]
        .filter(Boolean)
        .join(' ');

    if (!validation.ok) {
        return (
            <article ref={ref} className={classes} style={style}>
                <div className="bd-error" role="alert">
                    This document cannot be shown. {validation.error}
                </div>
            </article>
        );
    }

    return (
        <MediaUrlContext.Provider value={resolveMediaUrl}>
            <EditorContext.Provider value={editor}>
                <article ref={ref} className={classes} style={style} aria-label={doc.title || 'Document'}>
                    {editor ? (
                        <EditableText
                            as="h1"
                            className="bd-title"
                            plain
                            value={plainToRichText(doc.title)}
                            label="Document title"
                            placeholder="Untitled"
                            onChange={(title) => {
                                const next = { ...docRef.current, title: richTextToPlain(title) };
                                docRef.current = next;
                                onChangeRef.current?.(next);
                            }}
                            onEnter={() => {
                                actions.insertText('paragraph', { index: 0 });
                                return true;
                            }}
                        />
                    ) : (
                        doc.title && <h1 className="bd-title">{doc.title}</h1>
                    )}
                    <BlockList blocks={doc.blocks} depth={0} />
                    {editor && doc.blocks.length === 0 && (
                        <button
                            type="button"
                            className="bd-button bd-add-first"
                            onClick={() => actions.insertText('paragraph', { index: 0 })}
                        >
                            Add a paragraph
                        </button>
                    )}
                </article>
            </EditorContext.Provider>
        </MediaUrlContext.Provider>
    );
}
