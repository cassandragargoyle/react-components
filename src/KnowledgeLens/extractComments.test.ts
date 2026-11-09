/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for extractComments: the document and section comments of sz-4.ttl, frame lines,
// and the places where a `#` is not a comment

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanComment, extractComments } from './extractComments';

const SAMPLE = readFileSync(resolve(__dirname, 'samples/sz-4.ttl'), 'utf8');
const SZ = 'https://example.org/stavebni-zakon/par-4#';
const BASE = 'https://e-sbirka.gov.cz/eli/cz/sb/2021/283/2026-06-11/dokument/norma/';

describe('extractComments on sz-4.ttl', () => {
    const comments = extractComments(SAMPLE);

    it('reads the head comment without the frame lines and keeps the indentation', () => {
        const doc = comments.document!;
        const lines = doc.split('\n');
        expect(lines[0]).toBe('Znalostní model § 4 – Záměr');
        expect(doc).not.toMatch(/====/);
        expect(lines).toContain('  Objekt           -> rdf:type');
        expect(lines[lines.length - 1]).toBe('Ustanovení § 4 neukládá povinnost, proto nemá lk:imposesRequirement.');
    });

    it('finds the sections and the subjects that follow them', () => {
        const titles = comments.sections.map((s) => s.text.split('\n')[0]);
        expect(titles).toEqual([
            'Slovník (typy a vazby z definition.md)',
            'Ustanovení (IRI = ELI, relativně k @base)',
            'Definované pojmy',
            'Druhy záměru (výčet z § 4 odst. 1)',
            'Podmínka (kritérium z definice záměru EIA)',
            'Odkazy (z pole odkazyZFragmentu v e-Sbírce)',
            'Ověření a důkazy (odvozené)',
        ]);
        const concepts = comments.sections[2];
        expect(concepts.subjects).toEqual([`${SZ}zamer`, `${SZ}zamerEIA`]);
        const provisions = comments.sections[1];
        expect(provisions.subjects).toContain(`${BASE}cast_1/hlava_2/par_4/odst_1`);
        expect(provisions.subjects).toContain('https://e-sbirka.gov.cz/eli/cz/sb/2021/283/2026-06-11');
    });

    it('does not take the dataset statement before the first section into any section', () => {
        const all = comments.sections.flatMap((s) => s.subjects);
        expect(all).not.toContain(`${SZ}graf`);
    });
});

describe('extractComments edge cases', () => {
    it('ignores a # inside an IRI, a string, a long string and after an escaped quote', () => {
        const text = [
            '@prefix ex: <http://ex.org/ns#> .',
            'ex:a ex:p <http://ex.org/x#frag> .',
            'ex:b ex:p "a # not a comment" .',
            'ex:c ex:p """long',
            '# still inside the long string',
            '""" .',
            'ex:d ex:p "escaped \\" # quote" .',
            "ex:e ex:p 'single # quote' .",
            '# Real section',
            'ex:f ex:p 1 .',
        ].join('\n');
        const comments = extractComments(text);
        expect(comments.document).toBeNull();
        expect(comments.sections).toEqual([{ line: 9, text: 'Real section', subjects: ['http://ex.org/ns#f'] }]);
    });

    it('ignores trailing comments and comments inside a statement', () => {
        const text = [
            '@prefix ex: <http://ex.org/> .',
            'ex:a ex:p 1 . # trailing',
            'ex:b ex:p 2 ;',
            '    # between predicates',
            '    ex:q 3 .',
        ].join('\n');
        expect(extractComments(text)).toEqual({ document: null, sections: [] });
    });

    it('keeps comments before and between the prefixes in the document comment', () => {
        const text = ['# Title', '@prefix ex: <http://ex.org/> .', '# More', '', 'ex:a ex:p 1 .'].join('\n');
        expect(extractComments(text).document).toBe('Title\n\nMore');
    });

    it('reads SPARQL-style directives and resolves relative subjects against the base', () => {
        const text = ['BASE <http://ex.org/doc/>', 'PREFIX ex: <http://ex.org/>', 'ex:a ex:p 1 .', '# Part', '<b> ex:p 2 .', '_:x ex:p 3 .', '[] ex:p 4 .'].join('\n');
        expect(extractComments(text).sections).toEqual([{ line: 4, text: 'Part', subjects: ['http://ex.org/doc/b'] }]);
    });

    it('drops a section made only of frame lines', () => {
        const text = ['@prefix ex: <http://ex.org/> .', 'ex:a ex:p 1 .', '# ======', 'ex:b ex:p 2 .'].join('\n');
        expect(extractComments(text).sections).toEqual([]);
    });

    it('cleans comment lines', () => {
        expect(cleanComment(['# ---', '#', '# Title', '#', '#   indented', '# ---'])).toBe('Title\n\n  indented');
    });
});
