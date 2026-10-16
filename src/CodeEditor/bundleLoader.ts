/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Shared runtime loader for the lazy-loaded Monaco chunk (code-editor.js)
// Used by both CodeEditor.tsx (actual mounts) and preflight.ts (startup capability check)

import type { MountHandle, MountOptions } from './monacoLoader';

// Base URL for the code-editor.js chunk + its worker scripts. Hosts that need a
// different location (VS Code webview -> asWebviewUri) set this before the app
// mounts, e.g. `window.__portunixCodeEditorBaseUrl__ = someAsWebviewUri`
declare global {
    interface Window {
        __portunixCodeEditorBaseUrl__?: string;
        __portunixCodeEditor?: { mount: (container: HTMLElement, options: MountOptions) => MountHandle };
        __portunixCodeEditorLoad__?: Promise<void>;
        /** Set by the extension host when the codeEditorDebugLog setting is enabled */
        __portunixCodeEditorDebugLog__?: boolean;
    }
}

export function baseUrl(): string {
    return window.__portunixCodeEditorBaseUrl__ ?? './code-editor';
}

export function workerBaseUrl(): string {
    return `${baseUrl()}/workers`;
}

// Load the separate monaco-editor bundle exactly once per page, via a runtime
// <script> tag — this is what keeps Monaco out of the main app bundle until it
// is actually needed (see esbuild.code-editor.mjs)
export function loadMonacoBundle(): Promise<void> {
    if (window.__portunixCodeEditor) return Promise.resolve();
    if (window.__portunixCodeEditorLoad__) return window.__portunixCodeEditorLoad__;

    window.__portunixCodeEditorLoad__ = new Promise((resolve, reject) => {
        const base = baseUrl();

        if (!document.getElementById('portunix-code-editor-css')) {
            const link = document.createElement('link');
            link.id = 'portunix-code-editor-css';
            link.rel = 'stylesheet';
            link.href = `${base}/code-editor.css`;
            document.head.appendChild(link);
        }

        const script = document.createElement('script');
        script.src = `${base}/code-editor.js`;
        script.onload = () => (window.__portunixCodeEditor ? resolve() : reject(new Error('code-editor.js loaded but did not register')));
        script.onerror = () => reject(new Error(`Failed to load ${script.src}`));
        document.head.appendChild(script);
    });
    return window.__portunixCodeEditorLoad__;
}
