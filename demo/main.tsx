/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The demo page: the family house in BlockDocument, editable, in a light or a dark theme
// It imports the public entry point, so it shows the library as a consumer sees it

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { BlockDocument, validateBlockDocument, type BlockDocumentData } from '../src';
import sample from '../src/BlockDocument/samples/family-house.blockdocument.json';

type Theme = 'dark' | 'light';

// The VS Code theme variables the components read, as a webview would receive them
const THEMES: Record<Theme, Record<string, string>> = {
    dark: {
        '--vscode-editor-background': '#1e1e1e',
        '--vscode-foreground': '#cccccc',
        '--vscode-editor-foreground': '#e0e0e0',
        '--vscode-descriptionForeground': '#858585',
        '--vscode-editorWidget-background': '#252526',
        '--vscode-panel-border': '#3c3c3c',
        '--vscode-list-hoverBackground': '#2a2d2e',
        '--vscode-list-activeSelectionBackground': '#04395e',
        '--vscode-focusBorder': '#007fd4',
        '--vscode-textLink-foreground': '#3794ff',
        '--vscode-input-background': '#3c3c3c',
        '--vscode-input-foreground': '#cccccc',
    },
    light: {
        '--vscode-editor-background': '#ffffff',
        '--vscode-foreground': '#3b3b3b',
        '--vscode-editor-foreground': '#1f1f1f',
        '--vscode-descriptionForeground': '#717171',
        '--vscode-input-placeholderForeground': '#8b8b8b',
        '--vscode-editorWidget-background': '#f3f3f3',
        '--vscode-panel-border': '#d4d4d4',
        '--vscode-menu-border': '#cecece',
        '--vscode-list-hoverBackground': '#e8e8e8',
        '--vscode-list-activeSelectionBackground': '#0060c0',
        '--vscode-focusBorder': '#0090f1',
        '--vscode-textLink-foreground': '#006ab1',
        '--vscode-textPreformat-foreground': '#a31515',
        '--vscode-errorForeground': '#e51400',
        '--vscode-input-background': '#ffffff',
        '--vscode-input-foreground': '#3b3b3b',
    },
};

const initial = sample as BlockDocumentData;

function Demo(): React.ReactElement {
    const [doc, setDoc] = useState<BlockDocumentData>(initial);
    const [editing, setEditing] = useState(true);
    const [theme, setTheme] = useState<Theme>('dark');
    const [changes, setChanges] = useState(0);
    const validation = useMemo(() => validateBlockDocument(doc), [doc]);
    const colours = THEMES[theme];

    return (
        <div
            style={{
                ...(colours as React.CSSProperties),
                minHeight: '100vh',
                background: colours['--vscode-editor-background'],
                color: colours['--vscode-foreground'],
                fontFamily: 'system-ui, sans-serif',
                fontSize: 13,
            }}
        >
            <header
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${colours['--vscode-panel-border']}`,
                }}
            >
                <strong>BlockDocument demo</strong>
                <label>
                    <input type="checkbox" checked={editing} onChange={(e) => setEditing(e.target.checked)} /> Editable
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={theme === 'light'}
                        onChange={(e) => setTheme(e.target.checked ? 'light' : 'dark')}
                    />{' '}
                    Light theme
                </label>
                <button
                    type="button"
                    onClick={() => {
                        setDoc(initial);
                        setChanges(0);
                    }}
                >
                    Reset the sample
                </button>
                <span style={{ color: colours['--vscode-descriptionForeground'] }}>
                    {changes} change{changes === 1 ? '' : 's'} proposed ·{' '}
                    {validation.ok ? 'valid' : `invalid: ${validation.error}`}
                </span>
            </header>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, alignItems: 'flex-start' }}>
                <BlockDocument
                    document={doc}
                    readOnly={!editing}
                    onChange={(next) => {
                        setDoc(next);
                        setChanges((n) => n + 1);
                    }}
                    resolveMediaUrl={(src) => `/${src}`}
                    style={{ flex: '1 1 32rem' }}
                />
                <details style={{ flex: '1 1 20rem', minWidth: 0 }}>
                    <summary>Document JSON</summary>
                    <pre style={{ fontSize: 11, overflow: 'auto', maxHeight: '80vh' }}>{JSON.stringify(doc, null, 2)}</pre>
                </details>
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Demo />
    </React.StrictMode>,
);
