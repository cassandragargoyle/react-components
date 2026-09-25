/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The editing context of BlockDocument: the actions every block calls, and focus hand-over
// Actions read the latest document from a ref, so edits made in one event compose

import { createContext, useContext } from 'react';

import {
    findBlock,
    flattenBlocks,
    insertBlock,
    moveBlock,
    removeBlock,
    updateBlock,
    canMoveBlock,
} from './operations';
import { concatRichText, splitRichText } from './richText';
import {
    isChapterBlock,
    isParagraphBlock,
    type BlockDocumentData,
    type BlockLocation,
    type BlockPatch,
    type ChapterBlock,
    type DocumentBlock,
    type ImageBlock,
    type ParagraphBlock,
    type RichText,
    type VideoBlock,
} from './types';

/** Where the caret goes when a block takes focus */
export type Caret = number | 'start' | 'end';

/** What a block registers so that focus can be handed to it after an edit */
export interface FocusTarget {
    focus(caret: Caret): void;
    /** The caret offset while the block has focus */
    caret(): number | undefined;
}

/** The media form open in the document: inserting a new block, or editing one */
export type MediaFormState =
    | { kind: 'insert'; type: 'image' | 'video'; location: BlockLocation }
    | { kind: 'edit'; blockId: string };

/** Fields the media form collects */
export interface MediaFields {
    src: string;
    alt?: string;
    poster?: string;
}

export interface Editor {
    registerFocus(blockId: string, target: FocusTarget): () => void;
    /** Focus a block once it is rendered */
    requestFocus(blockId: string, caret: Caret): void;

    draggingId: string | null;
    setDraggingId(id: string | null): void;
    mediaForm: MediaFormState | null;
    setMediaForm(state: MediaFormState | null): void;

    insertText(type: 'paragraph' | 'chapter', location: BlockLocation): void;
    insertMedia(type: 'image' | 'video', location: BlockLocation, fields: MediaFields): void;
    editMedia(id: string, fields: MediaFields): void;
    update(id: string, patch: BlockPatch): void;
    remove(id: string): void;
    /** Moves a block among its siblings; -1 is up, 1 is down */
    moveBy(id: string, delta: -1 | 1): void;
    /** Moves a block to the end of the chapter just above it */
    indent(id: string): void;
    /** Moves a block out of its chapter, right after it */
    outdent(id: string): void;
    canIndent(id: string): boolean;
    /** Drops a block at a gap; `gap` counts positions before the block is taken out */
    dropAt(id: string, gap: BlockLocation): void;
    canDropAt(id: string, gap: BlockLocation): boolean;
    /** Enter in a paragraph: the text after the caret becomes a new paragraph */
    splitParagraph(id: string, offset: number): void;
    /** Enter in a chapter title: a new paragraph at the top of the chapter */
    openChapter(id: string): void;
    /** Backspace at the start of a paragraph: remove it when empty, else join the paragraph above */
    backspaceAtStart(id: string): void;
}

export const EditorContext = createContext<Editor | null>(null);

/** The editor, or null when the document is read-only */
export function useEditor(): Editor | null {
    return useContext(EditorContext);
}

interface EditorDeps {
    getDocument(): BlockDocumentData;
    commit(next: BlockDocumentData): void;
    createId(): string;
    focusTargets: Map<string, FocusTarget>;
    requestFocus(blockId: string, caret: Caret): void;
}

type EditorActions = Omit<
    Editor,
    'registerFocus' | 'requestFocus' | 'draggingId' | 'setDraggingId' | 'mediaForm' | 'setMediaForm'
>;

