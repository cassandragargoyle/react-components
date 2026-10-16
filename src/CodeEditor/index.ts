/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public exports for the CodeEditor component
// Re-exports the component, its props, and the language-resolution helper

export { CodeEditor } from './CodeEditor';
export type { CodeEditorProps } from './CodeEditor';
export { resolveMonacoLanguage } from './languageMap';
