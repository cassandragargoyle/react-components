/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Host configuration for CodeEditor: where the Monaco chunk is served from and where diagnostics go
// Set once by the host before the first editor mounts; every field has a working default

/** Severity of a CodeEditor diagnostic entry (preflight check, load/mount failures) */
export type CodeEditorDiagnosticLevel = 'info' | 'warn' | 'error';

/** Receives every CodeEditor diagnostic entry after it is written to the console */
export type CodeEditorDiagnosticSink = (level: CodeEditorDiagnosticLevel, message: string, detail?: string) => void;

export interface CodeEditorConfig {
    /** Base URL of code-editor.js, code-editor.css and workers/; default './code-editor' */
    baseUrl?: string;
    /** Extra destination for diagnostics, e.g. a host log file; the console is always used */
    onDiagnostic?: CodeEditorDiagnosticSink;
}

let current: CodeEditorConfig = {};

/** Merge host settings into the CodeEditor configuration; call before the first mount */
export function configureCodeEditor(config: CodeEditorConfig): void {
    current = { ...current, ...config };
}

/** The configuration in effect */
export function codeEditorConfig(): Readonly<CodeEditorConfig> {
    return current;
}
