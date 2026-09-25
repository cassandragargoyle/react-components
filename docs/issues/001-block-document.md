---
title: INT-001 - BlockDocument, a block-based document viewer and editor
description: Apply when working on BlockDocument — the document format, the block types, the editing operations and the family house sample.
category: specification
ai_load: on-demand
status: draft
created: 2026-09-25
related:
  - docs/architecture/GUI-DESIGN-PRINCIPLES.md
  - docs/contributing/CODE-STYLE-TYPESCRIPT.md
---

# INT-001 - BlockDocument, a block-based document viewer and editor

## Metadata

- **Status**: 📋 Open
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-09-25
- **Author**: Zdenek
- **Target**: `src/BlockDocument/` (new component)
- **GitHub**: [#1](https://github.com/cassandragargoyle/react-components/issues/1)
- **Related**:
  - [GUI Design Guidelines](../architecture/GUI-DESIGN-PRINCIPLES.md) — theme, icons,
    interaction states

## Feature Description

A component that shows a document built from **blocks** — the model Notion popularised
("document as blocks"): a chapter, a paragraph, a photo, a video, each one a unit that can
be added, removed, moved and edited on its own. The component renders the whole document as
**one continuous page**, lets the reader play a video in place, and — when the host allows
it — edits the document: the text of a block, and the blocks themselves.

The document is **JSON** in the first version. The format carries a `schemaVersion` so that
it can change later without guessing what an old file meant.

## Use Case

Writing documentation by putting blocks together rather than writing markup: the
description of a family house — its plans, its wiring, the people who live in it — with the
photos and a video walk-through in the same page. The application that embeds the component
owns the file; the component shows it and proposes changes to it.

The family house is also the **sample** the component ships with and the fixture the tests
read, so every block type is exercised by a document that looks like a real one.

## Proposed Solution

### The document format

```json
{
  "schemaVersion": 1,
  "id": "family-house",
  "title": "Family house Novák",
  "blocks": [
    {
      "id": "b1",
      "type": "chapter",
      "title": [{ "text": "Floor plans" }],
      "children": [
        { "id": "b2", "type": "paragraph", "text": [{ "text": "The ground floor has " }, { "text": "three", "bold": true }, { "text": " rooms." }] },
        { "id": "b3", "type": "image", "src": "plans/ground-floor.svg", "alt": "Ground floor plan", "caption": [{ "text": "Ground floor" }] }
      ]
    },
    { "id": "b4", "type": "video", "src": "media/tour.mp4", "poster": "media/tour.jpg", "caption": [{ "text": "Walk-through" }] }
  ]
}
```

Block types in the first version:

| Type | Data | Behaviour |
| ---- | ---- | --------- |
| `chapter` | `title`, `children` | A heading; its level is its nesting depth (`h2`, `h3`, …, capped at `h6`) |
| `paragraph` | `text` | Editable text |
| `image` | `src`, `alt`, `caption?` | `alt` is required |
| `video` | `src`, `poster?`, `caption?` | Native `<video controls>`: play, pause, seek, full screen |

Judgement calls, open to disagreement before they are built:

- **A chapter contains its blocks** (`children`) rather than being a heading in a flat list.
  "Adding text to a chapter" then means adding a child, moving a chapter moves its
  content with it, and the heading level cannot contradict the structure. The cost is a
  tree instead of an array in every editing operation
- **Text is an array of spans** `{ text, bold?, italic?, code?, href? }`, never HTML. Nothing
  from the document reaches `dangerouslySetInnerHTML`, so a document cannot inject markup;
  `href` is limited to `http:`, `https:` and `mailto:`
- **An unknown block type is kept, not dropped.** It renders as a neutral placeholder and
  survives an edit unchanged, so a newer document opened by an older component loses nothing
- **No schema library.** Validation is a hand-written type guard, `isBlockDocument(data)`,
  with a readable error for the first thing that is wrong; the library adds no runtime
  dependency for it

### Editing as functions

Every edit is a pure function from document to document, exported beside the component
and tested without React:

- `insertBlock(doc, block, { parentId?, index })`
- `removeBlock(doc, blockId)`
- `moveBlock(doc, blockId, { parentId?, index })` — also between chapters, never into its
  own subtree
- `updateBlock(doc, blockId, patch)`

The component calls them and hands the result to the host. It keeps no copy of the document
of its own.

### The component

```tsx
<BlockDocument
  document={doc}
  onChange={setDoc}              // absent → read-only
  readOnly={false}
  resolveMediaUrl={(src) => url} // a webview or a server maps the stored path to a URL
/>
```

In edit mode:

- Paragraph text and chapter titles are edited in place, with bold, italic and link
- A handle beside each block opens its menu: insert below, delete, move up, move down; the
  handle also drags the block to a new position, into or out of a chapter
- A `+` between blocks inserts a new block of a chosen type
- Keyboard: `Enter` at the end of a paragraph starts a new one, `Backspace` in an empty
  paragraph removes it, `Alt+↑` / `Alt+↓` moves the focused block. Everything the mouse can
  do, the keyboard can do

Media is never fetched by the component on its own: `src` goes through `resolveMediaUrl`
(identity by default), and nothing is loaded from a CDN.

### The sample

`src/BlockDocument/samples/family-house.json` with its images beside it: an overview, the
floor plans (SVG), the wiring, the residents, and a video walk-through. The video is
referenced, not committed: a repository is no place for a large binary, and the tests do not
play it.

### Out of scope

Each is a later issue if it is wanted:

- Tables, lists, callouts, dividers, code blocks
- Embeds from third-party services (YouTube and the like)
- Uploading media; the host supplies URLs
- Undo and redo — the host owns the document and its history
- Collaborative editing, comments
- Export to HTML, Markdown or PDF
- A slash (`/`) command menu

## Acceptance Criteria

- [ ] `BlockDocument` and its props, the document types, `isBlockDocument` and the four
      editing functions are exported from `src/index.ts`
- [ ] The family house sample renders as one page with chapters, paragraphs, images and a
      video, and passes `isBlockDocument`
- [ ] Chapter headings take their level from nesting depth
- [ ] The video plays in place with the native controls
- [ ] Without `onChange` the document cannot be edited, and no editing affordance is shown
- [ ] With `onChange`, editing text, inserting, deleting and moving blocks (by menu, by drag
      and by keyboard) each call `onChange` once with the whole new document
- [ ] A block can be moved into and out of a chapter; a chapter cannot be moved into itself
- [ ] An unknown block type renders as a placeholder and is preserved through an edit
- [ ] Text never reaches the DOM as HTML; a `javascript:` link is not rendered as a link
- [ ] Images without `alt` fail validation; every control has an accessible name
- [ ] The editing functions have unit tests; the component has tests over the sample
- [ ] Colours, icons and states follow the GUI design guidelines, in a light and a dark theme
- [ ] `src/BlockDocument/README.md` documents the format and shows a usage example
- [ ] `npm run typecheck`, `npm run build` and `npm test` pass
