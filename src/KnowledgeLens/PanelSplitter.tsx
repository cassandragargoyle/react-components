/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Vertical splitter that sets the width of the panel on its right: drag, arrow keys,
// and a double click back to the default; exposed as an ARIA separator

import React, { type JSX, useCallback } from 'react';

/** Smallest panel width in pixels */
export const MIN_PANEL_WIDTH = 200;
/** Panel width a double click restores */
export const DEFAULT_PANEL_WIDTH = 260;
/** Width change of one arrow key press */
export const PANEL_WIDTH_STEP = 16;

/** Largest panel width: half of the window, never below the minimum */
export function maxPanelWidth(): number {
    const viewport = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1600;
    return Math.max(MIN_PANEL_WIDTH, Math.floor(viewport / 2));
}

/** Keep a width within the limits */
export function clampPanelWidth(width: number): number {
    return Math.round(Math.min(maxPanelWidth(), Math.max(MIN_PANEL_WIDTH, width)));
}

interface PanelSplitterProps {
    /** Current width of the panel on the right */
    width: number;
    onWidthChange: (width: number) => void;
    /** Name of the panel, for the accessible label */
    label: string;
}

export function PanelSplitter({ width, onWidthChange, label }: PanelSplitterProps): JSX.Element {
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        // The panel is on the right: moving left makes it wider
        const move = (ev: MouseEvent) => onWidthChange(clampPanelWidth(startWidth + startX - ev.clientX));
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            document.body.style.removeProperty('cursor');
        };
        document.body.style.cursor = 'ew-resize';
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }, [width, onWidthChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onWidthChange(clampPanelWidth(width + PANEL_WIDTH_STEP));
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onWidthChange(clampPanelWidth(width - PANEL_WIDTH_STEP));
        } else if (e.key === 'Home') {
            e.preventDefault();
            onWidthChange(clampPanelWidth(MIN_PANEL_WIDTH));
        } else if (e.key === 'End') {
            e.preventDefault();
            onWidthChange(maxPanelWidth());
        }
    }, [width, onWidthChange]);

    return (
        <div
            className="knowledge-lens-splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${label}`}
            aria-valuenow={width}
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuemax={maxPanelWidth()}
            tabIndex={0}
            title="Drag to resize; double-click to restore"
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => onWidthChange(clampPanelWidth(DEFAULT_PANEL_WIDTH))}
        />
    );
}
