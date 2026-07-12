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
}

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
}: AvatarProps): React.ReactElement {
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

    return (
        <span className="avatar-wrap" ref={wrapRef}>
            <button
                type="button"
                className={`avatar avatar-${kind}`}
                style={chipStyle}
                title={displayName}
                aria-label={`${displayName} — akce`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
            >
                {showImage ? (
                    <img
                        className="avatar-img"
                        src={avatarUrl}
                        alt={displayName}
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <span className="avatar-initials" style={fontStyle} aria-hidden>
                        {initialsOf(displayName)}
                    </span>
                )}
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
                            ✉️ Napsat e-mail
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
                        @ Zkopírovat zmínku
                    </button>
                </span>
            )}
        </span>
    );
}
