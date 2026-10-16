/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for the CodeEditor component
// Re-exports the component, its props, the host configuration and the helpers

export { CodeEditor } from './CodeEditor';
export type { CodeEditorProps } from './CodeEditor';
export { resolveMonacoLanguage } from './languageMap';
export { configureCodeEditor } from './config';
export type { CodeEditorConfig, CodeEditorDiagnosticLevel, CodeEditorDiagnosticSink } from './config';
export { runPreflightCheck } from './preflight';
export type { PreflightResult, PreflightFailureReason } from './preflight';
