/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Reusable code/text editing surface backed by monaco-editor, lazy-loaded on first use
// Falls back to plain <pre><code> when Monaco cannot load or initialize on the host platform

import React, { useEffect, useRef, useState } from 'react';
import { resolveMonacoLanguage } from './languageMap';
import { loadMonacoBundle, workerBaseUrl } from './bundleLoader';
import { diagnosticLog } from './diagnosticLog';
import type { MountHandle } from './monacoLoader';
import './CodeEditor.css';

export interface CodeEditorProps {
    /** Source text to display or edit */
    value: string;
    /** Monaco language id, or a markdown fence identifier (e.g. 'py', 'ts') */
    language?: string;
    /** Filename used to infer the language when `language` is not given */
    filename?: string;
    /** Read-only display mode (used for e.g. chat code blocks); default false */
    readOnly?: boolean;
    /** Called with the new value on every edit; only relevant when not read-only */
    onChange?: (value: string) => void;
    /** Show the minimap; default false */
    minimap?: boolean;
    /** Show line numbers and the folding gutter; default true */
    lineNumbers?: boolean;
    /** Cap the editor's height (px) and scroll internally beyond it; default grows to content */
    maxHeight?: number;
    /** Fill the parent container's height and let Monaco scroll internally, like a real editor
     *  pane, instead of growing to fit the content; default true (chat-code-block behavior) */
    autoHeight?: boolean;
    className?: string;
}

const DEFAULT_MIN_HEIGHT = 40;

export function CodeEditor({
    value,
    language,
    filename,
    readOnly = false,
    onChange,
    minimap = false,
    lineNumbers = true,
    maxHeight,
    autoHeight = true,
    className,
}: CodeEditorProps): React.ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<MountHandle | null>(null);
    const unsubscribeHeightRef = useRef<(() => void) | null>(null);
    const [failed, setFailed] = useState(false);
    const [height, setHeight] = useState(DEFAULT_MIN_HEIGHT);

    const monacoLanguage = resolveMonacoLanguage(language, filename);

    // Keep the latest onChange available to the mount-once effect without forcing a remount
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Mount once; cleaned up on unmount. Prop updates are pushed via the effects below
    useEffect(() => {
        let cancelled = false;
        const container = containerRef.current;
        if (!container) return;

        loadMonacoBundle()
            .then(() => {
                if (cancelled || !window.__portunixCodeEditor) return;
                const handle = window.__portunixCodeEditor.mount(container, {
                    value,
                    language: monacoLanguage,
                    readOnly,
                    lineNumbers,
                    minimap,
                    onChange: (v) => onChangeRef.current?.(v),
                    workerBaseUrl: workerBaseUrl(),
                });
                handleRef.current = handle;
                if (autoHeight) {
                    setHeight(Math.max(DEFAULT_MIN_HEIGHT, handle.getContentHeight()));
                    unsubscribeHeightRef.current = handle.onContentHeightChange((h) =>
                        setHeight(Math.max(DEFAULT_MIN_HEIGHT, h))
                    );
                }
            })
            .catch((err) => {
                // Monaco unsupported/unavailable on this platform — degrade to the plain view
                const detail = err instanceof Error ? err.message : String(err);
                diagnosticLog('error', 'falling back to plain rendering', detail);
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
            unsubscribeHeightRef.current?.();
            unsubscribeHeightRef.current = null;
            handleRef.current?.dispose();
            handleRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Push value/language/mode changes into the live editor instance without remounting
    useEffect(() => {
        handleRef.current?.updateValue(value);
    }, [value]);

    useEffect(() => {
        handleRef.current?.updateOptions({ language: monacoLanguage, readOnly, minimap, lineNumbers });
    }, [monacoLanguage, readOnly, minimap, lineNumbers]);

    if (failed) {
        return (
            <pre
                className={`code-editor-fallback ${className ?? ''}`}
                style={autoHeight ? undefined : { height: '100%', margin: 0 }}
            >
                <code>{value}</code>
            </pre>
        );
    }

    const style = autoHeight
        ? { height: maxHeight ? Math.min(height, maxHeight) : height, overflow: maxHeight && height > maxHeight ? 'auto' as const : 'hidden' as const }
        : { height: '100%' };

    return <div ref={containerRef} className={`code-editor ${className ?? ''}`} style={style} />;
}
