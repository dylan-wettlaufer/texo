# Texo — Living Codebase Map

**Build with AI. Understand what it builds.**

## Vision

Texo is a local knowledge graph of a project that builds and updates itself as code changes. It helps developers working with heavy AI assistance or fast-moving codebases understand what exists, how it connects, and what just changed.

The primary workflow is scoped exploration: find a file or function, inspect its neighborhood, follow source evidence, and see recent changes. A whole-repository graph is not the default view.

## Source of truth

Source code is the truth for structural facts. The index derives files, declarations, imports, and statically identifiable calls from saved source. Unresolved references remain explicitly unresolved; static calls are not proof of runtime execution.

The intended local SQLite database stores the derived graph, content versions, and observed change history. Current structure can be rebuilt from source; past uncommitted edits and session events cannot be recovered from the current checkout alone. Git supplies commit baselines, not a complete history of saved edits.

Explanations, architectural interpretations, and intent notes are a separate layer linked to indexed identities and source evidence. They must not overwrite extracted facts. A generated explanation records the content version and relevant context it describes so freshness can be checked. Authored services and request flows are not interchangeable with a static function-call graph.

Agents can later query the graph and attach attributed context. Keeping structural facts current must not depend on agents remembering to maintain architecture files. The previous proposed bidirectional sync of an agent-maintained `.texo/architecture.json` is no longer the foundation.

## Current implementation

There are two independent experiences:

- **Real repository exploration:** a framework-independent JS/TS analyzer and query library, CLI tools, and a development-only local source browser. They support declaration search, source ranges, imports/exports, limited static caller/callee navigation, selection history, and manual refresh.
- **Authored architecture demo:** Atlas's three React Flow diagrams, component inspector, curated source/function explanations, and graph-focus presentation. Beacon demonstrates an empty project. These are fixtures, not generated maps of the indexed repository.

The analyzer uses the existing TypeScript compiler. File hashes and resolution-input checks support a bounded whole-index cache. A cache miss rebuilds the entire index. One in-memory snapshot is published at a time; navigation uses that captured snapshot until Refresh. State is discarded on server restart.

There is no persistent database, watcher, per-file incremental analysis, historical change overlay, real-source graph view, generated explanation, ask box, MCP server, agent attribution, or intent-note system. The local browser scans the checkout running Next.js and is disabled in production. No subsecond save-to-graph latency has been verified.

## Existing code boundaries

- `lib/repository`: discovery, safe capture, analysis, content-hash caching, targeted queries, and snapshot publication. This core has no React, Next.js, HTTP, or authored-demo dependencies.
- `lib/local-repository`: local web adapter, request validation, source-display preparation, and browser selection/history. Its server entry point owns checkout-root selection and development-only policy.
- `lib/source`: shared source-display types and server-side tokenization used by real source and authored examples. Inclusive display line ranges are distinct from the parser's end-exclusive UTF-16 ranges.
- `lib/architecture`: authored architectural details, relationships, and diagram views. Component details do not require positions; each diagram supplies its own coordinates. These types do not define the extracted code index.
- `lib/exploration`: authored explanations, steps, annotations, and navigation for the demo. Real source browsing does not require an authored explanation record.
- `components/workspace`: the existing React Flow canvas, inspectors, source viewer, and exploration interfaces.

These boundaries preserve the working prototype without adding unimplemented database, watcher, or agent abstractions.

## Delivery phases

### 1. Live structural graph

Start with TypeScript, retaining the existing compiler-based analyzer and its resolution behavior. A Tree-sitter migration is not required for v1; additional languages can revisit the parser boundary later.

Persist files, declarations, imports, calls, and content versions in SQLite. Keep node identity separate from content hashes. Existing declaration IDs survive unrelated line shifts but do not promise continuity across renames, moves, or anonymous-scope reordering. Relationship IDs also need review before they can identify changes across scans.

Add a watcher, incremental invalidation of affected analysis, and Git reconciliation for commits and branch changes. A callee, import, or configuration change may affect relationships beyond the edited file. Publish a consistent revision for consumers and retain the previous usable snapshot when analysis fails.

**Done when:** saving a file updates the graph in under a second on a documented benchmark repository, measured through visible publication rather than parsing alone.

### 2. Browsable UI with change highlighting

Use the existing React and React Flow interface. Connect real indexed relationships to scoped views: search a node and inspect a bounded neighborhood, with source and relationship evidence available on selection.

Record and display additions, edits, deletions, and relationship changes. Support recent-hour, session, and commit scopes with explicit baselines. Preserve selection and viewport as the graph changes. Link through to source and diffs.

**Done when:** after an hour of coding, a glance shows what moved.

### 3. Explanations and ask box

Generate module/function summaries lazily for viewed or changed nodes. Record source hashes and relevant dependency/context versions; expose stale or unavailable evidence rather than presenting old explanations as current.

Add plain-language session summaries and questions such as “how does auth work?” Answers cite real indexed nodes and source locations, with those nodes highlighted on the graph. Distinguish extracted facts from generated interpretation.

**Done when:** answers point to verifiable nodes and lines and remain trustworthy as code changes.

### 4. Agent integration

The watcher captures saved changes regardless of the editor or agent. Claude Code hooks can add attribution and session context; attribution must come from recorded evidence rather than being guessed from filesystem events.

An optional MCP server exposes bounded graph queries and allows agents to leave contextual notes. It does not become responsible for maintaining extracted structural facts.

**Done when:** agent edits appear in the map with supported attribution.

### 5. Optional intent notes

Only after dogfooding demonstrates demand, record goals linked to nodes and flag potentially unrelated changes for review. Treat drift as an interpretation that requires context.

## Scope and stack

TypeScript throughout, Next.js/React for the local web UI, React Flow for graph presentation, and the existing TypeScript compiler for JS/TS analysis. SQLite, a file watcher, an LLM API for summaries, and the MCP TypeScript SDK are future additions; packages require approval before installation.

Multi-repository views, additional languages, team sharing, hosted deployment, and bidirectional diagram editing are outside v1.

## Risks and validation

- **Noise:** bound neighborhoods and emphasize relevant recent changes.
- **Incorrect or stale explanations:** preserve source evidence, explicit resolution limits, and versioned freshness.
- **Cost:** generate summaries lazily and invalidate only when their inputs change.
- **Incremental correctness:** account for configuration, dependencies, deletion, and branch changes; measure latency on stated repository sizes.
- **Product overlap:** compare arch-viewer, ContextHub, and Understand Anything before making differentiation claims in the README. The intended focus is live, session-aware understanding; that distinction is not yet validated.
