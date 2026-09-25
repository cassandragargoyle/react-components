/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Rich text edited in place: a contentEditable element whose children React never owns
// Each input is read back into spans and proposed; the DOM is rebuilt only when they differ

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useEditor } from './editor';
import { plainToRichText, richTextEqual, richTextToPlain, safeHref } from './richText';
import {
    applyLink,
    caretOffset,
    insertPlainText,
    placeCaret,
    readRichTextFrom,
    renderRichTextInto,
    selectionRangeIn,
    textLength,
} from './richTextDom';
import type { RichText } from './types';

/** What a key handler of the owning block learns about the caret */
export interface CaretInfo {
    offset: number;
    length: number;
}

export interface EditableTextProps {
    value: RichText;
    onChange(value: RichText): void;
    /** The element around the editable, e.g. `h2` for a chapter title */
    as?: keyof React.JSX.IntrinsicElements;
    className?: string;
    label: string;
    placeholder?: string;
    /** No formatting, no links */
    plain?: boolean;
    /** Registers this text as the focus target of a block */
    focusKey?: string;
    /** Enter without Shift; return true when handled */
    onEnter?(caret: CaretInfo): boolean;
    /** Backspace with the caret at the very start and nothing selected; return true when handled */
    onBackspaceAtStart?(): boolean;
    /** Enter with Shift inserts a line break; false makes it do nothing */
    multiline?: boolean;
    id?: string;
}

export function EditableText({
    value,
    onChange,
    as = 'div',
    className,
    label,
    placeholder,
    plain = false,
    focusKey,
    onEnter,
    onBackspaceAtStart,
    multiline = false,
    id,
}: EditableTextProps): React.ReactElement {
    const editor = useEditor();
    const ref = useRef<HTMLDivElement>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const [link, setLink] = useState<{ range: Range; href: string; error?: string } | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (el && !richTextEqual(readRichTextFrom(el), value)) renderRichTextInto(el, value);
    }, [value]);

    useEffect(() => {
        if (!editor || !focusKey) return undefined;
        return editor.registerFocus(focusKey, {
            focus(caret) {
                const el = ref.current;
                if (!el) return;
                el.focus();
                placeCaret(el, caret);
            },
            caret() {
                const el = ref.current;
                return el && el.ownerDocument.activeElement === el ? caretOffset(el) : undefined;
            },
        });
    }, [editor, focusKey]);

    const commit = (): void => {
        const el = ref.current;
        if (!el) return;
        let spans = readRichTextFrom(el);
        if (plain) spans = plainToRichText(richTextToPlain(spans));
        if (!richTextEqual(spans, valueRef.current)) onChange(spans);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
        const el = e.currentTarget;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
            const key = e.key.toLowerCase();
            // Underline is not part of the format; bold and italic are left to the browser
            if (key === 'u' || (plain && (key === 'b' || key === 'i'))) {
                e.preventDefault();
                return;
            }
            if (key === 'k' && !plain) {
                e.preventDefault();
                const range = selectionRangeIn(el);
                if (range) setLink({ range: range.cloneRange(), href: '' });
                return;
            }
        }
        if (e.key === 'Enter' && !e.altKey && !mod) {
            e.preventDefault();
            if (e.shiftKey) {
                if (multiline) {
                    insertPlainText(el, '\n');
                    commit();
                }
                return;
            }
            commit();
            onEnter?.({ offset: caretOffset(el) ?? textLength(el), length: textLength(el) });
            return;
        }
        if (e.key === 'Backspace' && onBackspaceAtStart) {
            const range = selectionRangeIn(el);
            if (range?.collapsed && caretOffset(el) === 0) {
                commit();
                if (onBackspaceAtStart()) e.preventDefault();
            }
        }
    };

    const onPaste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
        // Pasted markup is never trusted: only its text comes in
        e.preventDefault();
        let text = e.clipboardData.getData('text/plain');
        if (!multiline) text = text.replace(/\s*\n\s*/g, ' ');
        insertPlainText(e.currentTarget, text);
        commit();
    };

    const applyLinkForm = (e: React.FormEvent): void => {
        e.preventDefault();
        const el = ref.current;
        if (!link || !el) return;
        const href = link.href.trim();
        if (href && !safeHref(href)) {
            setLink({ ...link, error: 'Only http, https and mailto addresses can be linked' });
            return;
        }
        applyLink(el, link.range, href || undefined);
        setLink(null);
        commit();
        el.focus();
    };

    const closeLinkForm = (): void => {
        setLink(null);
        ref.current?.focus();
    };

    const Wrapper = as as React.ElementType;
    const empty = value.length === 0;

    return (
        <>
            <Wrapper className={className} id={id}>
                <div
                    ref={ref}
                    className="bd-editable"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label={label}
                    aria-multiline={multiline || undefined}
                    data-placeholder={placeholder}
                    data-empty={empty || undefined}
                    spellCheck
                    onInput={commit}
                    onBlur={commit}
                    onKeyDown={onKeyDown}
                    onPaste={onPaste}
                />
            </Wrapper>
            {link && (
                <form
                    className="bd-link-form"
                    aria-label="Link"
                    onSubmit={applyLinkForm}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            closeLinkForm();
                        }
                    }}
                >
                    <label>
                        Link address
                        <input
                            type="text"
                            autoFocus
                            value={link.href}
                            placeholder="https://…  (empty removes the link)"
                            onChange={(e) => setLink({ ...link, href: e.target.value, error: undefined })}
                        />
                    </label>
                    {link.error && (
                        <p className="bd-form-error" role="alert">
                            {link.error}
                        </p>
                    )}
                    <div className="bd-form-actions">
                        <button type="submit" className="bd-button bd-button--primary">
                            Apply
                        </button>
                        <button type="button" className="bd-button" onClick={closeLinkForm}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </>
    );
}
