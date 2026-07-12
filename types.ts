/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public type contracts for the reusable RadialMenu component
// Describes a single radial action and the options passed to open the menu

import type React from 'react';

/** A single action in the radial menu — a hub, a ring segment, or a nested child */
export interface RadialMenuAction {
    /** Stable identity, unique among its siblings */
    id: string;
    /** Monochrome icon per GUI Design Principles (SVG/glyph); optional for text-only segments */
    icon?: React.ReactNode;
    /** Short label shown on the segment and in the tooltip */
    label: string;
    /** Longer description shown in the tooltip; falls back to `label` when omitted */
    tooltip?: string;
    /** When true the segment is shown dimmed and cannot be committed */
    disabled?: boolean;
    /** Invoked when a leaf segment is committed; omit when `children` is set */
    onSelect?: () => void;
    /** Child actions that expand into an outer concentric ring on hover/activation */
    children?: RadialMenuAction[];
}

/** Options describing a single opening of the radial menu */
export interface RadialMenuOptions {
    /** Primary action rendered in the always-visible center hub */
    hub: RadialMenuAction;
    /** Ring-1 segments, rendered clockwise starting from the top */
    actions: RadialMenuAction[];
    /** Outer radius of ring 1 in pixels (default 96) */
    radius?: number;
    /** Width added per nested ring level in pixels (default 60) */
    ringGap?: number;
    /** Anchor point in viewport (client) coordinates the menu is centered on */
    position: { x: number; y: number };
}

/** Currently highlighted target: the hub, a ring segment, or nothing */
export type RadialMenuActive = 'hub' | { level: number; index: number } | null;
