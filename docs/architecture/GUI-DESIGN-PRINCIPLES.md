---
title: GUI Design Guidelines
description: Apply when adding or changing anything a component shows — colours, icons, spacing, interaction states and accessibility.
category: style-guide
ai_load: on-demand
status: draft
created: 2026-09-25
last_updated: 2026-09-25
---

# GUI Design Guidelines

This document defines the visual conventions every component in this library follows. The
components are embedded in applications we do not control — a Visual Studio Code webview, a
browser page, an Electron window — so they must look at home in each without knowing which
one they are in.

The stylesheets are the source of truth. Where this document and the code disagree, the code
is right and this document is stale.

## Colours Come From the Host Theme

- Every colour is a custom property whose value falls back through the Visual Studio Code
  theme variable to a literal default, for example
  `var(--vscode-editor-background, #1e1e1e)`. A webview gets the user's theme for free;
  any other host gets the defaults, or overrides the properties
- No hex value inside a rule without a `var(--…)` in front of it
- **Light and dark both work.** A new colour is checked in a light and a dark theme before
  it is merged

## Nothing Is Fetched

Consumers run behind content security policies and offline. So:

- No icon package, no web font, no stylesheet or script from a CDN
- Icons are inline SVG in the component that uses them
- Images are imported through the bundler

## Icons

- Monochrome and stroke-based: `fill="none"`, `stroke="currentColor"`
- `stroke-width="1.5"` on a `0 0 20 20` viewBox, rounded caps and joins
- `aria-hidden="true"` and `focusable="false"`; the accessible name comes from a label
- No coloured emoji, no icon fonts, no sprite sheets

## Layout

- A 4px grid: 4, 8, 12, 16, 24 for padding and margins
- Interface text is 13px (the Visual Studio Code default), labels 12px, hints 11px
- A component works at half a screen's width, which is what an editor webview usually is

## Interaction States

| State | Visual |
| ----- | ------ |
| Hover | `--vscode-list-hoverBackground` |
| Selected | `--vscode-focusBorder` outline |
| Disabled | 50% opacity, `cursor: default` |
| Focus-visible | 2px focus outline |

A control that carries a state says so with `aria-pressed`, `aria-selected` or
`aria-expanded`, and the stylesheet hangs the appearance off that attribute.

## Checklist for New Components

- [ ] Nothing is fetched at runtime: no package, no font, no CDN
- [ ] Icons are inline, monochrome, `stroke="currentColor"`, `aria-hidden`
- [ ] Colours come from properties that fall back through `--vscode-*`
- [ ] Checked in a light and a dark theme
- [ ] Hover, selected, disabled and focus-visible are all defined
- [ ] Keyboard navigation works, and every control has an accessible name
- [ ] Spacing is on the 4px grid
- [ ] It works at half a screen's width
