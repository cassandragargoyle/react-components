# CodeEditor

Reusable code/text editing surface backed by [`monaco-editor`](https://microsoft.github.io/monaco-editor/)
(the editor that powers VS Code). This is the standard component for
syntax-highlighted code display and editing across the Pilot UI component
library — new consumers (in-app JSON config editing, Explorer file preview,
etc.) should adopt `CodeEditor` rather than hand-rolling `<pre>` blocks or a
different editor. Current adopters: `CodeBlock.tsx` (chat code blocks) and
the Electron Explorer's file preview pane (`index.explorer.electron.tsx`).

## Usage

```tsx
import { CodeEditor } from '@cassandragargoyle/pilot-ui';

// Read-only display (e.g. a chat code block) — grows to fit its content
<CodeEditor value={code} language="python" readOnly maxHeight={400} />

// Editable, language inferred from a filename instead of an explicit id
<CodeEditor value={json} filename="canvas.json" onChange={setJson} />

// Full-pane file preview — fills its parent container, scrolls internally
<CodeEditor value={text} filename={path} readOnly autoHeight={false} />
```

`language` accepts either a Monaco language id or a common markdown fence
identifier (`py`, `ts`, `sh`, `yml`, ...) — see `languageMap.ts` for the
mapping. If `language` is omitted, pass `filename` to infer it from the
extension instead.

By default (`autoHeight: true`) the editor grows to fit its content, capped
at `maxHeight` if given (used for chat code blocks — a fixed viewport would
either clip short snippets or add pointless scrollbars). Set
`autoHeight={false}` for a full-pane editor that should fill its parent's
height and let Monaco scroll internally instead (e.g. a file preview pane);
the parent must give the container an explicit height (flex `1 1 0` with
`min-height: 0`, as `.explorer-editor-body` does).

## Fallback behavior

Monaco is a **progressive enhancement**, not a hard dependency of the render
path. If the Monaco bundle fails to load or `monaco.editor.create` throws
(unsupported/untested platform, e.g. a mobile webview), `CodeEditor` catches
the failure and falls back to the original plain `<pre><code>` rendering —
the surrounding UI never breaks or shows a blank component.

## Why a separate lazy-loaded bundle

`monaco-editor` is large (multiple MB) compared to the rest of the Pilot Chat
bundle (`pilot.js` is ~280KB unminified before this change). Inlining it into
`pilot.js` would make every screen that never shows a code block pay that
cost on load. Instead:

- `CodeEditor.tsx` (in the main app bundle) never imports `monaco-editor`
  directly. It knows nothing about Monaco's API.
- `monacoLoader.ts` — the only file that imports `monaco-editor` — is built as
  its own IIFE bundle, `code-editor.js` (see `esbuild.code-editor.mjs`), and
  registers a small imperative API on `window.__portunixCodeEditor`.
- On first mount, `CodeEditor.tsx` injects a `<script src="code-editor.js">`
  tag at runtime, waits for it to load, then calls
  `window.__portunixCodeEditor.mount(container, options)`. Later `CodeEditor`
  instances reuse the already-loaded bundle.

This keeps Monaco fully out of the initial `pilot.js` parse/execute cost for
any session that never renders a code block, while still shipping a single
extra self-contained file with no CDN requests.

### Measured impact (vscode-extension build)

| Artifact | Size | Loaded when |
| -------- | ---- | ----------- |
| `pilot.js` | 281.8KB → 288.2KB (+6.4KB) | Always (chat webview boot) |
| `code-editor.js` (minified) | 4.1MB | First time any `CodeEditor` mounts |
| `code-editor.css` | 139KB | Same as above |
| `workers/editor.worker.js` (minified) | 277KB | Lazily, on first worker request |
| `workers/json.worker.js` (minified) | 404KB | Lazily, only for JSON-editing consumers |

`pilot.js` only grew by the size of `CodeEditor.tsx` + `languageMap.ts` +
their CSS — `monaco-editor` itself never appears in it (verified: `pilot.js`
contains zero occurrences of the `MonacoEnvironment` string that
`monaco-editor` always defines). Since esbuild bundles to a single IIFE file
per app (no ESM code-splitting), `code-editor.js` cannot be split further
without changing that build format project-wide — see the note below.

Note: `pilot.js` itself is not minified in this project's existing esbuild
configs; `code-editor.js` and its workers are minified specifically here
given their size, which is a deliberate deviation for this bundle only.

## Worker loading

Monaco's Monarch tokenizer (syntax highlighting) runs on the main thread and
needs **no worker** — this covers `CodeEditor`'s read-only use in
`CodeBlock.tsx` and any future read-only file preview. A web worker is only
required for richer language services (diagnostics, formatting); today that
is only wired up for **JSON** (`json.worker.js`), since in-app editing of
`*.json` config files is the only concrete editable consumer on the roadmap.
Add more entries to `WORKER_FILE_BY_LABEL` in `monacoLoader.ts` and to
`esbuild.code-editor.mjs`'s worker entry points if a future consumer needs
TypeScript/CSS/HTML language services.

Worker resolution goes through `self.MonacoEnvironment.getWorker` (not the
simpler `getWorkerUrl` hook — see below), backed by a `workerBaseUrl` the host
page controls — no path in this component is hardcoded to a runtime:

| Runtime | `workerBaseUrl` source |
| ------- | ---------------------- |
| VS Code webview | `window.__portunixCodeEditorBaseUrl__` set by the extension host to `webview.asWebviewUri(.../dist/pilot/code-editor)` before `pilot.js` loads (see `PilotChatProvider.ts`) |
| Electron / standalone bundle | Defaults to the relative path `./code-editor` next to the main bundle — place the `code-editor/` build output alongside the entry's output file |

No `monaco-editor` asset is ever fetched from a CDN.

### Why `getWorker`, not `getWorkerUrl` (a same-origin gotcha)

Monaco's `MonacoEnvironment` supports two hooks: `getWorkerUrl` (return a URL,
Monaco calls `new Worker(url, { type: 'module' })` with it directly) and
`getWorker` (return a `Worker` — or `Promise<Worker>` — yourself). Monaco's
own `getWorkerUrl` call site
(`monaco-editor/esm/vs/base/browser/webWorkerFactory.js`) is **not** wrapped
in a try/catch, so if `new Worker(url)` throws, that exception propagates all
the way up through `monaco.editor.create()` — Monaco does not gracefully
degrade in that path.

