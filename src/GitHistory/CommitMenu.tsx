/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Popup menu of a commit row, opened by the ⋯ button, a right click or Shift+F10
// Focus moves into the menu; Up/Down move, Enter runs, Escape and an outside click close it

import React, { useEffect, useRef } from 'react';
import type { GitCommitAction } from './types';

export interface CommitMenuProps {
    actions: readonly GitCommitAction[];
    /** Position relative to the list's scroll container */
    x: number;
    y: number;
    label: string;
    onClose: () => void;
}

export function CommitMenu({ actions, x, y, label, onClose }: CommitMenuProps): React.ReactElement {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        const onDown = (e: MouseEvent): void => {
            if (!menuRef.current?.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [onClose]);

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(index + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(index - 1 + items.length) % items.length]?.focus();
        }
        e.stopPropagation();
    };

    return (
        <div
            ref={menuRef}
            className="git-history-menu"
            role="menu"
            aria-label={label}
            style={{ left: x, top: y }}
            onKeyDown={handleKeyDown}
        >
            {actions.map((action) => (
                <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className="git-history-menu-item"
                    tabIndex={-1}
                    onClick={() => {
                        onClose();
                        action.run();
                    }}
                >
                    {action.label}
                </button>
            ))}
        </div>
    );
}
