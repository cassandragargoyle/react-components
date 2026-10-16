/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for GraphCanvas host binding: the canvas talks only to the port
// it is given, and announces itself on it when mounted

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';

describe('GraphCanvas', () => {
    it('posts ready on the port it is given', () => {
        const api = { postMessage: vi.fn() };
        render(<GraphCanvas api={api} />);
        expect(api.postMessage).toHaveBeenCalledWith({ type: 'ready' });
    });
});
