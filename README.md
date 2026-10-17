# Texo

**Build with AI. Understand what it builds.**

Texo is building a Living Codebase Map: a local knowledge graph derived from source that helps developers understand what exists, how it connects, and what changed while coding with AI. The direction is automatic structural indexing with explanations and agent context layered on top; see [the product outline](docs/PRD.md).

The current app is an interactive exploration prototype built with Next.js App Router, TypeScript, and Tailwind CSS. Atlas and Beacon use hard-coded fixtures; a development-only Texo project explores real source from the local checkout. The real index and authored architecture diagrams remain separate. There is no persistence, automatic watching, incremental analysis, recent-change history, or generated explanation. The demo includes source inspection, curated function and code-range explanations, and synchronized architecture highlights.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The home route redirects to `/projects`.

## Parse a repository

Run `npm run repo:parse -- /absolute/path/to/checkout` to produce a local JS/TS code index with declarations, source ranges, imports/exports, and limited static call relationships. The parser runs independently of the web app and reads current Git working-tree contents. See [the parser guide](docs/repository-parser.md) for the index contract, limitations, and verification commands.

For readable exploration from this project's root, run `npm run --silent repo:query` for a summary, `npm run --silent repo:query -- search parseRepository` to find the parser, or `npm run --silent repo:query -- declaration parseRepository` to see its implementation. Use `callers` or `callees` with the same name to inspect call sites. Add `--json` for a targeted structured result.

## Explore local source

With `npm run dev` running from this checkout, open `/projects/texo/code` or choose **Texo → Open Code Explorer** from the project directory. Browse files, switch Browse to Functions to search, select a function, and follow its callers or resolved calls. Back/Forward restores selections. **Refresh** checks saved content hashes and resolution inputs, reusing cached analysis when unchanged; navigation otherwise uses the same captured snapshot.

This feature is development-only. Production hides the Texo project and returns 404 for the explorer and its data endpoints. Source is read by the local Next.js server; the browser receives selected files and paginated results. Atlas's diagrams and explanations remain authored demos. See [the local explorer guide](docs/repository-parser.md#browse-local-source-in-the-web-app) for limitations and refresh behavior.

## Explore

- `/projects`: sample project directory.
- `/projects/atlas`: Atlas Commerce and its three architecture diagrams.
- `/projects/atlas/diagrams/system`: interactive system overview.
- `/projects/atlas/diagrams/dependencies`: service dependencies.
- `/projects/atlas/diagrams/checkout`: checkout request flow.
- `/projects/beacon`: an empty project example.

Click a node, or focus it and press Enter or Space, to open its details in the right sidebar. On desktop, the sidebar occupies a separate column and the graph pane shrinks to make room. Resizing preserves the graph center and zoom; use Fit to view to reframe it. On narrow screens, details sit below a resized graph pane; they never cover the graph. The sidebar stays open while you pan, zoom, or click empty canvas space. Its body scrolls independently. Close it with the panel-close button or Escape; focus returns to the node that opened it. Clicking another node updates the same sidebar. Changing diagrams resets selection and viewport state.

The sidebar follows the component inspector layout: component name and technology, Overview, Connections with direction and diagram-specific labels, and Related source files. Commerce API includes example order endpoints, payment coordination, and queue-publishing files. More component details expands explicit dependencies and their consumers, interfaces, technologies, architectural decisions, notes, and metadata. Relationship buttons inspect related nodes, including those outside the current diagram. Dependency relationships are independent of request-flow arrows. Architectural details and code references are illustrative demo fixtures; paths do not refer to this repository. Details are read-only. Commerce API and Payment Provider source entries open inspectable sample TypeScript implementations. Payment Provider's directory entry opens a file chooser; references without sample source display an unavailable state. IDE links and connected repository source remain planned.

Source exploration stays in the same workspace, with explanations above code on the left and the architecture map on the right. Explanation and source sections collapse independently and keep their own scrolling. The divider supports dragging and arrow keys (Home/End set its limits). Below 900px, exploration sits above the graph and the divider changes orientation. File opening selects the relevant function; clickable declarations and a function picker restore its overview. Component/file/function breadcrumbs orient the reader. The compact overview shows purpose and clickable implementation steps; Details expands inputs, outputs, side effects, callers/callees, architecture connections, and feature-flow references. Known callers/callees open their function and file.

Click an implementation step or any line in its authored code range to select that step, scroll to and highlight its source, and read what it does and why. Code activation opens a collapsed explanation panel; selecting a step preserves a collapsed source panel and scrolls to the selected range when it is reopened. Only one step is active. Its explicit component IDs and directed interactions highlight the graph while unrelated nodes and edges stay visible but subdued. Return to function overview clears step selection and restores the overview. Exploration Back/Forward in the explanation panel restores file, function, step, and annotation selection. Clicking a graph node keeps code open and shows component details in the explanation section. Checkout feature-flow steps are clickable references, without playback or an enforced sequence.

Entering exploration fits the graph once. Function navigation and pane resizing preserve pan/zoom; manual Fit to view remains available. Closing exploration (× or Escape) restores the previous architecture viewport and latest inspected component. Changing diagrams resets exploration. Directed connections are matched by component IDs across views; unavailable connections are identified without switching diagrams automatically.

Atlas’s source and explanations are authored demo fixtures, not live repository analysis. Each function has stable step IDs, explicit line ranges, component IDs, directed interactions, and optional authored detail or links to existing annotations. Preparation validates step ranges inside their function and reports invalid ranges without exposing them as clickable code or highlighting unrelated lines. Texo does not execute or edit the sample code. The examples use injected adapter contracts; the adapter implementations and HTTP bindings are intentionally outside the sample. Tests verify checkout retries, declined/unresolved payments, and authenticated webhook handling.

Nodes use compact, rounded cards and curved arrows. System and dependency connection labels appear for the selected component; checkout step labels stay visible. The system view follows the storefront through the API to its resources and background worker; dependency and checkout views have their own layouts.

## Structure

- `app/(app)`: shared application layout and project routes.
- `components/shell`, `components/projects`, `components/workspace`: navigation, project views, and interactive canvas components.
- `lib/architecture`: domain types, fixtures, lookup helpers, and graph geometry.
- `lib/repository`: framework-independent analysis, queries, content-hash caching, and in-memory snapshot publication.
- `lib/local-repository`: local web adapter, request validation, and source-browser navigation; the server entry point selects the checkout and owns environment policy.
- `lib/source`: source-display types and server-side tokenization shared by real source and authored examples.
- `lib/exploration`: sample source, explanation records, server-only TypeScript preparation, selection history, viewport geometry, and tests.
- `docs/PRD.md`: product outline, development workflow, planned capabilities, and current scope. This prototype deliberately excludes authentication, persistence, integrations, and graph editing.

The canvas uses React Flow with the existing shadcn/ui components. The existing TypeScript compiler identifies function declarations and prepares source ranges and simple token coloring on the server; it is not shipped in the client bundle. No dependencies were added. Server preparation uses the existing TypeScript package, so a production runtime must retain it (Next.js output tracing includes it).

## Verification

```bash
node --experimental-strip-types --test lib/architecture/*.test.mjs lib/exploration/*.test.mjs
node --test lib/repository/*.test.mjs lib/local-repository/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The fixture tests use Node's built-in test runner with native TypeScript stripping (Node 22.6+). Next.js fetches Plus Jakarta Sans and JetBrains Mono from Google during a production build, so the build needs network access. In environments that block Turbopack worker port binding, use `npm run build -- --webpack` to validate with the supported alternate bundler.
