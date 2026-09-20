/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Imperative hook driving a single RadialMenu from any diagram surface
// Exposes open(options) / close() and a ready-to-render `menu` element

import React, { useCallback, useMemo, useState } from 'react';
import { RadialMenu } from './RadialMenu';
import type { RadialMenuOptions } from './types';

export interface UseRadialMenu {
    /** Open (or re-anchor) the menu with the given options */
    open: (options: RadialMenuOptions) => void;
    /** Close the menu without invoking any action */
    close: () => void;
    /** Whether the menu is currently open */
    isOpen: boolean;
    /** The menu element to place in the host tree; renders via a portal, so location is irrelevant */
    menu: React.ReactElement | null;
}

// Host usage:
//   const radial = useRadialMenu();
//   radial.open({ hub, actions, position });
//   return <>{diagram}{radial.menu}</>;
export function useRadialMenu(): UseRadialMenu {
    const [options, setOptions] = useState<RadialMenuOptions | null>(null);

    const open = useCallback((next: RadialMenuOptions) => setOptions(next), []);
    const close = useCallback(() => setOptions(null), []);

    const menu = useMemo(
        () => (options ? React.createElement(RadialMenu, { options, onClose: close }) : null),
        [options, close]
    );

    return { open, close, isOpen: options !== null, menu };
}