A classic (or module) `Worker` script must be **same-origin** with the
document that constructs it. In a VS Code webview, resources resolved via
`asWebviewUri()` are not guaranteed to share the webview document's own
origin, so handing that URL straight to `new Worker()` (the `getWorkerUrl`
path) can throw a `SecurityError` synchronously — which, per the paragraph
above, would crash editor creation instead of falling back gracefully.

`monacoLoader.ts` therefore implements `getWorker` instead: it `fetch()`es
the worker script's source (an ordinary same-origin-safe request, since the
resource itself is legitimately readable) and constructs the `Worker` from a
`blob:` URL, which is always same-origin regardless of where the underlying
script came from. A failure here (fetch error, bad URL) rejects the returned
`Promise<Worker>` — which Monaco handles as a non-fatal, degraded worker
service — rather than throwing synchronously.

## Wired-up hosts

`App.tsx` (the shared Pilot Chat root) is rendered both by the VS Code
webview (`ui/index.tsx`) and by the Electron `ExplorerWorkspace`
(`ui/index.explorer.electron.tsx`, the chat pane of the three-pane Explorer
workspace) — so any host that renders `App` picks up `CodeEditor` (and its
preflight check) automatically. Both currently have their own
`esbuild.code-editor.mjs` producing a `code-editor/` folder next to that
host's main bundle:

| Host | `code-editor/` build script | Output location |
| ---- | ---------------------------- | ---------------- |
| VS Code webview | `src/vscode-extension/esbuild.code-editor.mjs` | `dist/pilot/code-editor/` |
| Electron (`ExplorerWorkspace`) | `src/electron/esbuild.code-editor.mjs` | `dist/electron/renderer/code-editor/` |

## Adopting this component in a further host (a new standalone bundle)

1. Add `monaco-editor` to that host package's `dependencies` (see
   `src/vscode-extension/package.json` for the pinned version).
