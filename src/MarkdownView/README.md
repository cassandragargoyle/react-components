# MarkdownView

A **read-only Markdown document**: a GitHub-flavoured Markdown string rendered as headings,
lists, tables, task lists, links, images and code blocks, in a scroll container that follows
the VS Code theme.

The view is host-neutral. It renders a **string**, not a file: the host reads the text and
passes it in, and decides what a link or a relative image path means. That makes it usable
for a `.md` file in a preview pane as well as for a chat message or a README card. It was
written for Pilot, the `portunix-vscode` desktop app (#124), where a thin wrapper binds the
links to the file pane and the operating system browser.

## Usage

```tsx
import { MarkdownView } from '@cassandragargoyle/react-components/markdown-view';

function ReadmePane({ text, host }: { text: string; host: MyHost }): React.ReactElement {
    return (
        <MarkdownView
            source={text}
            onLinkClick={href => host.open(href)}
            resolveImage={src => host.imageUrl(src)}
        />
    );
}
```

`react-markdown` and `remark-gfm` are optional peers of the library; install them in the
host that uses this component.

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `source` | `string` | — | The Markdown text |
| `onLinkClick` | `(href) => void` | — | A click on any link except an in-document `#anchor`; without it a link does nothing |
| `resolveImage` | `(src) => string` | — | Maps an image `src` as written to a URL the host can load; without it the `src` is used as is |
| `renderCode` | `(code, language) => ReactNode \| undefined` | — | Renders a fenced code block; `undefined` keeps the default `<pre>` |
| `className` | `string` | — | Added to the root `.markdown-view` element |

`slugify` is exported too: the GitHub-style heading slug the view uses for heading ids, for a
host that builds a table of contents or links into a heading.

## Behavior

- **Dialect** — CommonMark plus GitHub extensions (`remark-gfm`): tables, task lists,
  strikethrough and autolinks. Task list checkboxes are shown, never editable.
- **Raw HTML** — embedded HTML is **skipped**, not rendered, so the view needs no sanitizer.
  A `javascript:` link target is dropped by `react-markdown`.
- **Links** — the view never navigates. An `#anchor` link scrolls to the heading with that
  id; every other link calls `onLinkClick` with its `href` exactly as written, relative or
  absolute, and the host decides.
- **Heading ids** — every heading gets a GitHub-style id (`## Open questions` →
  `open-questions`, a repeat gets `-1`, `-2`), so links written for GitHub work here.
- **Code** — fenced blocks render as plain `<pre><code>` with the fence language as a
  `language-xxx` class. Syntax highlighting is the host's choice through `renderCode`.

## Styling

The stylesheet is injected once on first use and scoped to `.markdown-view` classes; it does
not touch `body` or any page layout. The root fills its parent's height (`height: 100%`) and
scrolls, so give the parent a height. The text sits in a centred column of at most 880px.
Colours read the VS Code theme variables (`--vscode-editor-*`, `--vscode-textLink-*`,
`--vscode-textCodeBlock-background`, `--vscode-textBlockQuote-border`,
`--vscode-panel-border`, …) with dark-theme fallbacks, and links have a `:focus-visible`
outline.

## Files

- `MarkdownView.tsx` — the component, its props and the heading slug
- `MarkdownView.css` — scoped stylesheet
- `MarkdownView.test.tsx` — unit tests
- `index.ts` — public exports

---

**Created**: 2026-10-17
**Last Updated**: 2026-10-17
