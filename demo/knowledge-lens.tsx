/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The KnowledgeLens demo at /demo/knowledge-lens.html: the sz-4.ttl sample over a shimmed port
// ?light starts in the light theme; Save keeps the layout in this browser's localStorage

/// <reference types="vite/client" />

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { KnowledgeLens, type KnowledgeLensLayout, type KnowledgeLensPort } from '../src';
import sample from '../src/KnowledgeLens/samples/sz-4.ttl?raw';

type Theme = 'dark' | 'light';

// The VS Code theme variables the component reads, as a webview would receive them
const THEMES: Record<Theme, Record<string, string>> = {
    dark: {
        '--vscode-editor-background': '#1e1e1e',
        '--vscode-foreground': '#cccccc',
        '--vscode-editor-foreground': '#e0e0e0',
        '--vscode-descriptionForeground': '#9d9d9d',
        '--vscode-sideBar-background': '#252526',
        '--vscode-sideBar-border': '#3c3c3c',
        '--vscode-focusBorder': '#007fd4',
        '--vscode-textLink-foreground': '#3794ff',
    },
    light: {
        '--vscode-editor-background': '#ffffff',
        '--vscode-foreground': '#3b3b3b',
        '--vscode-editor-foreground': '#222222',
        '--vscode-descriptionForeground': '#616161',
        '--vscode-sideBar-background': '#f3f3f3',
        '--vscode-sideBar-border': '#d4d4d4',
        '--vscode-editorGroupHeader-tabsBackground': '#f3f3f3',
        '--vscode-dropdown-background': '#ffffff',
        '--vscode-dropdown-foreground': '#3b3b3b',
        '--vscode-dropdown-border': '#cecece',
        '--vscode-input-background': '#ffffff',
        '--vscode-input-foreground': '#3b3b3b',
        '--vscode-input-border': '#cecece',
        '--vscode-focusBorder': '#0090f1',
        '--vscode-textLink-foreground': '#006ab1',
    },
};

const STORAGE_KEY = 'knowledge-lens-demo-layout';

function readLayout(): KnowledgeLensLayout | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as KnowledgeLensLayout) : null;
    } catch {
        return null;
    }
}

/** Apply the theme variables on <body>, where the component reads them */
function applyTheme(theme: Theme): void {
    for (const [name, value] of Object.entries(THEMES[theme])) document.body.style.setProperty(name, value);
    document.body.className = theme === 'light' ? 'vscode-light' : 'vscode-dark';
}

function Demo(): React.ReactElement {
    const [theme, setTheme] = useState<Theme>(() => {
        const initial: Theme = new URLSearchParams(window.location.search).has('light') ? 'light' : 'dark';
        applyTheme(initial);
        return initial;
    });

    // The host side of the port: answers ready with the sample, keeps a saved layout
    const port = useMemo<KnowledgeLensPort>(() => ({
        postMessage(message: unknown) {
            const msg = message as { type: string; layout?: KnowledgeLensLayout; iri?: string };
            switch (msg.type) {
                case 'ready':
                    window.postMessage({
                        type: 'setTurtleData',
                        text: sample,
                        fileName: 'sz-4.ttl',
                        options: { language: navigator.language },
                        layout: readLayout(),
                    }, '*');
                    break;
                case 'requestSave':
                    try {
                        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(msg.layout));
                    } catch {
                        // Storage blocked: the layout stays for this session only
                    }
                    window.postMessage({ type: 'layoutSaved' }, '*');
                    break;
                case 'openExternal':
                    if (msg.iri) window.open(msg.iri, '_blank', 'noopener');
                    break;
            }
        },
    }), []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 12px', fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
                <strong>KnowledgeLens demo</strong>
                <label>
                    <input
                        type="checkbox"
                        checked={theme === 'light'}
                        onChange={(e) => {
                            const next: Theme = e.target.checked ? 'light' : 'dark';
                            applyTheme(next);
                            setTheme(next);
                        }}
                    />{' '}
                    Light theme
                </label>
                <button
                    type="button"
                    onClick={() => {
                        try {
                            window.localStorage.removeItem(STORAGE_KEY);
                        } catch {
                            // Nothing stored
                        }
                        window.location.reload();
                    }}
                >
                    Forget saved layout
                </button>
            </header>
            <div style={{ flex: '1 1 0', minHeight: 0 }}>
                <KnowledgeLens api={port} canSave />
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<Demo />);
