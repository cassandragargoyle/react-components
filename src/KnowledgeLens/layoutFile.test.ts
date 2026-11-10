/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Tests for normalizeLayout: a saved layout keeps what is valid and drops the rest

import { describe, expect, it } from 'vitest';
import { normalizeLayout } from './layoutFile';

describe('normalizeLayout', () => {
    it('keeps a valid layout as it is', () => {
        const layout = {
            version: 1 as const,
            layout: 'cose' as const,
            edgeStyle: 'curved' as const,
            propertyPanelWidth: 320,
            aboutOpen: true,
            language: 'cs',
            hiddenClasses: ['a'],
            hiddenPredicates: ['p'],
            subtitleAttributes: ['q'],
            positions: { n: { x: 1, y: 2 } },
        };
        expect(normalizeLayout(layout)).toEqual(layout);
    });

    it('drops unknown names and values of the wrong type', () => {
        expect(normalizeLayout({
            version: 7,
            layout: 'unknown',
            edgeStyle: 'evil',
            propertyPanelWidth: 'wide',
            aboutOpen: 'yes',
            hiddenClasses: 'not-a-list',
            subtitleAttributes: [1, 'ok', null],
            positions: { a: { x: 'NaN', y: null }, b: { x: 3, y: 4 }, c: 5 },
        })).toEqual({ version: 1, subtitleAttributes: ['ok'], positions: { b: { x: 3, y: 4 } } });
        expect(normalizeLayout({ propertyPanelWidth: Infinity })).toEqual({ version: 1 });
    });

    it('gives null for something that is not an object', () => {
        expect(normalizeLayout(null)).toBeNull();
        expect(normalizeLayout([1, 2])).toBeNull();
        expect(normalizeLayout('x')).toBeNull();
        expect(normalizeLayout(undefined)).toBeNull();
    });
});
