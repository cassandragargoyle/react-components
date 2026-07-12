/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Diagnostic logging for CodeEditor's Monaco loading/preflight — always mirrors
// to the devtools console, and additionally to the extension host's log file
// when the user enables the portunix.pilotChat.codeEditorDebugLog setting

import { getVsCodeApi } from '../../../adapters/vscodeApi';
import type { DiagnosticLevel } from '../../../core/messageTypes';

const CONSOLE_METHOD: Record<DiagnosticLevel, 'log' | 'warn' | 'error'> = {
    info: 'log',
    warn: 'warn',
    error: 'error',
};

/** Log a CodeEditor diagnostic entry (preflight result, load/mount failure) */
export function diagnosticLog(level: DiagnosticLevel, message: string, detail?: string): void {
    console[CONSOLE_METHOD[level]](`[CodeEditor] ${message}`, detail ?? '');

    if (!window.__portunixCodeEditorDebugLog__) return;
    getVsCodeApi()?.postMessage({ type: 'codeEditorDiagnostic', level, message, detail });
}
