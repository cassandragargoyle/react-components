/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// A small popup menu for BlockDocument: arrow keys, Home/End, Escape and click-outside
// Focus moves into the menu when it opens and back to its button when it closes

import React, { useEffect, useRef } from 'react';

export interface MenuItem {
    label: string;
    onSelect(): void;
    danger?: boolean;
}

export interface MenuProps {
    label: string;
    items: MenuItem[];
    /** Closes the menu; `restoreFocus` is false when focus is already going elsewhere */
    onClose(restoreFocus: boolean): void;
}

export function Menu({ label, items, onClose }: MenuProps): React.ReactElement {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        const onPointerDown = (e: MouseEvent): void => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [onClose]);

    const onKeyDown = (e: React.KeyboardEvent): void => {
        const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (e.key === 'ArrowDown') next = (at + 1) % buttons.length;
        else if (e.key === 'ArrowUp') next = (at - 1 + buttons.length) % buttons.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = buttons.length - 1;
        else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose(true);
            return;
        } else if (e.key === 'Tab') {
            onClose(false);
            return;
        }
        if (next !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            buttons[next]?.focus();
        }
    };

    return (
        <div ref={ref} className="bd-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
            {items.map((item) => (
                <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className={item.danger ? 'bd-menu-item bd-menu-item--danger' : 'bd-menu-item'}
                    onClick={() => {
                        onClose(false);
                        item.onSelect();
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
