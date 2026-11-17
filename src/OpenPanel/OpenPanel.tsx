/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Open panel: a launcher card with Open File / Open Folder buttons and a filterable
// list of recently opened items. Host-neutral — data comes in and actions go out through props.
// Optional and off by default (INT-009): a project button, the order of the buttons, a
// description, a "…" menu and recent items of type project

import React, { useCallback, useEffect, useRef, useState } from 'react';
import openPanelStyles from './OpenPanel.css';

// Inject styles once when bundled with the 'text' loader (single-file bundle).
// Under the 'css' loader the import resolves to a non-string and a sibling
// stylesheet is emitted instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof openPanelStyles === 'string' &&
    openPanelStyles &&
    !document.getElementById('open-panel-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'open-panel-styles';
    styleEl.textContent = openPanelStyles;
    document.head.appendChild(styleEl);
}

/** What a recent entry points at — drives the row icon */
export type OpenPanelItemType = 'file' | 'folder' | 'project';

/** A button of the card */
export type OpenPanelAction = 'file' | 'folder' | 'project';

/** An item of the "…" menu: an action of the host, or a separator */
export type OpenPanelMenuItem =
    | { id: string; label: string; onSelect: () => void; disabled?: boolean; separator?: false }
    | { separator: true };

/** One row of the recent list */
export interface OpenPanelRecentItem {
    type: OpenPanelItemType;
    /** Full path; the row key, the tooltip and the filter haystack */
    path: string;
    /** Display name shown in bold */
    name: string;
    /** When the item was last opened; carried for the host, not rendered */
    lastOpened?: string;
    /** false → dimmed, disabled row with a "Not found" badge */
    exists?: boolean;
}

/** Every user-visible string, overridable for other products or languages */
export interface OpenPanelLabels {
    title: string;
    /** Text under the title; not rendered when empty */
    description: string;
    openFile: string;
    openFolder: string;
    openProject: string;
    /** Accessible name and tooltip of the "…" menu button */
    more: string;
    recent: string;
    filterPlaceholder: string;
    noMatches: string;
    clearRecent: string;
    notFound: string;
    loading: string;
    empty: string;
    emptyHint: string;
}

export const DEFAULT_OPEN_PANEL_LABELS: OpenPanelLabels = {
    title: 'Open a File or Project',
    description: '',
    openFile: 'Open File',
    openFolder: 'Open Folder',
    openProject: 'Open Project',
    more: 'More actions',
    recent: 'Recent',
    filterPlaceholder: 'Filter... (press /)',
    noMatches: 'No matching items',
    clearRecent: 'Clear Recent',
    notFound: 'Not found',
    loading: 'Loading recent items...',
    empty: 'No recently opened files or folders',
    emptyHint: 'Use the buttons above or File menu to get started',
};

export interface OpenPanelProps {
    /** The recent list, most recent first; the panel only filters it */
    recentItems: readonly OpenPanelRecentItem[];
    /** Open File button; the button is hidden when omitted */
    onOpenFile?: () => void;
    /** Open Folder button; the button is hidden when omitted */
    onOpenFolder?: () => void;
    /** Open Project button; the button is hidden when omitted */
    onOpenProject?: () => void;
    /** Order of the buttons; an action without its callback is not rendered */
    actions?: readonly OpenPanelAction[];
    /** Items of the "…" menu at the top right of the card; the button is hidden without items */
    menuItems?: readonly OpenPanelMenuItem[];
    /** A click on an existing recent row */
    onOpenRecent?: (item: OpenPanelRecentItem) => void;
    /** Clear Recent button; the button is hidden when omitted */
    onClearRecent?: () => void;
    /** true while the host has not delivered the list yet — replaces the empty state */
    loading?: boolean;
    /** Shows the filter input above this many items */
    filterThreshold?: number;
    /** Display form of a path; the full path stays in the tooltip */
    formatPath?: (path: string) => string;
    /** Partial override of the built-in strings */
    labels?: Partial<OpenPanelLabels>;
    /** Replaces the default folder-plus icon above the title; null hides it */
    icon?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

// Row height and cap used to reserve the list height (see reservedListHeight)
const RECENT_ROW_HEIGHT = 34; // row padding + line height + gap
const RECENT_VISIBLE_CAP = 9; // rows shown before the list scrolls (~max-height)

/** Replaces a leading home directory (Linux, macOS, Windows) with `~` */
export function shortenHomePath(fullPath: string): string {
    return fullPath
        .replace(/^\/home\/[^/]+/, '~')
        .replace(/^\/Users\/[^/]+/, '~')
        .replace(/^[A-Z]:\\Users\\[^\\]+/i, '~');
}

const DefaultIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 16 L8 6 L20 6 L26 12 L44 12 L44 40 L8 40 L2 16 Z"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 24 L14 16 L48 16 L44 40"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="26" y1="22" x2="26" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="19" y1="29" x2="33" y2="29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
);

const FolderIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M0 4L2 0H7L9 3H16V14H0V4Z"
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const FileIcon = (
    <svg width="16" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
        <path d="M0 2V14H12V5L8 0H0Z"
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 0V5H12"
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const ProjectIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M0 4L2 0H7L9 3H16V14H0V4Z"
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 6L11 9L8 12L5 9Z" fill="currentColor"/>
    </svg>
);

const RECENT_ICONS: Record<OpenPanelItemType, React.ReactNode> = {
    file: FileIcon,
    folder: FolderIcon,
    project: ProjectIcon,
};

/** The default order of the buttons: the order of the panel before INT-009 */
export const DEFAULT_OPEN_PANEL_ACTIONS: readonly OpenPanelAction[] = ['file', 'folder', 'project'];

/** The "…" button and its menu; keyboard as a WAI-ARIA menu button */
function OpenPanelMenu({ items, label }: { items: readonly OpenPanelMenuItem[]; label: string }): React.ReactElement {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const enabled = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.separator && !item.disabled)
        .map(({ index }) => index);

    const close = useCallback((focusButton: boolean) => {
        setOpen(false);
        setActive(-1);
        if (focusButton) buttonRef.current?.focus();
    }, []);
    const openAt = (index: number) => {
        setOpen(true);
        setActive(index);
    };

    useEffect(() => {
        if (open && active >= 0) itemRefs.current[active]?.focus();
    }, [open, active]);

    // A click outside closes the menu
    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
        };
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [open, close]);

    const move = (step: 1 | -1) => {
        if (enabled.length === 0) return;
        const at = enabled.indexOf(active);
        setActive(enabled[(at + step + enabled.length) % enabled.length]);
    };
    const select = (item: OpenPanelMenuItem) => {
        if (item.separator || item.disabled) return;
        close(true);
        item.onSelect();
    };

    return (
        <div className="open-panel-menu">
            <button
                ref={buttonRef}
                type="button"
                className="open-panel-menu-button"
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => (open ? close(false) : openAt(enabled[0] ?? -1))}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAt(enabled[0] ?? -1);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        openAt(enabled[enabled.length - 1] ?? -1);
                    }
                }}
            >
                …
            </button>
            {open && (
                <div
                    ref={menuRef}
                    className="open-panel-menu-list"
                    role="menu"
                    aria-label={label}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
                        else if (e.key === 'Home') { e.preventDefault(); setActive(enabled[0] ?? -1); }
                        else if (e.key === 'End') { e.preventDefault(); setActive(enabled[enabled.length - 1] ?? -1); }
                        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true); }
                    }}
                >
                    {items.map((item, index) => (item.separator ? (
                        <div key={`separator-${index}`} className="open-panel-menu-separator" role="separator" />
                    ) : (
                        <button
                            key={item.id}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            type="button"
                            role="menuitem"
                            className="open-panel-menu-item"
                            disabled={item.disabled}
                            aria-disabled={item.disabled || undefined}
                            tabIndex={index === active ? 0 : -1}
                            onClick={() => select(item)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(item); }
                            }}
                        >
                            {item.label}
                        </button>
                    )))}
                </div>
            )}
        </div>
    );
}

