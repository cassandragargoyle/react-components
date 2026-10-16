/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Imperative monaco-editor wrapper — the only module that imports 'monaco-editor'
// Bundled as its own IIFE chunk (see esbuild.code-editor.mjs) so hosts that never
// render a CodeEditor never pay Monaco's bundle-size cost

import * as monaco from 'monaco-editor';

declare global {
    interface Window {
        MonacoEnvironment?: monaco.Environment;
    }
}

export interface MountOptions {
    value: string;
    language: string;
    readOnly: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    onChange?: (value: string) => void;
    /** Base URL the worker scripts are served from (webview: asWebviewUri; else a relative path) */
    workerBaseUrl?: string;
}

export interface MountHandle {
    updateValue(value: string): void;
    updateOptions(options: Partial<Omit<MountOptions, 'onChange'>>): void;
    onContentHeightChange(cb: (height: number) => void): () => void;
    getContentHeight(): number;
    dispose(): void;
}

// Label -> bundled worker file. Only 'editor' (base model ops) and 'json' (schema
// validation for future in-app config editing) are bundled — see CodeEditor/README.md
const WORKER_FILE_BY_LABEL: Record<string, string> = {
    json: 'json.worker.js',
};

let workerBaseUrl = './workers';
let environmentConfigured = false;

// Fetch the worker script's source and construct the Worker from a blob: URL
// instead of handing the (cross-origin, e.g. asWebviewUri) URL straight to
// `new Worker()`. Worker scripts must be same-origin with the document that
// creates them; blob: URLs always are. Monaco's own `getWorkerUrl` path calls
// `new Worker(workerUrl, ...)` directly and unguarded (see
// monaco-editor/esm/vs/base/browser/webWorkerFactory.js), so a cross-origin
// worker URL throws synchronously there and crashes monaco.editor.create() —
// `getWorker` (this hook) is the one Monaco lets return a rejectable Promise,
// so a failure here degrades gracefully instead of throwing
async function createWorkerFromUrl(url: string, label: string): Promise<Worker> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch worker script ${url}: HTTP ${response.status}`);
    const code = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    return new Worker(blobUrl, { name: label, type: 'module' });
}

function configureEnvironment(): void {
    if (environmentConfigured) return;
    environmentConfigured = true;
    self.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string): Promise<Worker> {
            const file = WORKER_FILE_BY_LABEL[label] ?? 'editor.worker.js';
            return createWorkerFromUrl(`${workerBaseUrl}/${file}`, label);
        },
    };
}

// Convert a computed 'rgb(r, g, b)' / 'rgba(r, g, b, a)' string to '#rrggbb', since
// monaco.editor.defineTheme only accepts hex color values
function toHex(cssColor: string, fallback: string): string {
    const match = cssColor.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return fallback;
    const [, r, g, b] = match;
    const toByte = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

// Derive a Monaco theme from the app's --pilot-* / --vscode-* CSS custom properties
// so the editor matches the current VS Code theme (or the standalone dark fallback)
function definePilotTheme(): string {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => toHex(style.getPropertyValue(name), fallback);

    const background = read('--pilot-code-bg', '#1e1e1e');
    const foreground = read('--pilot-fg', '#cccccc');
    const border = read('--pilot-border', '#444444');

    // Luminance of the background decides the base rule set (token colors)
    const bg = background.replace('#', '');
    const luminance = (parseInt(bg.slice(0, 2), 16) * 299 +
        parseInt(bg.slice(2, 4), 16) * 587 +
        parseInt(bg.slice(4, 6), 16) * 114) / 1000;
    const base: monaco.editor.BuiltinTheme = luminance > 140 ? 'vs' : 'vs-dark';

    monaco.editor.defineTheme('pilot-theme', {
        base,
        inherit: true,
        rules: [],
        colors: {
            'editor.background': background,
            'editor.foreground': foreground,
            'editorLineNumber.foreground': border,
            'editorWidget.background': background,
        },
    });
    return 'pilot-theme';
}

/** Mount a Monaco editor instance into `container`; call the returned handle's `dispose()` on unmount */
export function mount(container: HTMLElement, options: MountOptions): MountHandle {
    if (options.workerBaseUrl) workerBaseUrl = options.workerBaseUrl;
    configureEnvironment();

    const theme = definePilotTheme();
    const editor = monaco.editor.create(container, {
        value: options.value,
        language: options.language,
        readOnly: options.readOnly,
        domReadOnly: options.readOnly,
        theme,
        minimap: { enabled: options.minimap },
        lineNumbers: options.lineNumbers ? 'on' : 'off',
        scrollBeyondLastLine: false,
        folding: options.lineNumbers,
        automaticLayout: true,
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        fontSize: 13,
        renderLineHighlight: options.readOnly ? 'none' : 'line',
        overviewRulerLanes: 0,
        scrollbar: { alwaysConsumeMouseWheel: false },
    });

    if (options.onChange) {
        editor.onDidChangeModelContent(() => options.onChange!(editor.getValue()));
    }

    return {
        updateValue(value: string) {
            if (editor.getValue() !== value) editor.setValue(value);
        },
        updateOptions(next) {
            if (next.language !== undefined) {
                const model = editor.getModel();
                if (model) monaco.editor.setModelLanguage(model, next.language);
            }
            editor.updateOptions({
                readOnly: next.readOnly,
                domReadOnly: next.readOnly,
                minimap: next.minimap !== undefined ? { enabled: next.minimap } : undefined,
                lineNumbers: next.lineNumbers !== undefined ? (next.lineNumbers ? 'on' : 'off') : undefined,
            });
        },
        onContentHeightChange(cb: (height: number) => void) {
            const disposable = editor.onDidContentSizeChange(() => cb(editor.getContentHeight()));
            return () => disposable.dispose();
        },
        getContentHeight() {
            return editor.getContentHeight();
        },
        dispose() {
            editor.dispose();
        },
    };
}

declare global {
    interface Window {
        __portunixCodeEditor?: { mount: typeof mount };
    }
}

// Self-register on the global namespace — the host page loads this bundle via a
// runtime <script> tag once a CodeEditor first mounts (see CodeEditor.tsx)
window.__portunixCodeEditor = { mount };
