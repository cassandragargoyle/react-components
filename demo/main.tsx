/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The demo page: the family house in BlockDocument, in English or Czech, editable, light or dark
// It imports the public entry point, so it shows the library as a consumer sees it
//
// The query sets the starting state, for a debug target that opens straight on a block:
//   ?block=<id>      scroll to that block
//   ?readonly        start read-only
//   ?light           start in the light theme
//   ?gps             start with the host showing the address GPS and RÚIAN code
//   ?sample=cs       start with the Czech sample, whose document language is cs
//   ?language=<tag>  start with the document language set to that tag, e.g. cs
//   ?locale=<tag>    start with the host setting the language of the texts, e.g. en or cs

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { BlockDocument, validateBlockDocument, type BlockDocumentData } from '../src';
import familyHouse from '../src/BlockDocument/samples/family-house.blockdocument.json';
import rodinnyDum from '../src/BlockDocument/samples/rodinny-dum.blockdocument.json';

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

const query = new URLSearchParams(window.location.search);

// The same house written in English, without a document language, and in Czech, with `cs`
const SAMPLES: Record<'en' | 'cs', BlockDocumentData> = {
    en: familyHouse as BlockDocumentData,
    cs: rodinnyDum as BlockDocumentData,
};
type SampleName = keyof typeof SAMPLES;

function sampleFor(name: SampleName): BlockDocumentData {
    const language = query.get('language');
    return language ? { ...SAMPLES[name], language } : SAMPLES[name];
}

function Demo(): React.ReactElement {
    const [sampleName, setSampleName] = useState<SampleName>(query.get('sample') === 'cs' ? 'cs' : 'en');
    const [doc, setDoc] = useState<BlockDocumentData>(() => sampleFor(sampleName));
    const [editing, setEditing] = useState(!query.has('readonly'));
    const [theme, setTheme] = useState<Theme>(query.has('light') ? 'light' : 'dark');
    const [changes, setChanges] = useState(0);
    const [hostShowsGps, setHostShowsGps] = useState(query.has('gps'));
    // Empty follows the document language
    const [locale, setLocale] = useState(query.get('locale') ?? '');

    // Once, after the first render: bring the block named in the query into view and focus it
    useEffect(() => {
        const id = query.get('block');
        const el = id ? document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`) : null;
        el?.scrollIntoView({ block: 'center' });
        el?.focus({ preventScroll: true });
    }, []);
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
                <label title="The host's fieldVisibility prop; a block's own visibility still wins">
                    <input type="checkbox" checked={hostShowsGps} onChange={(e) => setHostShowsGps(e.target.checked)} />{' '}
                    Show GPS and RÚIAN code
                </label>
                <label title="Which sample document to show; switching starts it afresh">
                    Sample:{' '}
                    <select
                        value={sampleName}
                        onChange={(e) => {
                            const name = e.target.value as SampleName;
                            setSampleName(name);
                            setDoc(sampleFor(name));
                            setChanges(0);
                        }}
                    >
                        <option value="en">English</option>
                        <option value="cs">Czech</option>
                    </select>
                </label>
                <label title="The document's language: the lang of its content, and of the texts unless the host sets a locale">
                    Document language:{' '}
                    <select
                        value={doc.language ?? ''}
                        onChange={(e) => setDoc((d) => ({ ...d, language: e.target.value || undefined }))}
                    >
                        <option value="">Not set</option>
                        <option value="en">English</option>
                        <option value="cs">Czech</option>
                    </select>
                </label>
                <label title="The host's locale prop; without it, the document language decides">
                    Texts:{' '}
                    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                        <option value="">Document language</option>
                        <option value="en">English</option>
                        <option value="cs">Czech</option>
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => {
                        setDoc(sampleFor(sampleName));
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
                    fieldVisibility={hostShowsGps ? { address: { gps: true, ruianCode: true } } : undefined}
                    locale={locale || undefined}
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
