/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Open panel: a launcher card with Open File / Open Folder buttons and a filterable
// list of recently opened items. Host-neutral — data comes in and actions go out through props

import React, { useCallback, useRef, useState } from 'react';
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
export type OpenPanelItemType = 'file' | 'folder';

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
    openFile: string;
    openFolder: string;
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
    openFile: 'Open File',
    openFolder: 'Open Folder',
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

export function OpenPanel({
    recentItems,
    onOpenFile,
    onOpenFolder,
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
                {icon !== null && <div className="open-panel-icon">{icon}</div>}
                <h1 className="open-panel-title">{text.title}</h1>

                {(onOpenFile || onOpenFolder) && (
                    <div className="open-panel-actions">
                        {onOpenFile && (
                            <button type="button" className="open-panel-btn" onClick={onOpenFile}>
                                {text.openFile}
                            </button>
                        )}
                        {onOpenFolder && (
                            <button type="button" className="open-panel-btn" onClick={onOpenFolder}>
                                {text.openFolder}
                            </button>
                        )}
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
                                            {item.type === 'folder' ? FolderIcon : FileIcon}
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
