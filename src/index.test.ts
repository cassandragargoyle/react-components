/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Guards the package entry point while the library is still empty (ADR-012)
// Proves the barrel resolves and loads, so the first migrated component starts green

import { describe, expect, it } from 'vitest';

describe('package entry point', () => {
    it('loads', async () => {
        const entry = await import('./index');
        expect(entry).toBeTypeOf('object');
    });
});