export function OpenPanel({
    recentItems,
    onOpenFile,
    onOpenFolder,
    onOpenProject,
    actions = DEFAULT_OPEN_PANEL_ACTIONS,
    menuItems,
    onOpenRecent,
    onClearRecent,
    loading = false,
    filterThreshold = 3,
    formatPath = shortenHomePath,
    labels,
    icon = DefaultIcon,
    className,
    style,
}: OpenPanelProps): React.ReactElement {
    const [filter, setFilter] = useState('');
    const filterRef = useRef<HTMLInputElement>(null);
    const text = { ...DEFAULT_OPEN_PANEL_LABELS, ...labels };
    const callbacks: Record<OpenPanelAction, { onClick?: () => void; label: string }> = {
        file: { onClick: onOpenFile, label: text.openFile },
        folder: { onClick: onOpenFolder, label: text.openFolder },
        project: { onClick: onOpenProject, label: text.openProject },
    };
    // Each listed action once, and only when the host passes its callback
    const buttons = [...new Set(actions)].filter((action) => callbacks[action].onClick);
    const hasMenu = !!menuItems && menuItems.some((item) => !item.separator);
    const showFilter = recentItems.length > filterThreshold;

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === '/' && !(e.target instanceof HTMLInputElement) && filterRef.current) {
            e.preventDefault();
            filterRef.current.focus();
        }
    }, []);

    const needle = showFilter ? filter.toLowerCase() : '';
    const filteredItems = needle
        ? recentItems.filter(item =>
              item.name.toLowerCase().includes(needle) ||
              item.path.toLowerCase().includes(needle))
        : recentItems;

    // Reserve the list height from the unfiltered count (capped) so filtering only
    // swaps the visible rows instead of resizing and re-centering the whole panel
    const reservedListHeight =
        Math.min(recentItems.length, RECENT_VISIBLE_CAP) * RECENT_ROW_HEIGHT;

    return (
        <div
            className={className ? `open-panel ${className}` : 'open-panel'}
            style={style}
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <div className="open-panel-card">
                {hasMenu && <OpenPanelMenu items={menuItems!} label={text.more} />}
                {icon !== null && <div className="open-panel-icon">{icon}</div>}
                <h1 className="open-panel-title">{text.title}</h1>
                {text.description && <p className="open-panel-description">{text.description}</p>}

                {buttons.length > 0 && (
                    <div className="open-panel-actions">
                        {buttons.map((action) => (
                            <button
                                key={action}
                                type="button"
                                className="open-panel-btn"
                                onClick={callbacks[action].onClick}
                            >
                                {callbacks[action].label}
                            </button>
                        ))}
                    </div>
                )}

                {recentItems.length > 0 && (
                    <div className="open-panel-recent">
                        <div className="open-panel-recent-header">
                            <span className="open-panel-recent-label">{text.recent}</span>
                            {showFilter && (
                                <input
                                    ref={filterRef}
                                    type="text"
                                    className="open-panel-filter"
                                    placeholder={text.filterPlaceholder}
                                    aria-label={text.filterPlaceholder}
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="open-panel-recent-list" style={{ minHeight: reservedListHeight }}>
                            {filteredItems.map(item => {
                                const missing = item.exists === false;
                                return (
                                    <button
                                        type="button"
                                        key={item.path}
                                        className={`open-panel-recent-item${missing ? ' open-panel-recent-item-missing' : ''}`}
                                        onClick={() => !missing && onOpenRecent?.(item)}
                                        disabled={missing}
                                        title={missing ? `${item.path} (${text.notFound.toLowerCase()})` : item.path}
                                    >
                                        <span className="open-panel-recent-icon">
                                            {RECENT_ICONS[item.type] ?? FileIcon}
                                        </span>
                                        <span className="open-panel-recent-name">{item.name}</span>
                                        <span className="open-panel-recent-path">{formatPath(item.path)}</span>
                                        {missing && (
                                            <span className="open-panel-recent-missing-label">{text.notFound}</span>
                                        )}
                                    </button>
                                );
                            })}
                            {filteredItems.length === 0 && needle && (
                                <div className="open-panel-empty">{text.noMatches}</div>
                            )}
                        </div>

                        {onClearRecent && (
                            <button type="button" className="open-panel-clear" onClick={onClearRecent}>
                                {text.clearRecent}
                            </button>
                        )}
                    </div>
                )}

                {recentItems.length === 0 && (
                    <div className="open-panel-empty" role="status">
                        {loading ? (
                            <p>{text.loading}</p>
                        ) : (
                            <>
                                <p>{text.empty}</p>
                                <p className="open-panel-empty-hint">{text.emptyHint}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
