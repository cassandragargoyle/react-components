---
title: INT-004 - BlockDocument, localization of its texts by the document language
description: Apply when working on the language of BlockDocument — the document `language`, the `locale` and `messages` props, the built-in dictionaries, or any text the component renders.
category: specification
ai_load: on-demand
status: draft
created: 2026-09-27
related:
  - docs/issues/done/001-block-document.md
  - docs/issues/done/003-address-block.md
  - src/BlockDocument/
---

# INT-004 - BlockDocument, localization of its texts by the document language

## Metadata

- **Status**: 📋 Open
- **Type**: enhancement
- **Priority**: medium
- **Created**: 2026-09-27
- **Author**: Zdenek
- **Target**: `src/BlockDocument/`
- **GitHub**: [#4](https://github.com/cassandragargoyle/react-components/issues/4)
- **Related**:
  - [INT-001 — BlockDocument](done/001-block-document.md) — the format that gains
    `language`
  - [INT-003 — The address block](done/003-address-block.md) — the field labels this issue
    makes translatable
  - [GUI Design Guidelines](../architecture/GUI-DESIGN-PRINCIPLES.md) — accessibility of
    the translated labels

## Feature Description

Every text that `BlockDocument` renders is written in English in the source today. This
includes the field labels (`ADDRESS_FIELD_LABELS` in `address.ts`, `FIELD_LABELS` in
`fields.ts`), the menus (*Insert paragraph*, *Move up*, *Delete*), the forms and their
errors, the display settings, the placeholders and every `aria-label`. A Czech document
therefore reads *Street*, *Postal code* and *Not shown in the document* to its Czech
reader, and so does its screen reader.

This issue gives the document a language and translates the component's texts by it. The
library ships English and Czech, and a host can supply any other language, or reword single
texts, without a release of the library.

## Use Case

The family house document is written in Czech. Its author edits it in Czech, and the
labels of the address form, the display settings and the block menu should be Czech too.
A screen reader should announce *Ulice* in a Czech voice, not *Street*.

The same component is embedded in an application whose user interface is English. That
application wants its own language for the editing tools, whatever the document is
written in. A third application needs German, which the library does not ship.

## Proposed Solution

### Where the language comes from

1. The prop `locale?: string` on `BlockDocument`, a BCP 47 tag, set by the host
2. Otherwise `language?: string` in `BlockDocumentData`, the language the document is
   written in, which travels with the document
3. Otherwise `en`

The resolved tag is matched against the dictionaries: first exactly (`cs-CZ`), then by its
primary subtag (`cs`), and then it falls back to `en`. An unknown language never breaks
rendering.

`language` is also written as the `lang` attribute of the `<article>`, so that the browser
and assistive technology read the content in the right language. It takes the document
`language`, not the `locale`, because it describes the content, not the tools.

### The dictionary

- A typed `BlockDocumentMessages` holds every text of the component. A text with a variable
  part is a function, for example `insertBlock: (what: string) => string` or
  `actionsFor: (block: string) => string`, because word order differs between languages
  and cannot be built by concatenating English fragments
- The field labels are in it, per block type and field:
  `fields.address.street`, `fields.image.caption`. `declaredFields` and the address form
  read them from there instead of the constants
- `en` and `cs` are built in. Both are complete, and the type checks that `cs` has every
  key that `en` has
- The prop `messages?: Partial<BlockDocumentMessages>` is laid over the dictionary of the
  resolved language, so that a host can reword a single text. Passed complete together
  with `locale="de"`, it adds a language the library does not ship
- The dictionaries are exported (`blockDocumentMessages.en`, `blockDocumentMessages.cs`),
  so that a host can start its own from one of them
- The resolved dictionary is provided through a React context, the same way the field
  visibility is. No component below `BlockDocument` holds an English literal any more

### What is not translated

Judgement calls, open to disagreement before they are built:

- **One language for all the texts.** The tools and the field labels follow the same
  resolved language. Splitting them into two settings would give a host two knobs for a
  distinction almost no one needs. `lang` on the `<article>` remains the one place where
  the content language is kept apart
- **The data stays as it is.** Field names in the JSON (`street`, `gps`), the block types
  and the document content are never translated
- **The Czech address prefixes `č.p.` and `č.ev.` stay** in every language. They are part
  of how a Czech address is written, as decree 359/2011 Sb. prescribes, not text of the
  component. The same holds for the `RÚIAN` prefix
- **Numbers keep their format.** `gps` is shown as `49.9917, 14.6543` in every language,
  because a decimal comma would clash with the comma between the coordinates. The form
  already accepts a decimal comma as input
- **`validateBlockDocument` messages stay in English.** They are for the developer who
  loads a document, not for the reader, and a stable English message is easier to search
  for
- **`language` is optional, and `schemaVersion` stays at 1.** An older component ignores
  the key and keeps it, and a document without it renders as it does today

### The data

- `BlockDocumentData` gains `language?: string`
- `validateBlockDocument` rejects a `language` that is not a non-empty string, with the
  path to it. The tag is not checked against a list of languages
- `BlockDocumentMessages` and `blockDocumentMessages` are exported from `src/index.ts`

### Sample, demo and documentation

- The family house sample stays without `language`: its content is English, and `"cs"`
  would make a screen reader read it as Czech. A Czech sample of the same house,
  `rodinny-dum.blockdocument.json` with `"language": "cs"` and the same block ids, sits beside
  it, and the demo switches between them. Changed from the first proposal of
  `"language": "cs"` on the English sample
- The demo gets two choices, so that all three levels of the resolution can be tried: the
  document `language` (*Not set*, *English*, *Czech*), and the host's `locale` (*Document
  language*, *English*, *Czech*)
- `src/BlockDocument/README.md` documents `language`, `locale` and `messages`, the
  resolution order, and how to add a language

## Acceptance Criteria

- [ ] A document with `"language": "cs"` renders every text of the component in Czech: the
      field labels, the menus, the forms, their errors, the display settings, the
      placeholders and every `aria-label`
- [ ] `locale="en"` on a Czech document renders the texts in English, and the `<article>`
      keeps `lang="cs"`
- [ ] Without `language` and `locale`, the component renders exactly as before (the
      existing tests pass unchanged)
- [ ] `cs-CZ` resolves to `cs`, and an unknown tag such as `xx` falls back to `en` without
      an error
- [ ] `messages` overrides a single text of the resolved language, and a complete
      `messages` with `locale="de"` renders German
- [ ] The Czech dictionary is complete, which the type check enforces, and no English
      literal is left in the components under `src/BlockDocument/` (a test checks the
      Czech rendering of each form, the block menu and the display settings)
- [ ] The address keeps `č.p.`, `č.ev.` and `RÚIAN` and the `gps` format in every language
- [ ] `validateBlockDocument` rejects a `language` that is not a non-empty string, with the
      path to it
- [ ] `BlockDocumentMessages` and `blockDocumentMessages` are exported from `src/index.ts`
- [ ] A Czech sample has `"language": "cs"`, and the demo switches the sample, the document
      `language` and the locale
- [ ] `README.md` documents `language`, `locale`, `messages` and adding a language
- [ ] `npm run typecheck`, `npm run build` and `npm test` pass
