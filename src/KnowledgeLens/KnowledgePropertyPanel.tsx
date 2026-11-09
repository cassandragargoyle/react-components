/*
 *  SPDX-License-Identifier: MIT
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Right panel of KnowledgeLens: every triple of the selected node grouped by predicate,
// literals with language and datatype, clickable IRIs, and the incoming and outgoing edges

import React, { type JSX } from 'react';
import { ClassSwatch } from './KnowledgeSidePanel';
import type { TurtleSection } from './extractComments';
import type {
    KnowledgeAttribute,
    KnowledgeClassInfo,
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeValue,
} from './types';

const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

interface KnowledgePropertyPanelProps {
    node: KnowledgeNode | null;
    edge: KnowledgeEdge | null;
    nodesById: Map<string, KnowledgeNode>;
    classesByIri: Map<string, KnowledgeClassInfo>;
    edges: KnowledgeEdge[];
    shortIri: (iri: string) => string;
    onSelectNode: (id: string) => void;
    onOpenExternal: (iri: string) => void;
    /** Panel width in pixels, set by the splitter */
    width: number;
    /** Section comment of the file the selected node is written under */
    section?: TurtleSection | null;
}

/** Section comment: the first line as a title, the rest collapsed */
function SectionComment({ section }: { section: TurtleSection }): JSX.Element {
    const [title, ...rest] = section.text.split('\n');
    const body = rest.join('\n').trim();
    return (
        <div className="graph-property-section">
            <div className="graph-property-section-title">Section</div>
            {body ? (
                <details className="knowledge-lens-section-comment">
                    <summary>{title}</summary>
                    <pre>{body}</pre>
                </details>
            ) : (
                <div className="knowledge-lens-section-comment">{title}</div>
            )}
        </div>
    );
}

/** Link to an IRI: selects the node when it is drawn, else asks the host to open it */
function IriLink({
    iri,
    label,
    nodeId,
    onSelectNode,
    onOpenExternal,
}: {
    iri: string;
    label: string;
    nodeId: string | null;
    onSelectNode: (id: string) => void;
    onOpenExternal: (iri: string) => void;
}): JSX.Element {
    const internal = nodeId !== null;
    return (
        <button
            type="button"
            className={`knowledge-lens-link${internal ? ' knowledge-lens-link-node' : ''}`}
            title={internal ? `Select ${iri}` : `Open ${iri}`}
            onClick={() => (internal ? onSelectNode(nodeId) : onOpenExternal(iri))}
        >
            {label}
            {!internal && <span className="knowledge-lens-link-external" aria-hidden="true"> ↗</span>}
        </button>
    );
}

function Value({
    value,
    shortIri,
    nodesById,
    onSelectNode,
    onOpenExternal,
}: {
    value: KnowledgeValue;
    shortIri: (iri: string) => string;
    nodesById: Map<string, KnowledgeNode>;
    onSelectNode: (id: string) => void;
    onOpenExternal: (iri: string) => void;
}): JSX.Element {
    switch (value.kind) {
        case 'literal': {
            const showType = value.datatype && value.datatype !== RDF_LANG_STRING && value.datatype !== XSD_STRING;
            return (
                <span className="knowledge-lens-literal">
                    {value.value}
                    {value.language && <span className="knowledge-lens-tag">@{value.language}</span>}
                    {showType && <span className="knowledge-lens-tag">^^{shortIri(value.datatype)}</span>}
                </span>
            );
        }
        case 'iri': {
            const node = value.nodeId ? nodesById.get(value.nodeId) : undefined;
            return (
                <IriLink
                    iri={value.iri}
                    label={node ? node.title : value.short}
                    nodeId={value.nodeId}
                    onSelectNode={onSelectNode}
                    onOpenExternal={onOpenExternal}
                />
            );
        }
        case 'blank':
            return (
                <div className="knowledge-lens-blank">
                    <Attributes
                        attributes={value.attributes}
                        shortIri={shortIri}
                        nodesById={nodesById}
                        onSelectNode={onSelectNode}
                        onOpenExternal={onOpenExternal}
                    />
                </div>
            );
    }
}