2. Add an esbuild step that runs the same pattern as the two configs above
   (bundle `monacoLoader.ts` + the worker entry points to a `code-editor/`
   folder next to the host's main output file).
3. If the host serves resources through a custom scheme (like VS Code's
   `asWebviewUri`), set `window.__portunixCodeEditorBaseUrl__` before the app
   mounts. Otherwise the default relative path (`./code-editor` next to the
   main bundle) is used, as Electron does.

## Theming

`monacoLoader.ts` derives a Monaco theme (`pilot-theme`) from the current
`--pilot-code-bg` / `--pilot-fg` / `--pilot-border` CSS custom properties (see
[GUI Design Principles](../../../../../docs/architecture/GUI-DESIGN-PRINCIPLES.md))
at mount time, so it automatically matches the active VS Code theme (or the
standalone dark fallback) without any separate light/dark toggle logic.

## Startup preflight check and diagnostic logging

`App.tsx` runs `preflight.ts`'s `runPreflightCheck()` once when the React app
boots, independent of whether any `CodeEditor` is shown yet. It checks, in
order: Worker API availability, whether `code-editor.js` loads at all, and
whether `monaco.editor.create()` actually succeeds (via a throwaway,
detached, invisible probe editor that is immediately disposed) — so the
concrete failure reason is known up front rather than only discovered the
first time a real code block fails.

Every diagnostic step always logs to the devtools console via
`diagnosticLog()`. To additionally persist these entries to a log file (e.g.
to investigate an issue without needing to reproduce it live, or to attach it
to a bug report), enable the **`portunix.pilotChat.codeEditorDebugLog`**
setting. `PilotChatProvider` then:

1. Injects `window.__portunixCodeEditorDebugLog__ = true` into the webview.
2. Shows an information message with the resolved log file path when the
   panel opens.
3. Appends every `codeEditorDiagnostic` message it receives to
   `<extension log dir>/pilot-code-editor.log` (`context.logUri`), one line
   per entry: `[timestamp] [LEVEL] message — detail`.

This is diagnostic-only — the preflight result does not gate or disable
`CodeEditor` elsewhere; each instance still makes (and logs) its own
load/mount attempt, falling back independently per the section above.

## Verification status

Verified: all three esbuild bundles (`esbuild.pilot.mjs` and the two
`esbuild.code-editor.mjs` configs) build cleanly, the main app bundles stay
small (Monaco is confirmed absent from them), `tsc` passes for every touched
file (including `monacoLoader.ts` against the real `monaco-editor` types),
and every `code-editor.js` output's syntax is valid.

Two real issues were found and fixed via manual smoke tests plus source
analysis (not yet re-confirmed live end to end in this session — no way to
drive/observe a native app window from this environment):

1. **Electron had no `code-editor/` bundle at all.** `ExplorerWorkspace`
   (`index.explorer.electron.tsx`) renders the shared `App` — the same chat
   root the VS Code webview uses — so it is a real `CodeEditor` consumer, not
   a hypothetical future one. Nothing built its `code-editor/` chunk, so
   `CodeEditor` correctly logged and fell back
   (`Failed to load file:///.../dist/electron/renderer/code-editor/code-editor.js`,
   caught via the preflight/diagnostic logging added for this). Fixed by
   adding `monaco-editor` to `src/electron/package.json` and a matching
   `src/electron/esbuild.code-editor.mjs` (see "Wired-up hosts" above).
2. **`getWorkerUrl`'s unguarded `new Worker()` call.** See "Why `getWorker`,
   not `getWorkerUrl`" above — found by reading
   `monaco-editor/esm/vs/base/browser/webWorkerFactory.js`, fixed by
   switching to the `getWorker` hook with fetch-and-blob-URL construction.

Reload the app (Electron: relaunch or `Ctrl+R`/rebuild; VS Code: reload the
Extension Development Host) and resend a code-block message to confirm both
fixes. Enable `portunix.pilotChat.codeEditorDebugLog` first if it still falls
back in the VS Code webview, so the exact reason lands in
`pilot-code-editor.log` (Electron logs to the devtools console only — it has
no extension host to write a log file to).
