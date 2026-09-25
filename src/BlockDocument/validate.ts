/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Runtime validation of a BlockDocument read from outside (INT-001)
// Hand-written on purpose: the library adds no schema dependency for it

import { BLOCK_DOCUMENT_SCHEMA_VERSION, type BlockDocumentData } from './types';

/** The outcome of `validateBlockDocument`: the document, or the first thing wrong with it */
export type BlockDocumentValidation =
    | { ok: true; document: BlockDocumentData }
    | { ok: false; error: string; path: string };

class ValidationError extends Error {
    constructor(
        readonly path: string,
        message: string,
    ) {
        super(message);
    }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(obj: Json, key: string, path: string, allowEmpty = true): void {
    const value = obj[key];
    if (typeof value !== 'string') {
        throw new ValidationError(`${path}.${key}`, `"${key}" must be a string`);
    }
    if (!allowEmpty && value.trim() === '') {
        throw new ValidationError(`${path}.${key}`, `"${key}" must not be empty`);
    }
}

function optionalString(obj: Json, key: string, path: string): void {
    if (obj[key] !== undefined) requireString(obj, key, path);
}

function checkRichText(value: unknown, path: string): void {
    if (!Array.isArray(value)) {
        throw new ValidationError(path, 'text must be an array of spans');
    }
    value.forEach((span, i) => {
        const spanPath = `${path}[${i}]`;
        if (!isObject(span)) throw new ValidationError(spanPath, 'a span must be an object');
        requireString(span, 'text', spanPath);
        for (const flag of ['bold', 'italic', 'code']) {
            if (span[flag] !== undefined && typeof span[flag] !== 'boolean') {
                throw new ValidationError(`${spanPath}.${flag}`, `"${flag}" must be a boolean`);
            }
        }
        optionalString(span, 'href', spanPath);
    });
}

function checkBlocks(value: unknown, path: string, seen: Set<string>): void {
    if (!Array.isArray(value)) {
        throw new ValidationError(path, 'blocks must be an array');
    }
    value.forEach((block, i) => {
        const blockPath = `${path}[${i}]`;
        if (!isObject(block)) throw new ValidationError(blockPath, 'a block must be an object');
        requireString(block, 'id', blockPath, false);
        requireString(block, 'type', blockPath, false);

        const id = block.id as string;
        if (seen.has(id)) {
            throw new ValidationError(`${blockPath}.id`, `block id "${id}" is used more than once`);
        }
        seen.add(id);

        switch (block.type) {
            case 'chapter':
                checkRichText(block.title, `${blockPath}.title`);
                checkBlocks(block.children, `${blockPath}.children`, seen);
                break;
            case 'paragraph':
                checkRichText(block.text, `${blockPath}.text`);
                break;
            case 'image':
                requireString(block, 'src', blockPath, false);
                requireString(block, 'alt', blockPath, false);
                if (block.caption !== undefined) checkRichText(block.caption, `${blockPath}.caption`);
                break;
            case 'video':
                requireString(block, 'src', blockPath, false);
                optionalString(block, 'poster', blockPath);
                if (block.caption !== undefined) checkRichText(block.caption, `${blockPath}.caption`);
                break;
            default:
                // Unknown types are kept as they are; only id and type are required
                break;
        }
    });
}

/**
 * Checks that `data` is a BlockDocument this version can show.
 * Returns the first problem with a JSON-like path to it, e.g. `blocks[2].alt`.
 */
export function validateBlockDocument(data: unknown): BlockDocumentValidation {
    try {
        if (!isObject(data)) throw new ValidationError('', 'a document must be an object');
        const version = data.schemaVersion;
        if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
            throw new ValidationError('schemaVersion', '"schemaVersion" must be a positive integer');
        }
        if (version > BLOCK_DOCUMENT_SCHEMA_VERSION) {
            throw new ValidationError(
                'schemaVersion',
                `schema version ${version} is newer than this component supports (${BLOCK_DOCUMENT_SCHEMA_VERSION})`,
            );
        }
        requireString(data, 'id', '');
        requireString(data, 'title', '');
        checkBlocks(data.blocks, 'blocks', new Set());
        return { ok: true, document: data as unknown as BlockDocumentData };
    } catch (err) {
        if (err instanceof ValidationError) {
            const path = err.path.replace(/^\./, '');
            return { ok: false, error: path ? `${path}: ${err.message}` : err.message, path };
        }
        throw err;
    }
}

/** Type guard over `validateBlockDocument` */
export function isBlockDocument(data: unknown): data is BlockDocumentData {
    return validateBlockDocument(data).ok;
}
