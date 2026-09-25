/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Every edit of a BlockDocument as a pure function from document to document (INT-001)
// The component calls these and hands the result to the host; they never mutate their input

import {
    isChapterBlock,
    type BlockDocumentData,
    type BlockLocation,
    type BlockPatch,
    type DocumentBlock,
} from './types';

/** Where a block sits in the tree */
export interface FoundBlock {
    block: DocumentBlock;
    /** The chapter holding the block; absent at the top level */
    parentId?: string;
    index: number;
    /** 0 at the top level, 1 inside a top-level chapter, … */
    depth: number;
}

/** Every block in document order — a chapter before its children */
export function flattenBlocks(blocks: DocumentBlock[]): FoundBlock[] {
    const out: FoundBlock[] = [];
    const walk = (list: DocumentBlock[], parentId: string | undefined, depth: number): void => {
        list.forEach((block, index) => {
            out.push({ block, parentId, index, depth });
            if (isChapterBlock(block)) walk(block.children, block.id, depth + 1);
        });
    };
    walk(blocks, undefined, 0);
    return out;
}

/** Finds a block anywhere in the tree */
export function findBlock(doc: BlockDocumentData, id: string): FoundBlock | undefined {
    return flattenBlocks(doc.blocks).find((found) => found.block.id === id);
}

function collectIds(block: DocumentBlock, into: Set<string>): Set<string> {
    into.add(block.id);
    if (isChapterBlock(block)) block.children.forEach((child) => collectIds(child, into));
    return into;
}

// Rebuilds only the path down to the list that changes, so untouched subtrees keep their identity
function mapList(
    doc: BlockDocumentData,
    parentId: string | undefined,
    change: (list: DocumentBlock[]) => DocumentBlock[],
): BlockDocumentData {
    if (parentId === undefined) return { ...doc, blocks: change(doc.blocks) };
    let found = false;
    const walk = (list: DocumentBlock[]): DocumentBlock[] =>
        list.map((block) => {
            if (!isChapterBlock(block)) return block;
            if (block.id === parentId) {
                found = true;
                return { ...block, children: change(block.children) };
            }
            const children = walk(block.children);
            return children === block.children ? block : { ...block, children };
        });
    const blocks = walk(doc.blocks);
    if (!found) throw new Error(`No chapter "${parentId}" in the document`);
    return { ...doc, blocks };
}

function requireParent(doc: BlockDocumentData, parentId: string | undefined): void {
    if (parentId === undefined) return;
    const parent = findBlock(doc, parentId);
    if (!parent) throw new Error(`No block "${parentId}" in the document`);
    if (!isChapterBlock(parent.block)) {
        throw new Error(`Block "${parentId}" is a ${parent.block.type}, only a chapter holds blocks`);
    }
}

function clamp(index: number, length: number): number {
    return Math.max(0, Math.min(Math.trunc(index), length));
}

/**
 * Inserts `block` at `location`; the index is clamped to the list.
 * Throws when the parent is missing or not a chapter, or an id is already taken.
 */
export function insertBlock(
    doc: BlockDocumentData,
    block: DocumentBlock,
    location: BlockLocation,
): BlockDocumentData {
    requireParent(doc, location.parentId);
    const taken = new Set(flattenBlocks(doc.blocks).map((found) => found.block.id));
    for (const id of collectIds(block, new Set())) {
        if (taken.has(id)) throw new Error(`Block id "${id}" is already in the document`);
    }
    return mapList(doc, location.parentId, (list) => {
        const next = list.slice();
        next.splice(clamp(location.index, list.length), 0, block);
        return next;
    });
}

/** Removes a block with everything inside it. Throws when there is no such block */
export function removeBlock(doc: BlockDocumentData, id: string): BlockDocumentData {
    const found = findBlock(doc, id);
    if (!found) throw new Error(`No block "${id}" in the document`);
    return mapList(doc, found.parentId, (list) => list.filter((block) => block.id !== id));
}

/**
 * Whether `moveBlock(doc, id, location)` would succeed: the block exists, and the target
 * is the top level or a chapter that is neither the block nor inside it
 */
export function canMoveBlock(doc: BlockDocumentData, id: string, location: BlockLocation): boolean {
    const found = findBlock(doc, id);
    if (!found) return false;
    if (location.parentId === undefined) return true;
    const parent = findBlock(doc, location.parentId);
    if (!parent || !isChapterBlock(parent.block)) return false;
    return !collectIds(found.block, new Set()).has(location.parentId);
}

/**
 * Moves a block, with its children, to `location`. The index counts positions in the target
 * list **after** the block has been taken out of its old place.
 * Throws when `canMoveBlock` says no.
 */
export function moveBlock(
    doc: BlockDocumentData,
    id: string,
    location: BlockLocation,
): BlockDocumentData {
    if (!canMoveBlock(doc, id, location)) {
        throw new Error(`Block "${id}" cannot be moved there`);
    }
    const block = findBlock(doc, id)!.block;
    return insertBlock(removeBlock(doc, id), block, location);
}

/**
 * Changes fields of a block. A field set to `undefined` is removed.
 * Throws when there is no such block.
 */
export function updateBlock(doc: BlockDocumentData, id: string, patch: BlockPatch): BlockDocumentData {
    const found = findBlock(doc, id);
    if (!found) throw new Error(`No block "${id}" in the document`);
    const next: Record<string, unknown> = { ...found.block };
    for (const [key, value] of Object.entries(patch)) {
        // id, type and children are guarded here as well: BlockPatch is only a compile-time fence
        if (key === 'id' || key === 'type' || key === 'children') continue;
        if (value === undefined) delete next[key];
        else next[key] = value;
    }
    return mapList(doc, found.parentId, (list) =>
        list.map((block) => (block.id === id ? (next as DocumentBlock) : block)),
    );
}
