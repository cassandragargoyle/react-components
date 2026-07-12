/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Reusable async-progress panel with an npm-style spinner
// Configurable title, message, key/value fields, step checklist, and error display

import React, { useEffect, useState } from 'react';
import progressPanelStyles from './ProgressPanel.css';

// Inject styles once under the 'text' loader (single-file bundles); under the 'css'
// loader the import is a non-string and the stylesheet is emitted as a sibling file.
if (
    typeof document !== 'undefined' &&
    typeof progressPanelStyles === 'string' &&
    progressPanelStyles &&
    !document.getElementById('progress-panel-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'progress-panel-styles';
    styleEl.textContent = progressPanelStyles;
    document.head.appendChild(styleEl);
}

/** Available spinner styles */
export type ProgressSpinnerVariant = 'braille' | 'orbit';

// Variant 1 — braille frames, the rotating "snake" used by npm/ora-style CLI spinners
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;

function BrailleSpinner(): JSX.Element {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const id = setInterval(
            () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
            SPINNER_INTERVAL_MS
        );
        return () => clearInterval(id);
    }, []);
    return (
        <span className="progress-panel-spinner" aria-hidden="true">
            {SPINNER_FRAMES[frame]}
        </span>
    );
}

// Variant 2 — an electron orbiting a nucleus on a fixed, tilted orbit (pure CSS 3D)
function OrbitSpinner(): JSX.Element {
    return (
        <span className="progress-panel-atom" aria-hidden="true">
            <span className="progress-panel-scene">
                <span className="progress-panel-nucleus" />
                <span className="progress-panel-orbit">
                    <span className="progress-panel-electron" />
                </span>
            </span>
        </span>
    );
}

function Spinner({ variant }: { variant: ProgressSpinnerVariant }): JSX.Element {
    return variant === 'orbit' ? <OrbitSpinner /> : <BrailleSpinner />;
}

/** Visual state of a single step in the checklist */
export type ProgressStepState = 'pending' | 'active' | 'done' | 'error';

/** One step in the optional progress checklist */
export interface ProgressStep {
    label: string;
    state: ProgressStepState;
}

/** Arbitrary key/value detail row (e.g. Source / Endpoint / File) */
export interface ProgressField {
    key: string;
    value: string;
}

export interface ProgressPanelProps {
    /** Small uppercase heading (e.g. the feature name) */
    title?: string;
    /** Current action description; ignored when `error` is set */
    message: string;
    /** Optional detail rows shown above the steps */
    fields?: ProgressField[];
    /** Optional progress checklist; each step carries its own state */
    steps?: ProgressStep[];
    /** When set, the panel renders as failed and shows this message */
    error?: string;
    /** Optional recovery hint shown under an error */
    hint?: string;
    /** Spinner style while loading (default 'braille') */
    spinner?: ProgressSpinnerVariant;
}

const STEP_ICON: Record<ProgressStepState, string> = {
    done: '✓',
    error: '✕',
    active: '●',
    pending: '○',
};

export function ProgressPanel({
    title,
    message,
    fields,
    steps,
    error,
    hint,
    spinner = 'braille',
}: ProgressPanelProps): JSX.Element {
    const hasError = Boolean(error);

    return (
        <div className="progress-panel">
            <div className="progress-panel-card">
                <div className="progress-panel-head">
                    {hasError ? (
                        <span className="progress-panel-fail" aria-hidden="true">
                            &#10005;
                        </span>
                    ) : (
                        <Spinner variant={spinner} />
                    )}
                    <div className="progress-panel-headtext">
                        {title && <div className="progress-panel-title">{title}</div>}
                        <div className={'progress-panel-message' + (hasError ? ' is-error' : '')}>
                            {message}
                        </div>
                    </div>
                </div>

                {fields && fields.length > 0 && (
                    <div className="progress-panel-fields">
                        {fields.map((f) => (
                            <div className="progress-panel-field" key={f.key}>
                                <span className="progress-panel-field-key">{f.key}</span>
                                <span className="progress-panel-field-val">{f.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {steps && steps.length > 0 && (
                    <ul className="progress-panel-steps">
                        {steps.map((step, i) => (
                            <li key={i} className={`progress-panel-step is-${step.state}`}>
                                <span className="progress-panel-step-icon">
                                    {STEP_ICON[step.state]}
                                </span>
                                <span className="progress-panel-step-label">{step.label}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {hasError && (
                    <div className="progress-panel-error">
                        <div className="progress-panel-error-msg">{error}</div>
                        {hint && <div className="progress-panel-error-hint">{hint}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}
