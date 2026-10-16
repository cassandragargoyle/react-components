/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for the CodeEditor host configuration: the chunk base URL, the
// diagnostic sink, and the language resolution the editor mounts with

import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseUrl, workerBaseUrl } from './bundleLoader';
import { configureCodeEditor } from './config';
import { diagnosticLog } from './diagnosticLog';
import { resolveMonacoLanguage } from './languageMap';

afterEach(() => {
    configureCodeEditor({ baseUrl: undefined, onDiagnostic: undefined });
    vi.restoreAllMocks();
});

describe('CodeEditor configuration', () => {
    it('serves the Monaco chunk from ./code-editor by default', () => {
        expect(baseUrl()).toBe('./code-editor');
        expect(workerBaseUrl()).toBe('./code-editor/workers');
    });

    it('uses the base URL the host configures', () => {
        configureCodeEditor({ baseUrl: 'vscode-webview://abc/code-editor' });
        expect(workerBaseUrl()).toBe('vscode-webview://abc/code-editor/workers');
    });

    it('keeps earlier settings when a later call sets another field', () => {
        configureCodeEditor({ baseUrl: '/assets/editor' });
        configureCodeEditor({ onDiagnostic: () => undefined });
        expect(baseUrl()).toBe('/assets/editor');
    });

    it('writes diagnostics to the console and to the configured sink', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const sink = vi.fn();
        configureCodeEditor({ onDiagnostic: sink });

        diagnosticLog('warn', 'slow start', '2 s');

        expect(warn).toHaveBeenCalledWith('[CodeEditor] slow start', '2 s');
        expect(sink).toHaveBeenCalledWith('warn', 'slow start', '2 s');
    });

    it('logs to the console only when no sink is configured', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        expect(() => diagnosticLog('info', 'ready')).not.toThrow();
        expect(log).toHaveBeenCalledOnce();
    });
});

describe('resolveMonacoLanguage', () => {
    it('maps fence identifiers and file extensions to Monaco ids', () => {
        expect(resolveMonacoLanguage('py')).toBe('python');
        expect(resolveMonacoLanguage(undefined, 'src/app.tsx')).toBe('typescript');
    });

    it('passes an unmapped language id through and falls back to plaintext without input', () => {
        expect(resolveMonacoLanguage('Haskell')).toBe('haskell');
        expect(resolveMonacoLanguage(undefined, 'notes.unknown')).toBe('plaintext');
        expect(resolveMonacoLanguage()).toBe('plaintext');
    });
});
