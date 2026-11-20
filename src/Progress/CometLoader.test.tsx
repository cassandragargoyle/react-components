/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for CometLoader: the status role and label, the tail and the size

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CometLoader } from './CometLoader';

describe('CometLoader', () => {
    it('is a status with the label as its text', () => {
        render(<CometLoader label="Rendering README.md…" />);
        expect(screen.getByRole('status')).toHaveTextContent('Rendering README.md…');
    });

    it('is a status named Loading when there is no label', () => {
        render(<CometLoader />);
        expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    });

    it('draws a head and a fading tail that run the same path later', () => {
        const { container } = render(<CometLoader />);
        const dots = Array.from(container.querySelectorAll<HTMLElement>('.comet-loader-dot'));
        expect(dots.length).toBeGreaterThan(1);
        expect(dots[0].style.animationDelay).toBe('0s');
        const opacities = dots.map((dot) => Number(dot.style.opacity));
        expect(opacities[0]).toBe(1);
        expect(opacities).toEqual([...opacities].sort((a, b) => b - a));
        expect(new Set(dots.map((dot) => dot.style.animationDelay)).size).toBe(dots.length);
    });

    it('scales the path to the given size and adds the host class', () => {
        const { container } = render(<CometLoader size={60} className="host" />);
        expect(container.firstElementChild).toHaveClass('comet-loader', 'host');
        const stage = container.querySelector<HTMLElement>('.comet-loader-stage');
        expect(stage?.style.width).toBe('60px');
        expect(container.querySelector<HTMLElement>('.comet-loader-scale')?.style.transform).toBe('scale(0.5)');
    });
});
