/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Ref labels of a commit row: one chip per branch, remote branch or tag, cut with a +N chip
// The kind sets the outline style; the checked-out branch is bold, remotes dashed, tags marked

import React from 'react';
import type { GitRef } from './types';

/** Chips shown before the rest collapse into +N */
const VISIBLE_REFS = 3;

// Checked-out branch first, then local branches, remotes and tags
const KIND_ORDER: Record<GitRef['kind'], number> = { head: 0, branch: 1, remote: 2, tag: 3 };

const TagGlyph = (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M1,1 L5,1 L9,5 L5,9 L1,5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="3.4" cy="3.4" r="0.9" fill="currentColor" />
    </svg>
);

export interface RefLabelsProps {
    refs: readonly GitRef[];
}

export function RefLabels({ refs }: RefLabelsProps): React.ReactElement | null {
    if (refs.length === 0) return null;
    const sorted = [...refs].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const shown = sorted.slice(0, VISIBLE_REFS);
    const rest = sorted.slice(VISIBLE_REFS);
    return (
        <span className="git-history-refs">
            {shown.map((ref) => (
                <span key={`${ref.kind}:${ref.name}`} className={`git-history-ref is-${ref.kind}`} title={ref.name}>
                    {ref.kind === 'tag' && TagGlyph}
                    {ref.name}
                </span>
            ))}
            {rest.length > 0 && (
                <span className="git-history-ref is-more" title={rest.map((r) => r.name).join('\n')}>
                    +{rest.length}
                </span>
            )}
        </span>
    );
}
