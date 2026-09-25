/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The form that inserts an image or a video, or changes where one points
// An image cannot be submitted without its alternative text

import React, { useId, useState } from 'react';

import type { MediaFields } from './editor';

export interface MediaFormProps {
    type: 'image' | 'video';
    mode: 'insert' | 'edit';
    initial?: MediaFields;
    onSubmit(fields: MediaFields): void;
    onCancel(): void;
}

export function MediaForm({ type, mode, initial, onSubmit, onCancel }: MediaFormProps): React.ReactElement {
    const id = useId();
    const [src, setSrc] = useState(initial?.src ?? '');
    const [alt, setAlt] = useState(initial?.alt ?? '');
    const [poster, setPoster] = useState(initial?.poster ?? '');
    const [error, setError] = useState<string | null>(null);
    const noun = type === 'image' ? 'image' : 'video';

    const submit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!src.trim()) {
            setError(`Enter the address of the ${noun}`);
            return;
        }
        if (type === 'image' && !alt.trim()) {
            setError('Describe the image in the alternative text');
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
            aria-label={`${mode === 'insert' ? 'Insert' : 'Edit'} ${noun}`}
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
            <label htmlFor={`${id}-src`}>{type === 'image' ? 'Image address' : 'Video address'}</label>
            <input
                id={`${id}-src`}
                type="text"
                value={src}
                autoFocus
                onChange={(e) => setSrc(e.target.value)}
            />
            {type === 'image' ? (
                <>
                    <label htmlFor={`${id}-alt`}>Alternative text</label>
                    <input id={`${id}-alt`} type="text" value={alt} onChange={(e) => setAlt(e.target.value)} />
                </>
            ) : (
                <>
                    <label htmlFor={`${id}-poster`}>Poster address (optional)</label>
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
                    {mode === 'insert' ? 'Insert' : 'Save'}
                </button>
                <button type="button" className="bd-button" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
