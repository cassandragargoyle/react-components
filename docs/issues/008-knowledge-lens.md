---
title: INT-008 - KnowledgeLens, a Turtle (RDF) document as a knowledge graph
description: Apply when working on KnowledgeLens — the projection of triples into a graph, the orthogonal edge router, the saved view layout and the file comments.
category: specification
ai_load: on-demand
status: active
created: 2026-11-09
related:
  - src/KnowledgeLens/
---

# INT-008 - KnowledgeLens, a Turtle (RDF) document as a knowledge graph

## Metadata

- **Status**: 📋 Open
- **Type**: enhancement
- **Created**: 2026-11-09
- **Version**: 0.6.0
- **Author**: Zdenek
- **Target**: `src/KnowledgeLens/`, entry point `./knowledge-lens`
- **GitHub**: [#8](https://github.com/cassandragargoyle/react-components/issues/8)
- **Related**:
  - `portunix-vscode` issue 144 — the full specification, the hosts (VS Code custom editor, Pilot preview and
    window) and the acceptance protocol `docs/testing/acceptance-144.md`, which records the tests of this issue

## Summary

A read-only viewer that shows an RDF document in Turtle syntax as a knowledge graph. It does not draw one node and
one edge per triple: types become the style of a node, literals and links to external vocabularies become its text and
attributes, and vocabulary declarations and dataset metadata are not drawn. It works without configuration.

The specification lives in `portunix-vscode` issue 144, because the hosts and the component were specified together;
this issue records the library half.

## Requirements

- `parseTurtle(text)` over N3.js (`n3`, an optional peer) returns the triples, prefixes and base, or a syntax error
  with line and column; it never throws.
- `projectGraph(triples, options)` is a pure function: rdf:type sets the style (the first non-generic type), title
  predicates give the title in the chosen language, described objects become edges, other IRIs and literals become
  attributes, inverse and symmetric pairs give one edge, boolean `true` predicates mark the node dashed, vocabulary and
  dataset subjects are not drawn, blank nodes nest, and a node limit (2 000) cuts large graphs with a warning.
- The component: toolbar (layout, edge style, language, find, Save), left panel (classes, predicates, box lines,
  flags), Cytoscape viewport, `NodeTablePanel`, property panel with every triple and clickable IRIs, a splitter for
  its width, a header with the document comment, and a legend.
- Orthogonal edges are routed around the boxes they do not connect (`orthogonalRouter.ts`), and edges into one node
  join on a common segment; above 200 visible nodes the plain `taxi` shape is used.
- The view (positions, layout, edge style, filters, box lines, language, panel width, About state) is sent with
  `requestSave` for the host to store; a saved layout is read defensively, so unknown or wrong values fall back to
  the defaults.
- `#` comments of the file, which N3.js drops, are read by `extractComments()`: the document comment and section
  comments with the subjects that follow them.
- The wheel zooms by about ×1.15 per mouse-wheel notch, handled by the component.
- The root entry exports `KnowledgeLens`, `parseTurtle` and `projectGraph`; the subpath `./knowledge-lens` the same.

## Decisions

- **Zero configuration.** No style file: the automatic palette colours the classes. `classStyles` and
  `flagPredicates` exist as options for a later issue.
- **Own router, no new dependency.** `elkjs` was the alternative; the router is small, tested, and enough for
  documents of up to a few hundred nodes.

## Acceptance Criteria

- [ ] `npm run typecheck`, `npm run build`, `npm test` and `npm run test:entries` pass in a clone of this repository
- [ ] `./knowledge-lens` loads only `n3`, `cytoscape`, `cytoscape-dagre` and AG Grid
- [ ] The acceptance criteria of `portunix-vscode` issue 144 pass (its protocol, round 2 and later)
