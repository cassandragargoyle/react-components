/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the BlockDocument texts (INT-004): which dictionary a tag resolves to
// and how the host's messages are laid over it

import { describe, expect, it } from 'vitest';

import { blockDocumentMessages, resolveMessages, type BlockDocumentMessages } from './messages';

const { en, cs } = blockDocumentMessages;

// Every key path of a dictionary, functions and strings alike
function keyPaths(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, inner]) => keyPaths(inner, prefix ? `${prefix}.${key}` : key));
}

describe('resolveMessages', () => {
    it('prefers the locale, then the document language, then English', () => {
        expect(resolveMessages('en', 'cs')).toBe(en);
        expect(resolveMessages(undefined, 'cs')).toBe(cs);
        expect(resolveMessages(undefined, undefined)).toBe(en);
        expect(resolveMessages('', 'cs')).toBe(cs);
    });

    it('matches a region tag by its primary subtag, and ignores case', () => {
        expect(resolveMessages('cs-CZ', undefined)).toBe(cs);
        expect(resolveMessages(undefined, 'CS_cz')).toBe(cs);
    });

    it('falls back to English for a language it does not ship', () => {
        expect(resolveMessages('xx', undefined)).toBe(en);
        expect(resolveMessages(undefined, 'de-AT')).toBe(en);
    });

    it('rewords a single text, at any depth, and leaves the rest', () => {
        const text = resolveMessages(undefined, 'cs', {
            delete: 'Odstranit',
            fields: { address: { city: 'Město' } },
            actionsFor: (block) => `Co s blokem ${block}`,
        });
        expect(text.delete).toBe('Odstranit');
        expect(text.fields.address.city).toBe('Město');
        expect(text.fields.address.street).toBe('Ulice');
        expect(text.actionsFor('odstavec')).toBe('Co s blokem odstavec');
        expect(text.moveUp).toBe(cs.moveUp);
        expect(cs.delete).toBe('Smazat');
    });

    it('adds a language passed whole with its locale', () => {
        const de: BlockDocumentMessages = { ...en, delete: 'Löschen' };
        expect(resolveMessages('de', 'cs', de).delete).toBe('Löschen');
    });
});

describe('the built-in dictionaries', () => {
    it('have the same keys in Czech as in English', () => {
        expect(keyPaths(cs).sort()).toEqual(keyPaths(en).sort());
    });

    it('keep the English texts the component rendered before', () => {
        expect(en.insertBelow.paragraph).toBe('Insert paragraph below');
        expect(en.actionsFor('paragraph')).toBe('Actions for paragraph');
        expect(en.fieldNotShown('Caption')).toBe('Caption: not shown in the document');
    });
});
