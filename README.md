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

Select a node to inspect its context and incoming/outgoing relationships. Inspector connections select the related node. Use the canvas controls to zoom or fit the graph, scroll to explore at higher zoom, and press Escape or click the background to clear selection. Changing diagrams resets selection and viewport state.

## Structure

- `app/(app)`: shared application layout and project routes.
- `components/shell`, `components/projects`, `components/workspace`: navigation, project views, and interactive canvas components.
- `lib/architecture`: domain types, fixtures, lookup helpers, and graph geometry.
- `docs/PRD.md`: product vision. This prototype deliberately excludes authentication, persistence, integrations, and graph editing.

No graph or UI packages have been added. The canvas uses HTML nodes and SVG connections.

## Verification

```bash
node --experimental-strip-types --test lib/architecture/architecture.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The fixture tests use Node's built-in test runner with native TypeScript stripping (Node 22.6+). Next.js fetches the starter Geist fonts from Google during a production build, so the build needs network access.
