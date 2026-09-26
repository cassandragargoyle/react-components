/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The display settings of a block (ADR-001): a "Show in document" switch per declared field
// Opened from the block's setup button; each switch writes the block's visibility at once

import React, { useEffect, useId, useRef } from 'react';

import { declaredFields, inheritedFieldVisibility, isFieldVisible, withFieldShown } from './fields';
import type { BlockFieldVisibility, DocumentBlock, FieldVisibility } from './types';

export interface DisplaySettingsProps {
    block: DocumentBlock;
    /** How the block is named to assistive technology, e.g. `address Lipová 1234/12` */
    blockName: string;
    fieldVisibility?: BlockFieldVisibility;
    /** Receives the block's new `visibility`, `undefined` when no override is left */
    onChange(visibility: FieldVisibility | undefined): void;
    /** Closes the panel; `restoreFocus` is false when focus is already going elsewhere */
    onClose(restoreFocus: boolean): void;
}

export function DisplaySettings({
    block,
    blockName,
    fieldVisibility,
    onChange,
    onClose,
}: DisplaySettingsProps): React.ReactElement {
    const id = useId();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ref.current?.querySelector<HTMLInputElement>('input')?.focus();
        const onPointerDown = (e: MouseEvent): void => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="bd-settings"
            role="dialog"
            aria-labelledby={`${id}-title`}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose(true);
                }
                // Keys pressed here are not block shortcuts
                e.stopPropagation();
            }}
        >
            <p className="bd-settings-title" id={`${id}-title`}>
                Show in document<span className="bd-visually-hidden"> — {blockName}</span>
            </p>
            {declaredFields(block).map(({ field, label }) => {
                const shown = isFieldVisible(block, field, fieldVisibility);
                const own = shown !== inheritedFieldVisibility(block, field, fieldVisibility);
                return (
                    <label key={field} className="bd-settings-row">
                        <span>
                            {label}
                            {own && <span className="bd-settings-own"> · this block</span>}
                        </span>
                        <span className="bd-switch">
                            <input
                                type="checkbox"
                                role="switch"
                                checked={shown}
                                aria-label={`Show ${label} in the document`}
                                onChange={(e) => onChange(withFieldShown(block, field, e.target.checked, fieldVisibility))}
                            />
                        </span>
                    </label>
                );
            })}
            <div className="bd-form-actions">
                <button type="button" className="bd-button" onClick={() => onClose(true)}>
                    Done
                </button>
            </div>
        </div>
    );
}