function Attributes({
    attributes,
    ...rest
}: {
    attributes: KnowledgeAttribute[];
    shortIri: (iri: string) => string;
    nodesById: Map<string, KnowledgeNode>;
    onSelectNode: (id: string) => void;
    onOpenExternal: (iri: string) => void;
}): JSX.Element {
    return (
        <>
            {attributes.map((a) => (
                <div key={a.predicate} className="knowledge-lens-attr">
                    <div className="graph-property-key" title={rest.shortIri(a.predicate)}>{a.name}</div>
                    {a.values.map((v, i) => (
                        <div key={i} className="knowledge-lens-attr-value">
                            <Value value={v} {...rest} />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

/** Edges of one direction grouped by predicate label */
function EdgeGroup({
    title,
    arrow,
    edges,
    otherEnd,
    nodesById,
    onSelectNode,
}: {
    title: string;
    arrow: string;
    edges: KnowledgeEdge[];
    otherEnd: (e: KnowledgeEdge) => string;
    nodesById: Map<string, KnowledgeNode>;
    onSelectNode: (id: string) => void;
}): JSX.Element | null {
    if (edges.length === 0) return null;
    const groups = new Map<string, KnowledgeEdge[]>();
    for (const e of edges) groups.set(e.label, [...(groups.get(e.label) ?? []), e]);
    return (
        <div className="graph-property-section">
            <div className="graph-property-section-title">{title}</div>
            {[...groups.entries()].map(([label, list]) => (
                <div key={label} className="knowledge-lens-attr">
                    <div className="graph-property-key">{label}</div>
                    {list.map((e) => {
                        const id = otherEnd(e);
                        return (
                            <button key={e.id} type="button" className="graph-property-connection knowledge-lens-connection" onClick={() => onSelectNode(id)}>
                                <span className="graph-property-connection-arrow">{arrow}</span>
                                {nodesById.get(id)?.title ?? id}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function KnowledgePropertyPanel({
    node,
    edge,
    nodesById,
    classesByIri,
    edges,
    shortIri,
    onSelectNode,
    onOpenExternal,
    width,
    section,
}: KnowledgePropertyPanelProps): JSX.Element {
    const panelStyle: React.CSSProperties = { width, flex: `0 0 ${width}px` };
    if (edge && !node) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        return (
            <aside className="graph-property-panel knowledge-lens-properties" aria-label="Properties" style={panelStyle}>
                <div className="graph-property-header">{edge.label}</div>
                <div className="graph-property-section">
                    <div className="knowledge-lens-attr">
                        <div className="graph-property-key">Predicate</div>
                        <IriLink iri={edge.predicate} label={shortIri(edge.predicate)} nodeId={null} onSelectNode={onSelectNode} onOpenExternal={onOpenExternal} />
                    </div>
                    <div className="knowledge-lens-attr">
                        <div className="graph-property-key">Source</div>
                        <IriLink iri={edge.source} label={source?.title ?? edge.source} nodeId={edge.source} onSelectNode={onSelectNode} onOpenExternal={onOpenExternal} />
                    </div>
                    <div className="knowledge-lens-attr">
                        <div className="graph-property-key">Target</div>
                        <IriLink iri={edge.target} label={target?.title ?? edge.target} nodeId={edge.target} onSelectNode={onSelectNode} onOpenExternal={onOpenExternal} />
                    </div>
                </div>
            </aside>
        );
    }

    if (!node) {
        return (
            <aside className="graph-property-panel knowledge-lens-properties" aria-label="Properties" style={panelStyle}>
                <div className="graph-property-panel-empty">Click a node or edge to view its triples</div>
            </aside>
        );
    }

    const cls = classesByIri.get(node.classIri);
    const outgoing = edges.filter((e) => e.source === node.id);
    const incoming = edges.filter((e) => e.target === node.id);
    return (
        <aside className="graph-property-panel knowledge-lens-properties" aria-label="Properties" style={panelStyle}>
            <div className="graph-property-header">
                {cls && <ClassSwatch fill={cls.style.fill} border={cls.style.border} dashed={node.flags.length > 0} />}
                <span className="knowledge-lens-properties-title">{node.title}</span>
            </div>
            <div className="graph-property-section">
                <div className="knowledge-lens-attr">
                    <div className="graph-property-key">IRI</div>
                    <IriLink iri={node.id} label={node.short} nodeId={null} onSelectNode={onSelectNode} onOpenExternal={onOpenExternal} />
                </div>
                {node.types.length > 0 && (
                    <div className="knowledge-lens-attr">
                        <div className="graph-property-key">Type</div>
                        {node.types.map((t) => (
                            <div key={t} className="knowledge-lens-attr-value">
                                <IriLink iri={t} label={shortIri(t)} nodeId={null} onSelectNode={onSelectNode} onOpenExternal={onOpenExternal} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {section && <SectionComment section={section} />}
            {node.attributes.length > 0 && (
                <div className="graph-property-section">
                    <div className="graph-property-section-title">Attributes</div>
                    <Attributes
                        attributes={node.attributes}
                        shortIri={shortIri}
                        nodesById={nodesById}
                        onSelectNode={onSelectNode}
                        onOpenExternal={onOpenExternal}
                    />
                </div>
            )}
            <EdgeGroup title="Outgoing" arrow="→" edges={outgoing} otherEnd={(e) => e.target} nodesById={nodesById} onSelectNode={onSelectNode} />
            <EdgeGroup title="Incoming" arrow="←" edges={incoming} otherEnd={(e) => e.source} nodesById={nodesById} onSelectNode={onSelectNode} />
        </aside>
    );
}
