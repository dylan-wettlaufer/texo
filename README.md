# Texo

**Build with AI. Understand what it builds.**

Texo is a visual understanding layer for AI-built software. Diagrams are built and maintained alongside a project so developers can understand the code their agents are creating: what each component does, how components communicate, and which source files implement them.

The current app is an interactive exploration prototype built with Next.js App Router, TypeScript, and Tailwind CSS. All project and diagram content comes from hard-coded fixtures; there are no backend integrations or persisted edits. The demo includes source inspection, curated function and code-range explanations, and synchronized architecture highlights. Agent updates through MCP, repository integration, hierarchical component views, and guided walkthroughs are planned; see [the product outline](docs/PRD.md).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The home route redirects to `/projects`.

## Explore

- `/projects`: sample project directory.
- `/projects/atlas`: Atlas Commerce and its three architecture diagrams.
- `/projects/atlas/diagrams/system`: interactive system overview.
- `/projects/atlas/diagrams/dependencies`: service dependencies.
- `/projects/atlas/diagrams/checkout`: checkout request flow.
- `/projects/beacon`: an empty project example.

Click a node, or focus it and press Enter or Space, to open its details in the right sidebar. On desktop, the sidebar occupies a separate column and the graph pane shrinks to make room. Resizing preserves the graph center and zoom; use Fit to view to reframe it. On narrow screens, details sit below a resized graph pane; they never cover the graph. The sidebar stays open while you pan, zoom, or click empty canvas space. Its body scrolls independently. Close it with the panel-close button or Escape; focus returns to the node that opened it. Clicking another node updates the same sidebar. Changing diagrams resets selection and viewport state.

The sidebar follows the component inspector layout: component name and technology, Overview, Connections with direction and diagram-specific labels, and Related source files. Commerce API includes example order endpoints, payment coordination, and queue-publishing files. More component details expands explicit dependencies and their consumers, interfaces, technologies, architectural decisions, notes, and metadata. Relationship buttons inspect related nodes, including those outside the current diagram. Dependency relationships are independent of request-flow arrows. Architectural details and code references are illustrative demo fixtures; paths do not refer to this repository. Details are read-only. Commerce API and Payment Provider source entries open inspectable sample TypeScript implementations. Payment Provider's directory entry opens a file chooser; references without sample source display an unavailable state. IDE links and connected repository source remain planned.

Source exploration stays in the same workspace, with code and explanations on the left and the architecture map on the right. The divider supports dragging and arrow keys (Home/End set its limits). Below 900px, code sits above the graph and the divider changes orientation. File opening selects the relevant function; clickable declarations and a function picker restore its overview. Functions explain purpose, behavior, inputs, outputs, side effects, callers/callees, and architecture connections. Known callers/callees open their function and file.

Click annotation markers or the Code explanations list to highlight pre-annotated lines and read what they do and why. Return to function overview clears range selection. Exploration Back/Forward restores file, function, and annotation selection. Clicking a graph node keeps code open and shows component details below it. Checkout feature-flow steps are clickable references, without playback or an enforced sequence.

Entering exploration fits the graph once. Function navigation and pane resizing preserve pan/zoom; manual Fit to view remains available. Closing exploration (× or Escape) restores the previous architecture viewport and latest inspected component. Changing diagrams resets exploration. Directed connections are matched by component IDs across views; unavailable connections are identified without switching diagrams automatically.

All source and explanations are authored demo fixtures, not live repository analysis. Texo does not execute or edit the sample code. The examples use injected adapter contracts; the adapter implementations and HTTP bindings are intentionally outside the sample. Tests verify checkout retries, declined/unresolved payments, and authenticated webhook handling.

Nodes use compact, rounded cards and curved arrows. System and dependency connection labels appear for the selected component; checkout step labels stay visible. The system view follows the storefront through the API to its resources and background worker; dependency and checkout views have their own layouts.

## Structure

- `app/(app)`: shared application layout and project routes.
- `components/shell`, `components/projects`, `components/workspace`: navigation, project views, and interactive canvas components.
- `lib/architecture`: domain types, fixtures, lookup helpers, and graph geometry.
- `lib/exploration`: sample source, explanation records, server-only TypeScript preparation, selection history, viewport geometry, and tests.
- `docs/PRD.md`: product outline, development workflow, planned capabilities, and current scope. This prototype deliberately excludes authentication, persistence, integrations, and graph editing.

The canvas uses React Flow with the existing shadcn/ui components. The existing TypeScript compiler identifies function declarations and prepares source ranges and simple token coloring on the server; it is not shipped in the client bundle. No dependencies were added. Server preparation uses the existing TypeScript package, so a production runtime must retain it (Next.js output tracing includes it).

## Verification

```bash
node --experimental-strip-types --test lib/architecture/*.test.mjs lib/exploration/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The fixture tests use Node's built-in test runner with native TypeScript stripping (Node 22.6+). Next.js fetches Plus Jakarta Sans and JetBrains Mono from Google during a production build, so the build needs network access. In environments that block Turbopack worker port binding, use `npm run build -- --webpack` to validate with the supported alternate bundler.
