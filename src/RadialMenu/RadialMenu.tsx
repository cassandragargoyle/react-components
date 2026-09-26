/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Framework-agnostic radial (pie) action menu: hub + concentric rings of segments
// Handles geometry, pointer hit-testing, hover-select, nested rings, and keyboard nav

import React, { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RadialMenuAction, RadialMenuActive, RadialMenuOptions } from './types';
import radialMenuStyles from './RadialMenu.css';

// Inject styles once under the 'text' loader (single-file bundles); under the 'css'
// loader the import is a non-string and the stylesheet is emitted as a sibling file.
if (
    typeof document !== 'undefined' &&
    typeof radialMenuStyles === 'string' &&
    radialMenuStyles &&
    !document.getElementById('radial-menu-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'radial-menu-styles';
    styleEl.textContent = radialMenuStyles;
    document.head.appendChild(styleEl);
}

// Fixed geometry (px). radius/ringGap come from options; the rest are visual constants.
const HUB_R = 32; // hub circle radius
const PAD = 4; // gap between hub and ring 1, and between the ring band and its fill
const SLACK = 12; // forgiving hit area just past the outermost ring before "outside"
const DEFAULT_RADIUS = 96; // outer radius of ring 1
const DEFAULT_RING_GAP = 60; // width added per nested ring level

interface RadialMenuProps {
    options: RadialMenuOptions;
    /** Called on commit, cancel, Escape, or loss of pointer/focus — the host clears state */
    onClose: () => void;
}

// Convert a polar coordinate (degrees, 0 = up, clockwise) to a Cartesian point about a center
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// SVG path for an annular sector between radii r0/r1 spanning angles a0..a1 (degrees)
function sectorPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
    const large = a1 - a0 > 180 ? 1 : 0;
    const o0 = polar(cx, cy, r1, a0);
    const o1 = polar(cx, cy, r1, a1);
    const i1 = polar(cx, cy, r0, a1);
    const i0 = polar(cx, cy, r0, a0);
    return [
        `M ${o0.x} ${o0.y}`,
        `A ${r1} ${r1} 0 ${large} 1 ${o1.x} ${o1.y}`,
        `L ${i1.x} ${i1.y}`,
        `A ${r0} ${r0} 0 ${large} 0 ${i0.x} ${i0.y}`,
        'Z',
    ].join(' ');
}

// SVG path for a full annulus (used when a ring has a single segment)
function ringPath(cx: number, cy: number, r0: number, r1: number): string {
    return [
        `M ${cx - r1} ${cy}`,
        `a ${r1} ${r1} 0 1 0 ${2 * r1} 0`,
        `a ${r1} ${r1} 0 1 0 ${-2 * r1} 0`,
        `M ${cx - r0} ${cy}`,
        `a ${r0} ${r0} 0 1 1 ${2 * r0} 0`,
        `a ${r0} ${r0} 0 1 1 ${-2 * r0} 0`,
        'Z',
    ].join(' ');
}

