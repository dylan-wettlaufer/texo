# Texo

An architecture workspace prototype built with Next.js App Router, TypeScript, and Tailwind CSS. All project and diagram content comes from hard-coded fixtures; there are no backend integrations or persisted edits.

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

Click a node, or focus it and press Enter or Space, to open its details in the right sidebar. On desktop, the canvas makes room for the sidebar; on narrow screens, the sidebar overlays the canvas. The sidebar stays open while you pan, zoom, or click empty canvas space. Its body scrolls independently. Close it with × or Escape; focus returns to the node that opened it. Clicking another node updates the same sidebar. Changing diagrams resets selection and viewport state.

Details include responsibilities, explicit dependencies and their consumers, interfaces, technologies, architectural decisions, code references, notes, and metadata. Relationship buttons inspect related nodes, including those outside the current diagram. Dependency relationships are independent of request-flow arrows. Architectural details and code references are illustrative demo fixtures; paths do not refer to this repository. Details are read-only.

## Structure

- `app/(app)`: shared application layout and project routes.
- `components/shell`, `components/projects`, `components/workspace`: navigation, project views, and interactive canvas components.
- `lib/architecture`: domain types, fixtures, lookup helpers, and graph geometry.
- `docs/PRD.md`: product vision. This prototype deliberately excludes authentication, persistence, integrations, and graph editing.

The canvas uses React Flow with the existing shadcn/ui components. No additional dependencies are needed for the node details sidebar.

## Verification

```bash
node --experimental-strip-types --test lib/architecture/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The fixture tests use Node's built-in test runner with native TypeScript stripping (Node 22.6+). Next.js fetches Ubuntu, Open Sans, and Geist Mono from Google during a production build, so the build needs network access. In environments that block Turbopack worker port binding, use `npm run build -- --webpack` to validate with the supported alternate bundler.
