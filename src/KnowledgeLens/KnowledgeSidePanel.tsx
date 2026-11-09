/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Left panel of KnowledgeLens: classes and predicates that can be shown or hidden,
// attributes chosen as subtitle lines, and the flags with their marker

import React, { type JSX } from 'react';
import type { KnowledgeClassInfo, KnowledgeFlagInfo, KnowledgePredicateInfo } from './types';

interface KnowledgeSidePanelProps {
    classes: KnowledgeClassInfo[];
    predicates: KnowledgePredicateInfo[];
    attributes: KnowledgePredicateInfo[];
    flags: KnowledgeFlagInfo[];
    hiddenClasses: Set<string>;
    hiddenPredicates: Set<string>;
    subtitleAttributes: string[];
    onToggleClass: (iri: string) => void;
    onTogglePredicate: (iri: string) => void;
    onToggleSubtitle: (iri: string) => void;
    /** Short IRI for the tooltip */
    shortIri: (iri: string) => string;
}

/** Colour swatch of a class */
export function ClassSwatch({ fill, border, dashed = false }: { fill: string; border: string; dashed?: boolean }): JSX.Element {
    return (
        <span
            className="knowledge-lens-swatch"
            style={{ background: fill, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid' }}
            aria-hidden="true"
        />
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
    return (
        <section className="knowledge-lens-side-section" aria-label={title}>
            <div className="graph-property-section-title">{title}</div>
            {children}
        </section>
    );
}

export function KnowledgeSidePanel({
    classes,
    predicates,
    attributes,
    flags,
    hiddenClasses,
    hiddenPredicates,
    subtitleAttributes,
    onToggleClass,
    onTogglePredicate,
    onToggleSubtitle,
    shortIri,
}: KnowledgeSidePanelProps): JSX.Element {
    return (
        <aside className="knowledge-lens-side" aria-label="Classes, predicates and attributes">
            <Section title="Classes">
                {classes.map((c) => (
                    <label key={c.iri || 'untyped'} className="knowledge-lens-side-row" title={c.iri ? `${shortIri(c.iri)}${c.label ? ` — ${c.label}` : ''}` : 'Nodes without rdf:type'}>
                        <input type="checkbox" checked={!hiddenClasses.has(c.iri)} onChange={() => onToggleClass(c.iri)} />
                        <ClassSwatch fill={c.style.fill} border={c.style.border} />
                        <span className="knowledge-lens-side-name">{c.name}</span>
                        <span className="knowledge-lens-side-count">{c.count}</span>
                    </label>
                ))}
            </Section>

            {predicates.length > 0 && (
                <Section title="Predicates">
                    {predicates.map((p) => (
                        <label key={p.iri} className="knowledge-lens-side-row" title={shortIri(p.iri)}>
                            <input type="checkbox" checked={!hiddenPredicates.has(p.iri)} onChange={() => onTogglePredicate(p.iri)} />
                            <span className="knowledge-lens-side-name">{p.name}</span>
                            <span className="knowledge-lens-side-count">{p.count}</span>
                        </label>
                    ))}
                </Section>
            )}

            {attributes.length > 0 && (
                <Section title="Attributes">
                    {attributes.map((a) => {
                        const position = subtitleAttributes.indexOf(a.iri);
                        return (
                            <label
                                key={a.iri}
                                className="knowledge-lens-side-row"
                                title={`${shortIri(a.iri)} — show as a line in the box`}
                            >
                                <input type="checkbox" checked={position >= 0} onChange={() => onToggleSubtitle(a.iri)} />
                                <span className="knowledge-lens-side-name">{a.name}</span>
                                <span className="knowledge-lens-side-count">{position >= 0 ? `#${position + 1}` : a.count}</span>
                            </label>
                        );
                    })}
                </Section>
            )}

            {flags.length > 0 && (
                <Section title="Flags">
                    {flags.map((f) => (
                        <div key={f.iri} className="knowledge-lens-side-row" title={shortIri(f.iri)}>
                            <ClassSwatch fill="transparent" border="var(--vscode-descriptionForeground, #858585)" dashed />
                            <span className="knowledge-lens-side-name">{f.name}</span>
                            <span className="knowledge-lens-side-count">{f.count}</span>
                        </div>
                    ))}
                </Section>
            )}
        </aside>
    );
}
