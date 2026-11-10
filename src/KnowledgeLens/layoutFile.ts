/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Reads a saved view layout defensively: values a version does not know, or of the wrong
// type (a hand edit, a newer version), are dropped so the defaults apply instead

import type { KnowledgeEdgeStyle, KnowledgeLayoutAlgorithm, KnowledgeLensLayout } from './types';

const LAYOUTS: readonly KnowledgeLayoutAlgorithm[] = ['dagre', 'cose', 'breadthfirst'];
const EDGE_STYLES: readonly KnowledgeEdgeStyle[] = ['orthogonal', 'straight', 'curved'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);

/** The usable part of a saved layout, or null when nothing in it is usable */
export function normalizeLayout(raw: unknown): KnowledgeLensLayout | null {
    if (!isRecord(raw)) return null;
    const layout: KnowledgeLensLayout = { version: 1 };
    if (LAYOUTS.includes(raw.layout as KnowledgeLayoutAlgorithm)) layout.layout = raw.layout as KnowledgeLayoutAlgorithm;
    if (EDGE_STYLES.includes(raw.edgeStyle as KnowledgeEdgeStyle)) layout.edgeStyle = raw.edgeStyle as KnowledgeEdgeStyle;
    if (typeof raw.propertyPanelWidth === 'number' && Number.isFinite(raw.propertyPanelWidth)) layout.propertyPanelWidth = raw.propertyPanelWidth;
    if (typeof raw.aboutOpen === 'boolean') layout.aboutOpen = raw.aboutOpen;
    if (typeof raw.language === 'string') layout.language = raw.language;
    const hiddenClasses = strings(raw.hiddenClasses);
    if (hiddenClasses) layout.hiddenClasses = hiddenClasses;
    const hiddenPredicates = strings(raw.hiddenPredicates);
    if (hiddenPredicates) layout.hiddenPredicates = hiddenPredicates;
    const subtitles = strings(raw.subtitleAttributes);
    if (subtitles) layout.subtitleAttributes = subtitles;
    if (isRecord(raw.positions)) {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const [id, p] of Object.entries(raw.positions)) {
            if (isRecord(p) && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                positions[id] = { x: p.x, y: p.y };
            }
        }
        layout.positions = positions;
    }
    return layout;
}
