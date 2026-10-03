<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working style

- Prefer small, focused changes over large rewrites.
- Do not add dependencies without asking first.
- Do not change unrelated code.
- Read the relevant existing code before proposing changes.
- Follow existing project patterns and conventions.
- Prefer simple solutions over unnecessary abstractions.

## Frontend

- Reuse the project's component system.
- When shadcn/ui is present, prefer its components.
- Keep business logic separate from presentation where practical.
- Preserve existing design conventions unless asked to redesign something.

## Dependencies

Do not install a new package unless:

1. existing dependencies cannot reasonably solve the problem, and
2. I approve the dependency.

## Verification

After implementation:

1. Run relevant tests.
2. Run type checking.
3. Run linting.
4. Run the build when appropriate.
5. Fix failures caused by your changes.

Do not claim something works without verifying it when verification is possible.

## Git
- Do not commit or push unless explicitly asked.
- Do not modify or discard unrelated working-tree changes.
- Keep changes scoped to the requested task.

## Communication

- Be concise.
- Explain important architectural decisions.
- Tell me when you are uncertain.
- Do not hide errors or failing tests.
- Challenge my proposed approach when there is a materially better option.