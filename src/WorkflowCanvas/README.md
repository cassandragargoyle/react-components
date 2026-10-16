# WorkflowCanvas

<!-- Component overview for the React Flow based Workflow Canvas -->
<!-- Explains usage, host messaging and the file map -->

Interactive editor for workflows: user-placed nodes connected by edges, built on
[React Flow](https://reactflow.dev/) (`@xyflow/react`). It renders a
`WorkflowDocument` with a three-panel layout — workflow viewport, node table and
property panel — and supports undo/redo. It came from Pilot, the
`portunix-vscode` desktop app, where it edits `*.flow.json` files; see
[ADR-006](https://github.com/cassandragargoyle/portunix-vscode/blob/main/docs/adr/006-react-flow-for-workflow-canvas.md)
for why React Flow rather than Cytoscape.

## Usage

```tsx
import { WorkflowCanvas } from '@cassandragargoyle/react-components';

// VS Code webview: the webview API is the port
<WorkflowCanvas api={acquireVsCodeApi()} />

// Any other host: an object with postMessage(message) receives the canvas events
<WorkflowCanvas api={{ postMessage: (message) => bridge.send(message) }} />
```

Optional peers: `@xyflow/react`, `ag-grid-community`, `ag-grid-react`.

## Host ↔ Canvas Messaging

The canvas never looks a host API up on its own. The host posts to `window`, the
canvas posts to its `api` port:

| Direction | Message |
| --------- | ------- |
| Host → canvas | `{ type: 'setWorkflowData', data }`, `{ type: 'selectNode', ids }` |
| Canvas → host | `{ type: 'ready' }` on mount |
| Canvas → host | `{ type: 'workflowDataChanged', data }` after every edit, undo and redo |
| Canvas → host | `{ type: 'selectionChanged', elements }` |
| Canvas → host | `{ type: 'requestSave', data }` on Ctrl/Cmd+S |

The contracts are `ExtensionToWebviewMessage` / `WebviewToExtensionMessage` in
[`types.ts`](./types.ts).

## File Map

| File | Role |
| ---- | ---- |
| `WorkflowCanvas.tsx` | Top-level state, undo/redo and three-panel orchestration |
| `WorkflowViewport.tsx` | React Flow wrapper (render, drag, connect) |
| `WorkflowToolbar.tsx` | Zoom/fit controls, undo/redo, find, counts |
| `WorkflowNodeTable.tsx` | Maps nodes to rows for the shared `NodeTablePanel` |
| `WorkflowPropertyPanel.tsx` | Property and connection view of the selection |
| `nodes/` | Custom node renderers per node type |
| `WorkflowCanvas.css` | Three-panel layout, VS Code theme variables |
| `types.ts` | `WorkflowDocument` shape, UI types and the message contracts |
| `index.ts` | Public export |
