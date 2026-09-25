/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Open Panel component for launching files and folders
// Displays action buttons and a list of recently opened items

import React, { useState, useEffect, useCallback } from 'react';

declare global {
    interface Window {
        fileApi?: {
            openDialog(type: 'file' | 'folder'): void;
            getRecentItems(): void;
            openRecent(path: string): void;
            clearRecent(): void;
            closeProject(): void;
            onOpenItem(callback: (item: unknown) => void): void;
            onRecentItems(callback: (data: unknown) => void): void;
            removeAllListeners(): void;
        };
    }
}

interface RecentItem {
    type: 'file' | 'folder';
    path: string;
    name: string;
    lastOpened: string;
    // Whether the path still exists on disk; false → dimmed "Not found" (issue 102)
    exists?: boolean;
}

export function OpenPanel(): React.ReactElement {
    const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        window.fileApi?.onRecentItems((data: unknown) => {
            const payload = data as { items: RecentItem[] };
            setRecentItems(payload.items || []);
        });

        // Request recent items on mount
        window.fileApi?.getRecentItems();

        return () => {
            window.fileApi?.removeAllListeners();
        };
    }, []);

    const handleOpenFile = useCallback(() => {
        window.fileApi?.openDialog('file');
    }, []);

    const handleOpenFolder = useCallback(() => {
        window.fileApi?.openDialog('folder');
    }, []);

    const handleOpenRecent = useCallback((itemPath: string) => {
        window.fileApi?.openRecent(itemPath);
    }, []);

    const handleClearRecent = useCallback(() => {
        window.fileApi?.clearRecent();
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
            e.preventDefault();
            const input = document.querySelector('.open-panel-filter') as HTMLInputElement;
            input?.focus();
        }
    }, []);

    const filteredItems = filter
        ? recentItems.filter(item =>
              item.name.toLowerCase().includes(filter.toLowerCase()) ||
              item.path.toLowerCase().includes(filter.toLowerCase()))
        : recentItems;

    // Reserve the list height from the unfiltered count (capped) so filtering only
    // swaps the visible rows instead of resizing and re-centering the whole panel
    const RECENT_ROW_HEIGHT = 34; // row padding + line height + gap
    const RECENT_VISIBLE_CAP = 9; // rows shown before the list scrolls (~max-height)
    const reservedListHeight =
        Math.min(recentItems.length, RECENT_VISIBLE_CAP) * RECENT_ROW_HEIGHT;

    const shortenPath = (fullPath: string): string => {
        const home = fullPath.replace(/^\/home\/[^/]+/, '~')
            .replace(/^[A-Z]:\\Users\\[^\\]+/, '~');
        return home;
    };

    return (
        <div className="open-panel" onKeyDown={handleKeyDown} tabIndex={0}>
            <div className="open-panel-card">
                <div className="open-panel-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 16 L8 6 L20 6 L26 12 L44 12 L44 40 L8 40 L2 16 Z"
                              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 24 L14 16 L48 16 L44 40"
                              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="26" y1="22" x2="26" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        <line x1="19" y1="29" x2="33" y2="29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                </div>
                <h1 className="open-panel-title">Open a File or Project</h1>

                <div className="open-panel-actions">
                    <button className="open-panel-btn" onClick={handleOpenFile}>
                        Open File
                    </button>
                    <button className="open-panel-btn" onClick={handleOpenFolder}>
                        Open Folder
                    </button>
                </div>

                {recentItems.length > 0 && (
                    <div className="open-panel-recent">
                        <div className="open-panel-recent-header">
                            <span className="open-panel-recent-label">Recent</span>
                            {recentItems.length > 3 && (
                                <input
                                    type="text"
                                    className="open-panel-filter"
                                    placeholder="Filter... (press /)"
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
                                    key={item.path}
                                    className={`open-panel-recent-item${missing ? ' open-panel-recent-item-missing' : ''}`}
                                    onClick={() => !missing && handleOpenRecent(item.path)}
                                    disabled={missing}
                                    title={missing ? `${item.path} (not found)` : item.path}
                                >
                                    <span className="open-panel-recent-icon">
                                        {item.type === 'folder' ? (
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path d="M0 4L2 0H7L9 3H16V14H0V4Z"
                                                      stroke="currentColor" strokeWidth="1.3"
                                                      strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 14 16" fill="none">
                                                <path d="M0 2V14H12V5L8 0H0Z"
                                                      stroke="currentColor" strokeWidth="1.3"
                                                      strokeLinecap="round" strokeLinejoin="round"/>
                                                <path d="M8 0V5H12"
                                                      stroke="currentColor" strokeWidth="1.3"
                                                      strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </span>
                                    <span className="open-panel-recent-name">{item.name}</span>
                                    <span className="open-panel-recent-path">{shortenPath(item.path)}</span>
                                    {missing && (
                                        <span className="open-panel-recent-missing-label">Not found</span>
                                    )}
                                </button>
                                );
                            })}
                            {filteredItems.length === 0 && filter && (
                                <div className="open-panel-empty">No matching items</div>
                            )}
                        </div>

                        <button className="open-panel-clear" onClick={handleClearRecent}>
                            Clear Recent
                        </button>
                    </div>
                )}

                {recentItems.length === 0 && (
                    <div className="open-panel-empty">
                        <p>No recently opened files or folders</p>
                        <p className="open-panel-empty-hint">
                            Use the buttons above or File menu to get started
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
