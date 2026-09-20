/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the standalone Avatar (#105): initials fallback, ring cue,
// image load-error fallback and the click-to-open action menu

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
    it('derives two initials from first + last name', () => {
        render(<Avatar id="u1" displayName="Jan Novák" kind="user" />);
        expect(screen.getByText('JN')).toBeInTheDocument();
    });

    it('derives up to two letters from a single-word name', () => {
        render(<Avatar id="u2" displayName="Ada" kind="ai_agent" />);
        expect(screen.getByText('AD')).toBeInTheDocument();
    });

    it('applies the kind-specific ring class', () => {
        render(<Avatar id="s1" displayName="Systém" kind="system" />);
        expect(screen.getByRole('button').className).toContain('avatar-system');
    });

    it('renders the image when avatarUrl is given, then falls back to initials on error', () => {
        render(<Avatar id="u3" displayName="Petr Malý" kind="user" avatarUrl="http://x/a.png" />);
        const img = screen.getByRole('img') as HTMLImageElement;
        expect(img).toBeInTheDocument();
        fireEvent.error(img);
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText('PM')).toBeInTheDocument();
    });

    it('opens the action menu on click and shows a Mail-to action only when email is set', () => {
        const { rerender } = render(<Avatar id="u4" displayName="Eva" kind="user" />);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByText(/Napsat e-mail/)).not.toBeInTheDocument();
        expect(screen.getByText(/Zkopírovat zmínku/)).toBeInTheDocument();

        rerender(<Avatar id="u4" displayName="Eva" kind="user" email="eva@x.io" />);
        const mail = screen.getByText(/Napsat e-mail/).closest('a');
        expect(mail).toHaveAttribute('href', 'mailto:eva@x.io');
    });
});
