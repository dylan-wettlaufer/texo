# Texo

**Build with AI. Understand what it builds.**

Texo is a visual understanding layer for AI-built software. Diagrams are built and maintained alongside a project so developers can understand the code their agents are creating: what each component does, how components communicate, and which source files implement them.

The current app is an interactive exploration prototype built with Next.js App Router, TypeScript, and Tailwind CSS. All project and diagram content comes from hard-coded fixtures; there are no backend integrations or persisted edits. Agent updates through MCP, hierarchical exploration, source-code inspection, and visual walkthroughs are planned; see [the product outline](docs/PRD.md).

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

Click a node, or focus it and press Enter or Space, to open its details in the right sidebar. On desktop, the canvas makes room for the sidebar; on narrow screens, the sidebar overlays the canvas. The sidebar stays open while you pan, zoom, or click empty canvas space. Its body scrolls independently. Close it with the panel-close button or Escape; focus returns to the node that opened it. Clicking another node updates the same sidebar. Changing diagrams resets selection and viewport state.

The sidebar follows the component inspector layout: component name and technology, Overview, Connections with direction and diagram-specific labels, and Related source files. Commerce API includes example order endpoints, payment coordination, and queue-publishing files. More component details expands explicit dependencies and their consumers, interfaces, technologies, architectural decisions, notes, and metadata. Relationship buttons inspect related nodes, including those outside the current diagram. Dependency relationships are independent of request-flow arrows. Architectural details and code references are illustrative demo fixtures; paths do not refer to this repository. Details are read-only. Example source-file rows are informational; opening actual source code or an IDE is planned.

## Structure

- `app/(app)`: shared application layout and project routes.
- `components/shell`, `components/projects`, `components/workspace`: navigation, project views, and interactive canvas components.
- `lib/architecture`: domain types, fixtures, lookup helpers, and graph geometry.
- `docs/PRD.md`: product outline, development workflow, planned capabilities, and current scope. This prototype deliberately excludes authentication, persistence, integrations, and graph editing.

The canvas uses React Flow with the existing shadcn/ui components. No additional dependencies are needed for the node details sidebar.

## Verification

```bash
node --experimental-strip-types --test lib/architecture/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The fixture tests use Node's built-in test runner with native TypeScript stripping (Node 22.6+). Next.js fetches Ubuntu, Open Sans, and Geist Mono from Google during a production build, so the build needs network access. In environments that block Turbopack worker port binding, use `npm run build -- --webpack` to validate with the supported alternate bundler.
