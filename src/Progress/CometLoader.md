# CometLoader

A **busy indicator**: a small comet with a fading tail circles an invisible centre. The path
is a rosette: a main circle that speeds up and slows down, a fast small circle on its end,
and an orbit that breathes between a wide and a tall ellipse. The comet also grows and
shrinks a little, so the motion does not repeat in an obvious way.

It was written for the built-in Markdown viewer of Reco Studio (portunix-reco-studio #111),
where the render of a large document blocks the page for several seconds.

## Usage

```tsx
import { CometLoader } from '@cassandragargoyle/react-components/progress';

function Pane({ text }: { text: string | null }): React.ReactElement {
    if (text === null) return <CometLoader label="Rendering README.md…" />;
    return <Document text={text} />;
}
```

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `label` | `string` | — | Text under the comet; without it the status is named "Loading" for screen readers |
| `size` | `number` | `120` | Width and height of the area of the path, in px; the path scales with it |
| `className` | `string` | — | Added to the root `.comet-loader` element |

## Behavior

- **Moves while the page is blocked** — the comet uses only CSS `transform` animations,
  which the browser runs on the compositor thread. A long synchronous task (a large render,
  a parse) blocks the page, but not the comet.
- **Start the long task one paint later** — the animation has to reach the compositor
  first. Mount the loader, then start the task after `requestAnimationFrame` and a short
  `setTimeout` (about 80 ms). A task started in the same frame blocks the page before the
  comet is on the screen.
- **No state** — the component has no timers and no state; the host mounts and unmounts it.
- **Accessibility** — the root has `role="status"` and `aria-live="polite"`; the drawing is
  `aria-hidden`. With `prefers-reduced-motion: reduce` the comet moves about five times
  slower.

## Styling

The stylesheet is injected once on first use and scoped to `.comet-loader` classes. The root
is a centred column that fills its parent's height (`height: 100%`). The colours come from
custom properties on the root, which a host can override:

| Property | Default |
| -------- | ------- |
| `--comet-loader-color` | `var(--vscode-progressBar-background, #0078d4)` |
| `--comet-loader-glow` | `var(--vscode-textLink-foreground, #4daafc)` |
| `--comet-loader-core` | `var(--vscode-descriptionForeground, #8b8b8b)` |

## Files

- `CometLoader.tsx` — the component and its props
- `CometLoader.css` — scoped stylesheet and the keyframes of the path
- `CometLoader.test.tsx` — unit tests
