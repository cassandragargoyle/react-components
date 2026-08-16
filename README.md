# OpenPanel

Pilot's **start screen**. When no project is open, the Electron window loads
`open.html` and this panel is all the user sees: a centred card with **Open
File** / **Open Folder** buttons and a filterable list of **recently opened**
items. Picking anything hands control to the main process, which routes the
item to the right viewer and replaces the renderer — so the panel is a launcher,
never a container.

Added in #014; the missing-path handling came with #102.

![OpenPanel visual reference](./OpenPanel.svg)

## What it is good for

- **The "nothing is open yet" screen** of the Pilot desktop app
- **Reopening recent work** — the list is persisted by the main process across
  restarts and is shared with the File ▸ Open Recent application menu
- **The landing spot after File ▸ Close Project** (`file:close-project` sends
  the window back to `open.html`)

It is **not** a reusable file picker: the component takes no props, reads its
data straight from `window.fileApi`, and its stylesheet is global rather than
scoped. Embedding it inside another screen is not supported — use the IPC
channels directly instead.

## Where it is mounted

```
electron/main.ts        transitionToOpenPanel() → loadFile('renderer/open.html')
renderer/open.html      <div id="root"> + open.js + open.css
pilot/ui/entries/index.open.tsx
                        createRoot(...).render(<AppShell><OpenPanel /></AppShell>)
```

`AppShell` supplies the status bar (connection, git branch, portunix version);
`OpenPanel` fills the area above it. The panel is intentionally *not* exported
from `src/pilot/ui/index.ts` — only the entry point uses it.

## API

The component takes **no props** and exposes no callbacks. Its whole contract is
the `window.fileApi` bridge published by `src/electron/preload.ts`
(declared locally in `OpenPanel.tsx` as a `global` augmentation):

| Call | IPC channel | Handled by |
| ------------------------ | ------------------- | ---------- |
| `openDialog('file' \| 'folder')` | `file:open-dialog` | native `dialog.showOpenDialog`, then `openFileOrFolder()` |
| `getRecentItems()` | `file:get-recent` | replies with `file:recent-items` |
| `openRecent(path)` | `file:open-recent` | existence check, then `openFileOrFolder()` |
| `clearRecent()` | `file:clear-recent` | wipes the store, rebuilds the menu, replies with an empty list |
| `onRecentItems(cb)` | `file:recent-items` | list refresh (push, not request/response) |
| `removeAllListeners()` | — | called on unmount |

`closeProject()` and `onOpenItem()` exist on the same bridge but are used by
other screens, not by this panel.

A recent item as the panel sees it:

```ts
interface RecentItem {
    type: 'file' | 'folder';
    path: string;
    name: string;
    lastOpened: string;
    exists?: boolean;   // runtime annotation from the main process, never persisted
}
```

The persisted shape lives in
[`shared/types/fileTypes.ts`](../../../../shared/types/fileTypes.ts)
(`RecentItem`, `RecentItemView`, `RecentItemsData`); the store itself is
`recent-items.json` in Electron's `userData` directory, deduplicated by absolute
path and capped at 20 entries.

## Behavior

- **Mount** — subscribes to `file:recent-items` and immediately sends
  `file:get-recent`; unmount removes the listeners.
- **Recent block** — rendered only when the store is non-empty. The filter input
  appears only above **3** items, and pressing `/` anywhere in the panel (outside
  an input) focuses it.
- **Filtering** — case-insensitive substring match against `name` **and** `path`.
  No hits with a non-empty filter shows *No matching items*.
- **Stable height** — the list reserves `min(recents, 9) × 34px` computed from
  the **unfiltered** count, so typing does not resize and re-centre the card. The
  list scrolls past `max-height: 320px`.
- **Missing paths (#102)** — an item with `exists === false` renders dimmed and
  `disabled` with a *Not found* badge and a `"<path> (not found)"` tooltip. The
  main process re-checks on open and re-sends the annotated list instead of
  failing silently.
- **Path shortening** — a leading `/home/<user>` or `C:\Users\<user>` is replaced
  by `~` for display; the full path stays in the tooltip and in the IPC payload.
- **Opening** — the panel never learns the outcome. `openFileOrFolder()` records
  the item, updates the window title and menu, and navigates the window to the
  matching viewer: Workflow Canvas, Graph Canvas, GraphLens 3D, Canvas (images),
  Opportunity gallery (`*.discovery`), Venture workspace, Explorer (other
  folders), a viewer plugin claiming the extension, or Pilot Chat as the
  fallback.

## Styling

`open.css` is a **global** stylesheet for the whole open-panel renderer, not a
scoped component file: it styles `body`, `#root`, `.app-shell` and `.status-bar`
alongside the `.open-panel-*` rules, and declares the `--pilot-*` custom
properties (VS Code theme variables with literal dark fallbacks) used across
Pilot. The entry imports it and
[`esbuild.open.mjs`](../../../../electron/esbuild.open.mjs) (`.css` → `css`
loader) emits it as `open.css` next to `open.js`, which is what the `<link>` in
`open.html` picks up — so unlike most Pilot components there is no
inject-into-`document.head` fallback here.

Follows the [GUI Design Principles](../../../../../docs/architecture/GUI-DESIGN-PRINCIPLES.md):
monochrome 16px stroke icons, 4px spacing grid, theme variables with fallbacks,
`:focus-visible` outlines on every interactive element.

## Caveats

- **Electron-only.** Without `window.fileApi` (a browser or a Storybook-style
  harness) every call is a silent no-op and the panel is stuck on the empty
  state — the optional-chaining bridge never reports the missing host.
- **No loading or error state.** Between mount and the first
  `file:recent-items` push the panel shows *No recently opened files or folders*,
  which is indistinguishable from a genuinely empty store.
- **`removeAllListeners()` is global.** It clears *all* `file:open-item` and
  `file:recent-items` listeners on the bridge, not just this component's — fine
  today because the panel owns the whole renderer, but it would break if the
  panel were ever mounted next to another consumer.
- **The `/` shortcut queries the DOM** (`document.querySelector('.open-panel-filter')`)
  instead of using a ref, so it depends on the class name and on a single panel
  being mounted.
- **`shortenPath` is heuristic** — it only recognises `/home/<user>` and
  `C:\Users\<user>`; macOS `/Users/<user>` is left untouched.
- **Not unit-tested.** There is no test file next to the component; the
  behaviour is covered only manually through the Electron app.

## Files

- `OpenPanel.tsx` — the panel: recent-items state, filter, IPC calls, inline icons
- `open.css` — global stylesheet for the open-panel renderer (`--pilot-*`, shell, status bar, `.open-panel-*`)
- `OpenPanel.svg` — visual reference (this README's image)
- `index.ts` — public export (`OpenPanel`)

Related: [`pilot/ui/entries/index.open.tsx`](../../entries/index.open.tsx) (mount),
[`pilot/ui/shell/AppShell.tsx`](../../shell/AppShell.tsx) (status bar wrapper),
[`electron/preload.ts`](../../../../electron/preload.ts) (`window.fileApi`),
[`electron/store/recentItems.ts`](../../../../electron/store/recentItems.ts) (persistence),
[`electron/main.ts`](../../../../electron/main.ts) (`openFileOrFolder`, routing).

---

**Created**: 2026-08-16
**Last Updated**: 2026-08-16
