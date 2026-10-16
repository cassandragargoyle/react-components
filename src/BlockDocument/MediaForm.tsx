/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The form that inserts an image or a video, or changes where one points
// An image cannot be submitted without its alternative text

import React, { useId, useState } from 'react';

import type { MediaFields } from './editor';
import { useMessages } from './messages';

export interface MediaFormProps {
    type: 'image' | 'video';
    mode: 'insert' | 'edit';
    initial?: MediaFields;
    onSubmit(fields: MediaFields): void;
    onCancel(): void;
}

export function MediaForm({ type, mode, initial, onSubmit, onCancel }: MediaFormProps): React.ReactElement {
    const id = useId();
    const text = useMessages();
    const [src, setSrc] = useState(initial?.src ?? '');
    const [alt, setAlt] = useState(initial?.alt ?? '');
    const [poster, setPoster] = useState(initial?.poster ?? '');
    const [error, setError] = useState<string | null>(null);

    const submit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!src.trim()) {
            setError(text.srcRequired[type]);
            return;
        }
        if (type === 'image' && !alt.trim()) {
            setError(text.altRequired);
            return;
        }
        onSubmit(
            type === 'image'
                ? { src: src.trim(), alt: alt.trim() }
                : { src: src.trim(), poster: poster.trim() || undefined },
        );
    };

    return (
        <form
            className="bd-media-form"
            aria-label={mode === 'insert' ? text.insert[type] : text.edit[type]}
            onSubmit={submit}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel();
                }
                // Keys typed here are not block shortcuts
                e.stopPropagation();
            }}
        >
            <label htmlFor={`${id}-src`}>{type === 'image' ? text.imageAddress : text.videoAddress}</label>
            <input
                id={`${id}-src`}
                type="text"
                value={src}
                autoFocus
                onChange={(e) => setSrc(e.target.value)}
            />
            {type === 'image' ? (
                <>
                    <label htmlFor={`${id}-alt`}>{text.altText}</label>
                    <input id={`${id}-alt`} type="text" value={alt} onChange={(e) => setAlt(e.target.value)} />
                </>
            ) : (
                <>
                    <label htmlFor={`${id}-poster`}>{text.posterAddress}</label>
                    <input
                        id={`${id}-poster`}
                        type="text"
                        value={poster}
                        onChange={(e) => setPoster(e.target.value)}
                    />
                </>
            )}
            {error && (
                <p className="bd-form-error" role="alert">
                    {error}
                </p>
            )}
            <div className="bd-form-actions">
                <button type="submit" className="bd-button bd-button--primary">
                    {mode === 'insert' ? text.insertButton : text.save}
                </button>
                <button type="button" className="bd-button" onClick={onCancel}>
                    {text.cancel}
                </button>
            </div>
        </form>
    );
}