/** Builds the document-changing half of the editor over a document ref */
export function createEditorActions(deps: EditorDeps): EditorActions {
    const { getDocument, commit, requestFocus, focusTargets } = deps;

    const freshId = (): string => {
        const doc = getDocument();
        for (;;) {
            const id = deps.createId();
            if (!findBlock(doc, id)) return id;
        }
    };

    // Keeps the caret where it was when a block remounts in its new place
    const moveKeepingFocus = (id: string, location: BlockLocation): void => {
        const doc = getDocument();
        if (!canMoveBlock(doc, id, location)) return;
        const caret = focusTargets.get(id)?.caret();
        commit(moveBlock(doc, id, location));
        requestFocus(id, caret ?? 'start');
    };

    const previousInOrder = (id: string): DocumentBlock | undefined => {
        const order = flattenBlocks(getDocument().blocks);
        const at = order.findIndex((found) => found.block.id === id);
        return at > 0 ? order[at - 1].block : undefined;
    };

    const actions: EditorActions = {
        insertText(type, location) {
            const id = freshId();
            const block: ParagraphBlock | ChapterBlock =
                type === 'paragraph'
                    ? { id, type: 'paragraph', text: [] }
                    : { id, type: 'chapter', title: [], children: [] };
            commit(insertBlock(getDocument(), block, location));
            requestFocus(id, 'start');
        },

        insertMedia(type, location, fields) {
            const id = freshId();
            const block: ImageBlock | VideoBlock =
                type === 'image'
                    ? { id, type: 'image', src: fields.src, alt: fields.alt ?? '' }
                    : { id, type: 'video', src: fields.src, ...(fields.poster ? { poster: fields.poster } : {}) };
            commit(insertBlock(getDocument(), block, location));
            requestFocus(id, 'start');
        },

        editMedia(id, fields) {
            const found = findBlock(getDocument(), id);
            if (!found) return;
            const patch: BlockPatch =
                found.block.type === 'image'
                    ? { src: fields.src, alt: fields.alt ?? '' }
                    : { src: fields.src, poster: fields.poster || undefined };
            commit(updateBlock(getDocument(), id, patch));
            requestFocus(id, 'start');
        },

        update(id, patch) {
            if (!findBlock(getDocument(), id)) return;
            commit(updateBlock(getDocument(), id, patch));
        },

        remove(id) {
            const doc = getDocument();
            const found = findBlock(doc, id);
            if (!found) return;
            const order = flattenBlocks(doc.blocks);
            const at = order.findIndex((entry) => entry.block.id === id);
            // Focus goes to the block that takes this one's place, or the one above it
            const inside = new Set<string>();
            for (let i = at + 1; i < order.length && order[i].depth > found.depth; i++) {
                inside.add(order[i].block.id);
            }
            const next = order.slice(at + 1).find((entry) => !inside.has(entry.block.id));
            const previous = at > 0 ? order[at - 1] : undefined;
            commit(removeBlock(doc, id));
            if (next) requestFocus(next.block.id, 'start');
            else if (previous) requestFocus(previous.block.id, 'end');
        },

        moveBy(id, delta) {
            const found = findBlock(getDocument(), id);
            if (!found) return;
            const index = found.index + delta;
            if (index < 0) return;
            const siblings = found.parentId
                ? (findBlock(getDocument(), found.parentId)!.block as ChapterBlock).children
                : getDocument().blocks;
            if (index >= siblings.length) return;
            moveKeepingFocus(id, { parentId: found.parentId, index });
        },

        canIndent(id) {
            const found = findBlock(getDocument(), id);
            if (!found || found.index === 0) return false;
            const siblings = found.parentId
                ? (findBlock(getDocument(), found.parentId)!.block as ChapterBlock).children
                : getDocument().blocks;
            return isChapterBlock(siblings[found.index - 1]);
        },

        indent(id) {
            if (!actions.canIndent(id)) return;
            const found = findBlock(getDocument(), id)!;
            const siblings = found.parentId
                ? (findBlock(getDocument(), found.parentId)!.block as ChapterBlock).children
                : getDocument().blocks;
            const chapter = siblings[found.index - 1] as ChapterBlock;
            moveKeepingFocus(id, { parentId: chapter.id, index: chapter.children.length });
        },

        outdent(id) {
            const found = findBlock(getDocument(), id);
            if (!found?.parentId) return;
            const parent = findBlock(getDocument(), found.parentId)!;
            moveKeepingFocus(id, { parentId: parent.parentId, index: parent.index + 1 });
        },

        canDropAt(id, gap) {
            const doc = getDocument();
            const found = findBlock(doc, id);
            if (!found) return false;
            return canMoveBlock(doc, id, gap);
        },

        dropAt(id, gap) {
            const doc = getDocument();
            const found = findBlock(doc, id);
            if (!found || !canMoveBlock(doc, id, gap)) return;
            const sameList = found.parentId === gap.parentId;
            const index = sameList && found.index < gap.index ? gap.index - 1 : gap.index;
            if (sameList && index === found.index) return;
            commit(moveBlock(doc, id, { parentId: gap.parentId, index }));
            requestFocus(id, 'start');
        },

        splitParagraph(id, offset) {
            const doc = getDocument();
            const found = findBlock(doc, id);
            if (!found || !isParagraphBlock(found.block)) return;
            const [before, after] = splitRichText(found.block.text, offset);
            const newId = freshId();
            const next = insertBlock(
                updateBlock(doc, id, { text: before }),
                { id: newId, type: 'paragraph', text: after },
                { parentId: found.parentId, index: found.index + 1 },
            );
            commit(next);
            requestFocus(newId, 'start');
        },

        openChapter(id) {
            const found = findBlock(getDocument(), id);
            if (!found || !isChapterBlock(found.block)) return;
            actions.insertText('paragraph', { parentId: id, index: 0 });
        },

        backspaceAtStart(id) {
            const doc = getDocument();
            const found = findBlock(doc, id);
            if (!found || !isParagraphBlock(found.block)) return;
            const previous = previousInOrder(id);
            if (found.block.text.length === 0) {
                if (!previous) return;
                commit(removeBlock(doc, id));
                requestFocus(previous.id, 'end');
                return;
            }
            if (previous && isParagraphBlock(previous)) {
                const joinAt = previous.text.reduce((sum, span) => sum + span.text.length, 0);
                const text: RichText = concatRichText(previous.text, found.block.text);
                commit(removeBlock(updateBlock(doc, previous.id, { text }), id));
                requestFocus(previous.id, joinAt);
            }
        },
    };
    return actions;
}