export function RadialMenu({ options, onClose }: RadialMenuProps): JSX.Element | null {
    const radius = options.radius ?? DEFAULT_RADIUS;
    const ringGap = options.ringGap ?? DEFAULT_RING_GAP;

    // Expanded segment index per open ring level (path[0] = expanded ring-1 index, etc.)
    const [path, setPath] = useState<number[]>([]);
    // Currently highlighted target
    const [active, setActive] = useState<RadialMenuActive>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Inner/outer radius of a given ring level
    const bounds = useCallback(
        (level: number): { inner: number; outer: number } =>
            level === 0
                ? { inner: HUB_R + PAD, outer: radius }
                : { inner: radius + (level - 1) * ringGap + PAD, outer: radius + level * ringGap },
        [radius, ringGap]
    );

    // The chain of rings currently open, derived from the expand path
    const rings = useMemo<RadialMenuAction[][]>(() => {
        const result: RadialMenuAction[][] = [options.actions];
        let current = options.actions;
        for (const idx of path) {
            const seg = current[idx];
            if (seg?.children?.length) {
                result.push(seg.children);
                current = seg.children;
            } else {
                break;
            }
        }
        return result;
    }, [options.actions, path]);

    // Outer radius of the last open ring plus a forgiving margin
    const maxOuter = bounds(rings.length - 1).outer;
    // Half-size of the square SVG/label box, centered on the anchor
    const half = maxOuter + PAD;

    // Resolve a pointer position (client coords) to a highlighted target + the ring path it implies
    const hitTest = useCallback(
        (clientX: number, clientY: number): { active: RadialMenuActive; path: number[] } => {
            const dx = clientX - options.position.x;
            const dy = clientY - options.position.y;
            const r = Math.hypot(dx, dy);
            if (r <= HUB_R + PAD) return { active: 'hub', path: [] };

            // Angle from the top, clockwise, in [0, 360)
            const deg = (((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360 + 360) % 360;

            for (let level = 0; level < rings.length; level++) {
                const { inner, outer } = bounds(level);
                const isLast = level === rings.length - 1;
                const outerLimit = isLast ? outer + SLACK : outer;
                if (r < inner || r > outerLimit) continue;
                const count = rings[level].length;
                const index = Math.min(count - 1, Math.floor((deg / 360) * count));
                const newPath = path.slice(0, level);
                if (rings[level][index]?.children?.length) newPath.push(index);
                return { active: { level, index }, path: newPath };
            }
            // Beyond every ring or in a dead zone — nothing highlighted, keep rings as-is
            return { active: null, path };
        },
        [bounds, options.position.x, options.position.y, path, rings]
    );

    // Resolve the action a target currently points at (null for the empty/cancel zone)
    const actionAt = useCallback(
        (target: RadialMenuActive): RadialMenuAction | null => {
            if (target === 'hub') return options.hub;
            if (target && rings[target.level]) return rings[target.level][target.index] ?? null;
            return null;
        },
        [options.hub, rings]
    );

    // Invoke a leaf action's handler and close the whole menu; non-leaf/disabled do not commit
    const commit = useCallback(
        (action: RadialMenuAction | null) => {
            if (!action || action.disabled) return false;
            if (action.children?.length) return false; // non-leaf — expansion only, never commits
            action.onSelect?.();
            onClose();
            return true;
        },
        [onClose]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const next = hitTest(e.clientX, e.clientY);
            setActive(next.active);
            setPath((prev) =>
                prev.length === next.path.length && prev.every((v, i) => v === next.path[i])
                    ? prev
                    : next.path
            );
        },
        [hitTest]
    );

    // Commit on release/click over a highlighted leaf; cancel when released in the empty zone
    const handleCommit = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const target = hitTest(e.clientX, e.clientY).active;
            const action = actionAt(target);
            if (!action) {
                onClose(); // released outside any segment — cancel
                return;
            }
            commit(action); // leaf commits + closes; non-leaf keeps the menu open
        },
        [actionAt, commit, hitTest, onClose]
    );

    // Keyboard fallback: cycle a ring, expand into children, collapse a level, or cancel
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const hasSeg = active !== null && active !== 'hub';
            const level = hasSeg ? active.level : 0;
            const index = hasSeg ? active.index : 0;
            const count = rings[level]?.length ?? 0;

            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight' /* cycle when the segment has no children */:
                    if (e.key === 'ArrowRight' && hasSeg) {
                        const seg = rings[level]?.[index];
                        if (seg?.children?.length) {
                            e.preventDefault();
                            setPath(path.slice(0, level).concat(index));
                            setActive({ level: level + 1, index: 0 });
                            return;
                        }
                    }
                    if (count > 0) {
                        e.preventDefault();
                        setActive({ level, index: hasSeg ? (index + 1) % count : 0 });
                    }
                    return;
                case 'ArrowUp':
                    if (count > 0) {
                        e.preventDefault();
                        setActive({ level, index: hasSeg ? (index - 1 + count) % count : 0 });
                    }
                    return;
                case 'ArrowLeft':
                case 'Escape':
                    e.preventDefault();
                    if (level > 0) {
                        const parent = path[level - 1] ?? 0;
                        setPath(path.slice(0, level - 1));
                        setActive({ level: level - 1, index: parent });
                    } else {
                        onClose();
                    }
                    return;
                case 'Enter':
                case ' ': {
                    e.preventDefault();
                    const seg = rings[level]?.[index];
                    if (seg?.children?.length) {
                        setPath(path.slice(0, level).concat(index));
                        setActive({ level: level + 1, index: 0 });
                    } else {
                        commit(seg ?? null);
                    }
                    return;
                }
                default:
                    return;
            }
        },
        [active, commit, onClose, path, rings]
    );

    // Focus the overlay on open (keyboard nav) and close on scroll/resize/blur of the window
    useEffect(() => {
        overlayRef.current?.focus();
        const close = () => onClose();
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('blur', close);
        };
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    const activeAction = actionAt(active);

    // Render each open ring's segments as SVG sectors, with an HTML icon/label overlay
    const segments: JSX.Element[] = [];
    const labels: JSX.Element[] = [];
    for (let level = 0; level < rings.length; level++) {
        const ring = rings[level];
        const { inner, outer } = bounds(level);
        const step = 360 / ring.length;
        const mid = (inner + outer) / 2;
        ring.forEach((action, index) => {
            const isActive = active !== 'hub' && active?.level === level && active?.index === index;
            const a0 = index * step;
            const a1 = a0 + step;
            const d =
                ring.length === 1
                    ? ringPath(half, half, inner, outer)
                    : sectorPath(half, half, inner, outer, a0, a1);
            segments.push(
                <path
                    key={`seg-${level}-${index}`}
                    className={`radial-menu-seg${isActive ? ' is-active' : ''}${
                        action.disabled ? ' is-disabled' : ''
                    }`}
                    d={d}
                    fillRule={ring.length === 1 ? 'evenodd' : undefined}
                />
            );
            const c = polar(half, half, mid, a0 + step / 2);
            labels.push(
                <div
                    key={`lbl-${level}-${index}`}
                    className={`radial-menu-label${isActive ? ' is-active' : ''}${
                        action.disabled ? ' is-disabled' : ''
                    }`}
                    style={{ left: c.x, top: c.y }}
                >
                    {action.icon && <span className="radial-menu-icon">{action.icon}</span>}
                    <span className="radial-menu-text">{action.label}</span>
                    {action.children?.length ? <span className="radial-menu-caret">›</span> : null}
                </div>
            );
        });
    }

    const size = half * 2;

    return createPortal(
        <div
            ref={overlayRef}
            className="radial-menu-overlay"
            role="menu"
            tabIndex={-1}
            aria-label={options.hub.tooltip || options.hub.label}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => {
                // Touch/pen: commit on release (long-press hold-and-release). Mouse waits for click
                // so the terminating event is handled once, on the overlay, before it unmounts.
                if (e.pointerType !== 'mouse') handleCommit(e);
            }}
            onClick={handleCommit}
            onKeyDown={handleKeyDown}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                className="radial-menu"
                style={{ left: options.position.x - half, top: options.position.y - half, width: size, height: size }}
            >
                <svg className="radial-menu-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {segments}
                    <circle
                        className={`radial-menu-hub${active === 'hub' ? ' is-active' : ''}${
                            options.hub.disabled ? ' is-disabled' : ''
                        }`}
                        cx={half}
                        cy={half}
                        r={HUB_R}
                    />
                </svg>
                <div className={`radial-menu-label radial-menu-hub-label${active === 'hub' ? ' is-active' : ''}`} style={{ left: half, top: half }}>
                    {options.hub.icon && <span className="radial-menu-icon">{options.hub.icon}</span>}
                </div>
                {labels}
                {activeAction && (
                    <div className="radial-menu-tooltip" style={{ left: half, top: size + 6 }}>
                        {activeAction.tooltip || activeAction.label}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
