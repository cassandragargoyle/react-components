/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Diagnostic logging for CodeEditor's Monaco loading/preflight — always mirrors
// to the devtools console, and additionally to the host's sink when one is configured

import { codeEditorConfig, type CodeEditorDiagnosticLevel } from './config';

const CONSOLE_METHOD: Record<CodeEditorDiagnosticLevel, 'log' | 'warn' | 'error'> = {
    info: 'log',
    warn: 'warn',
    error: 'error',
};

/** Log a CodeEditor diagnostic entry (preflight result, load/mount failure) */
export function diagnosticLog(level: CodeEditorDiagnosticLevel, message: string, detail?: string): void {
    console[CONSOLE_METHOD[level]](`[CodeEditor] ${message}`, detail ?? '');
    codeEditorConfig().onDiagnostic?.(level, message, detail);
}
