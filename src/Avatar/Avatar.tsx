/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Standalone avatar (#100, generalized in #105): renders avatarUrl image with an
// initials fallback and a click-to-open popup menu (Mail to, @ mention). Domain-neutral
// — carries no discussion/venture dependency; `kind` is a local ring-colour cue

import React, { useEffect, useId, useRef, useState } from 'react';
import avatarStyles from './Avatar.css';

// Inject styles once when bundled with the 'text' loader (single-file bundle).
// Under the 'css' loader the import resolves to a non-string and a sibling
// stylesheet is emitted instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof avatarStyles === 'string' &&
    avatarStyles &&
    !document.getElementById('avatar-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'avatar-styles';
    styleEl.textContent = avatarStyles;
    document.head.appendChild(styleEl);
}

/** Actor kind driving the ring-colour cue — a local union, no discussion import */
export type AvatarKind = 'user' | 'ai_agent' | 'system';

/** Deterministic hue palette for initials avatars (stable per actor id) */
const AVATAR_HUES = [210, 145, 275, 25, 340, 190, 95, 305, 55, 165];

export interface AvatarProps {
    /** Actor/participant id — seeds the deterministic background color */
    id: string;
    /** Display name — source of the initials fallback and @ mention token */
    displayName: string;
    /** Actor kind — drives the ring color cue */
    kind: AvatarKind;
    /** Optional image URL; falls back to initials on absence or load error */
    avatarUrl?: string;
    /** Optional contact address — enables the "Mail to" menu action */
    email?: string;
    /** Pixel diameter of the avatar (default 22) */
    size?: number;
    /** false renders a plain image with no popup menu and no focus stop, e.g. in a list row */
    interactive?: boolean;
    /** false drops the kind ring, for places where the actor kind carries no meaning */
    ring?: boolean;
    /** Partial override of the popup menu texts (Czech by default) */
    labels?: Partial<AvatarLabels>;
}

/** Texts of the popup menu; `actions` is the button label, `{name}` is the display name */
export interface AvatarLabels {
    actions: string;
    mailTo: string;
    copyMention: string;
}

const DEFAULT_AVATAR_LABELS: AvatarLabels = {
    actions: '{name} — akce',
    mailTo: '✉️ Napsat e-mail',
    copyMention: '@ Zkopírovat zmínku',
};

/** Pick a stable hue from the id so the same actor always keeps its color */
function hueForId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

/** Derive 1–2 uppercase initials from a display name */
function initialsOf(displayName: string): string {
    const words = displayName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Copy text to the clipboard, tolerating environments without the async API */
function copyToClipboard(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(text);
    }
}

export function Avatar({
    id,
    displayName,
    kind,
    avatarUrl,
    email,
    size = 22,
    interactive = true,
    ring = true,
    labels,
}: AvatarProps): React.ReactElement {
    const text = { ...DEFAULT_AVATAR_LABELS, ...labels };
    // Track image-load failure so a broken avatarUrl gracefully shows initials
    const [imageFailed, setImageFailed] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);
    const menuId = useId();
    const showImage = Boolean(avatarUrl) && !imageFailed;

    // Close the popup on outside click or Escape
    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent): void => {
            if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    const hue = hueForId(id);
    const chipStyle: React.CSSProperties = {
        width: size,
        height: size,
        ...(showImage ? {} : { background: `hsl(${hue} 55% 42%)` }),
    };
    const fontStyle: React.CSSProperties = { fontSize: Math.round(size * 0.42) };
    const chipClass = `avatar${ring ? ` avatar-${kind}` : ''}`;
    const face = showImage ? (
        <img
            className="avatar-img"
            src={avatarUrl}
            alt={interactive ? displayName : ''}
            onError={() => setImageFailed(true)}
        />
    ) : (
        <span className="avatar-initials" style={fontStyle} aria-hidden>
            {initialsOf(displayName)}
        </span>
    );

    if (!interactive) {
        return (
            <span className={`${chipClass} avatar-static`} style={chipStyle} title={displayName} role="img" aria-label={displayName}>
                {face}
            </span>
        );
    }

    return (
        <span className="avatar-wrap" ref={wrapRef}>
            <button
                type="button"
                className={chipClass}
                style={chipStyle}
                title={displayName}
                aria-label={text.actions.replace('{name}', displayName)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
            >
                {face}
            </button>

            {menuOpen && (
                <span className="avatar-menu" role="menu" id={menuId}>
                    <span className="avatar-menu-name">{displayName}</span>
                    {email && (
                        <a
                            className="avatar-menu-item"
                            role="menuitem"
                            href={`mailto:${email}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            {text.mailTo}
                        </a>
                    )}
                    <button
                        type="button"
                        className="avatar-menu-item"
                        role="menuitem"
                        onClick={() => {
                            copyToClipboard(`@${displayName}`);
                            setMenuOpen(false);
                        }}
                    >
                        {text.copyMention}
                    </button>
                </span>
            )}
        </span>
    );
}
