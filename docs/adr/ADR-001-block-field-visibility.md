---
title: ADR-001 - A block shows a default set of its fields, and the rest only in editing
description: Apply when adding a block type to BlockDocument or deciding which of a block's fields the document shows — every type declares a default view, a host and a block can override it, editing shows everything, and the data is complete either way.
category: adr
ai_load: on-demand
status: draft
created: 2026-09-26
related:
  - docs/issues/003-address-block.md
  - src/BlockDocument/
---

# ADR-001: A block shows a default set of its fields, and the rest only in editing

**Status:** Proposed
**Date:** 2026-09-26
**Deciders:** CassandraGargoyle

## Context

The blocks of the first version (INT-001) show everything they hold. A paragraph is its
text, and an image is its picture and its caption. What such a block stores and what the
reader sees are the same thing.

The address block ([INT-003](../issues/003-address-block.md)) breaks that. It holds a
postal address and the GPS coordinates of the place. A reader of the family house
document wants the address. The coordinates are there for whoever edits the document and
for the application that embeds it: to put the house on a map, or to navigate to it. Printed
under the address, they are noise.

The address will not be the only block like this. A contact holds a phone number that one
document shows and another does not, and a device holds a serial number that belongs in an
inventory and not in a manual. So this is a rule for every block type, not a special case
in the address block.

Four questions need an answer:

1. Who decides which fields are shown: the block type, the application or the author of
   the document?
2. What does editing show?
3. Does hiding a field change what can be read or written through the API?
4. How is the choice stored so that a later version of a type, with more fields, does not
   break documents written before it?

## Decision

**Every block type declares its fields and a default view**, meaning the fields the document
shows. The address shows the street, house number, postal code, city and country, and it
does not show `gps`. A type whose fields are all shown still declares them, so that an
override can name them.

**The default can be overridden at two more levels, and the most specific one wins:**

| Level | Where | Scope | Example |
| ----- | ----- | ----- | ------- |
| 1. Type | The component's own code | Every block of the type | `gps` hidden |
| 2. Host | `fieldVisibility` prop of `BlockDocument` | Every block of the type in this view | An inventory app shows `gps` everywhere |
| 3. Block | `visibility` key of the block in the document | This one block | This one address shows its `gps` |

An override is a **map of field names to booleans**, `{ "gps": true, "country": false }`,
never a full list. A field that the map does not name keeps the value from the level below.
A field that a type adds in a later version therefore gets that type's default and does not
silently disappear from documents that overrode something else. A name the type does not
know is ignored and kept.

```json
{
  "id": "house-address",
  "type": "address",
  "street": "Lipová",
  "houseNumber": "12",
  "postalCode": "251 01",
  "city": "Říčany",
  "gps": { "lat": 49.9917, "lon": 14.6543 },
  "visibility": { "country": false }
}
```

```tsx
<BlockDocument document={doc} fieldVisibility={{ address: { gps: true } }} />
```

**Editing shows every field.** A field that is hidden in the document is still an input in
the block's form, marked as *not shown in the document*. Beside each field, the form has
a *Show in document* switch that writes the block's `visibility`, so level 3 can be set
without touching the JSON. The switch starts at the value that the three levels produce.

**Visibility is presentation, not access control.** A hidden field is in the document, is
returned when the document is read, and is written by `updateBlock` like any other field.
The component never drops, masks or strips it. An application that must not disclose the
coordinates removes them from the data before it passes the document on. Hiding them in the
view does not keep them private.

## Consequences

**A block type is described by its fields, not only by its renderer.** Each known type gets
a field list with a default visibility. The renderer asks which fields are visible, and
the editing form asks which ones exist. Adding a field to a type means adding it to that
list, and nothing else has to learn about it.

**The existing types do not change.** Chapter, paragraph, image and video declare their
fields as all visible, so the documents already written look the same. A host may still
hide, for example, the `caption` of every image through level 2.

**The format stays at `schemaVersion` 1.** `visibility` is an optional key on a block. An
older component ignores it, as it ignores every key it does not know, and shows the fields
it shows today. No document becomes invalid.

**A hidden field can surprise its reader.** Somebody who reads the JSON, or a document
exported from it, will find coordinates that the page never showed. That is the price of
the rule above, and the reason the edit form marks every hidden field instead of leaving
it out.

**Where the host and the author disagree, the author wins.** A host that sets
`{ gps: false }` does not hide the coordinates of a block whose author set `{ gps: true }`.
This is the judgement call most open to disagreement. The argument for it is that a block
override is the most specific statement anyone made. The argument against it is that the
application knows its audience. It is acceptable only because visibility is not access
control. A host that must be sure removes the data.

**Rejected: a list of visible fields per block.** `"visible": ["street", "city"]` is simpler
to read, but a block that uses it freezes the set of its fields. A field that the type adds
later is then hidden in every such block without anyone having decided so.

**Rejected: named view profiles** (`"view": "compact"`, `"view": "full"`) defined per type.
They read well, but each new need calls for another profile to be defined in the component,
and a profile still cannot say "this one field, for this one block". A map covers both, and
profiles can be built on top of it later if they are ever needed.

**Rejected: hiding in the data.** The component could leave hidden fields out of what it
hands to `onChange`, or keep them outside the document. The document would then no longer
be a complete description of the block, and an application reading `gps` would depend on
how the block was last shown.
