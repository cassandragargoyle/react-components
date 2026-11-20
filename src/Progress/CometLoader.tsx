/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Busy indicator: a comet with a tail that circles an invisible centre on a rosette path,
// speeds up and slows down, while the orbit breathes between a wide and a tall ellipse.
// CSS transform animations only, so it keeps moving while a long render blocks the page

import { type JSX } from 'react';
import cometLoaderStyles from './CometLoader.css';

// Inject styles once under the 'text' loader (single-file bundles); under the 'css'
// loader the import is a non-string and the stylesheet is emitted as a sibling file.
if (
    typeof document !== 'undefined' &&
    typeof cometLoaderStyles === 'string' &&
    cometLoaderStyles &&
    !document.getElementById('comet-loader-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'comet-loader-styles';
    styleEl.textContent = cometLoaderStyles;
    document.head.appendChild(styleEl);
}

export interface CometLoaderProps {
    /** Text under the comet, for example "Rendering README.md…"; also read by screen readers */
    label?: string;
    /** Width and height of the area of the path in px (default 120) */
    size?: number;
    /** Extra class on the root element */
    className?: string;
}

/** Size of the stage the path is drawn for, in px */
const BASE_SIZE = 120;

/** Particles of the tail: how many seconds later each one runs the path */
const TAIL = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

/** One particle of the comet: the arm and the epicycle, `lag` seconds behind the head */
function Particle({ lag, index }: { lag: number; index: number }): JSX.Element {
    const delay = { animationDelay: `${-lag}s` };
    const fade = 1 - index / TAIL.length;
    const dot = 10 * fade + 2;
    return (
        <div className="comet-loader-arm" style={delay}>
            <div className="comet-loader-epicycle">
                <div className="comet-loader-turn" style={delay}>
                    <div
                        className="comet-loader-dot"
                        style={{ ...delay, opacity: fade, width: dot, height: dot, marginLeft: -dot / 2, marginTop: -dot / 2 }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * CometLoader shows that the host is busy. It has no state and no timers: the host decides
 * when to mount and unmount it. To keep it moving during a long synchronous task, mount it
 * and start the task one paint later (requestAnimationFrame, then setTimeout)
 */
export function CometLoader({ label, size = BASE_SIZE, className }: CometLoaderProps): JSX.Element {
    return (
        <div
            className={`comet-loader${className ? ` ${className}` : ''}`}
            role="status"
            aria-live="polite"
            aria-label={label ? undefined : 'Loading'}
        >
            <div className="comet-loader-stage" style={{ width: size, height: size }} aria-hidden="true">
                <div className="comet-loader-scale" style={size === BASE_SIZE ? undefined : { transform: `scale(${size / BASE_SIZE})` }}>
                    <div className="comet-loader-core" />
                    <div className="comet-loader-breathe">
                        {TAIL.map((lag, index) => (
                            <Particle key={lag} lag={lag} index={index} />
                        ))}
                    </div>
                </div>
            </div>
            {label && <div className="comet-loader-label">{label}</div>}
        </div>
    );
}
