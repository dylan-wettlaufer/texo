# Texo — A Visual Understanding Layer for AI-Built Software

**Tagline:** Build with AI. Understand what it builds.

## Overview

Texo is an agent-native visual code exploration platform that helps developers understand how their applications work as they build with AI coding agents. The diagrams are built and maintained alongside the project: each feature adds both implementation and an explanation of how it fits into the system.

Developers explore a living map of services, modules, components, and functions, with plain-English explanations and references to the code behind them. Agents contribute this understanding through MCP while they implement changes.

The goal is that developers remain connected to the software their agents are creating.

## The Problem

AI tools can produce features faster than developers can understand their implementation. File trees reveal where code lives but make relationships and execution paths difficult to follow. Separate diagrams and Markdown explanations become outdated, and developers repeatedly ask agents to explain the same code.

Texo should help developers understand responsibilities, dependencies, data flow, and design decisions at the level of detail they need, without requiring them to read every file.

## Development Workflow

1. Create a Texo project and connect an MCP-compatible coding agent to the repository.
2. Describe a feature to the agent.
3. As the agent implements the feature, it creates or updates components, connections, source references, and explanations in the project model.
4. Texo reflects those changes on the architecture canvas.
5. The developer clicks a component, reads its explanation, follows its connections, and explores the related implementation.
6. Later changes update the model alongside the code so the diagrams continue to describe the project as it evolves.

Existing projects can start with an agent inspecting the repository and creating an initial map. Ongoing development should maintain that map as part of feature work.

## Core Features

### 1. Living Architecture Canvas

An interactive map of services, databases, APIs, modules, and components. Labeled connections explain dependencies and communication paths. Developers can pan, zoom, and navigate views. Planned agent integration updates the map as code is built and highlights components affected by recent changes.

### 2. Hierarchical Code Exploration

- **System architecture:** major services, databases, external integrations, and their communication.
- **Component architecture:** internal modules, classes, and responsibilities within a service.
- **Functions and source code:** individual functions, callers, dependencies, and implementation.

Progressive exploration should reveal detail on demand instead of showing the entire codebase as hundreds of nodes at once.

### 3. Interactive Component Inspector

Clicking a component opens a right sidebar that resizes the graph pane while preserving its center and zoom. Compact rounded cards and curved arrows keep the graph readable. On narrow screens, details occupy a separate pane below the graph. The primary layout is:

- Component name, type, and technology.
- **Overview:** a plain-English explanation of purpose and responsibilities.
- **Connections:** incoming and outgoing communication with names and explanatory labels. Selecting a connected component updates the inspector.
- **Related source files:** paths and short descriptions of the implementation they contain.

Additional context includes interfaces, dependencies, consumers, design decisions, notes, and metadata. Dependency ownership is separate from communication direction; a worker depends on a queue even when jobs flow from the queue to the worker.

For **Commerce API**, the overview explains request handling, payment authorization, order storage, and publishing background jobs. Connections include the Web application, Primary database, Payment provider, and Order queue. Example files are `src/api/orders.ts` (order endpoints), `src/services/payment.ts` (payment coordination), and `src/queues/orders.ts` (queue publishing).

The prototype now includes a read-only source-exploration demo. Commerce API and Payment Provider source entries open authored TypeScript examples. A directory opens a file chooser, and missing sample source remains visibly unavailable.

Code and explanations occupy the left pane, and the synchronized graph occupies the right. A pointer- and keyboard-accessible divider resizes them; narrow screens stack the panes. Opening a file selects its component-associated function. Function overviews expose purpose, step-by-step behavior, inputs, outputs, side effects, linked callers/callees, and related architecture connections.

Pre-annotated ranges can be selected through code markers or an annotation list. Selection highlights their lines and explains what the code does and why; Return to function overview clears the range. Exploration Back/Forward restores file, function, and annotation selection. Clicking a graph node shows its details without closing the code.

Selecting `authorizePayment()` emphasizes Commerce API → Payment Provider by directed component IDs in each available diagram. Missing connections are identified explicitly, with links to relevant views when available. Entering exploration fits once; subsequent function/range navigation and resizing preserve graph zoom and center. Fit to view remains manual, and closing exploration restores the previous architecture viewport.

The sample implementations cover checkout, authorization, queue publishing, and webhook reconciliation, including declined/unresolved payments, idempotency, durable authorization state, and retry behavior. Their adapter contracts are included; runtime adapters and HTTP bindings are outside this demo. Source and explanations are curated fixtures, not inferred analysis or AI-generated content. Repository source access, hierarchical component drill-down, and IDE links remain planned.

### 4. Agent-Native MCP Integration

MCP is the planned interface for Codex, Claude Code, Cursor, and other compatible agents to read and maintain the project model. During implementation, agents create components, update descriptions, modify relationships, attach source references, and record architectural decisions and feature explanations.

Conceptual tools include `get_architecture`, `get_component`, `search_architecture`, component and relationship creation/update/deletion, `attach_code_reference`, `add_decision`, and `get_pending_changes`. These are proposed capabilities, not implemented tools in this prototype.

Agents supply their understanding while writing code. Planned code analysis verifies references and flags outdated information; it complements agent explanations. Texo works with the developer's existing coding agent.

### 5. Visual Code Explanations

A developer can request a walkthrough such as “Show me how an incoming API request reaches the database.” The planned experience highlights the relevant path, explains each step, and shows corresponding source code and data movement.

The prototype includes freely selectable function and source-range explanations plus ordered, clickable checkout-flow references. These steps open the associated function or annotation; they do not enforce a sequence or provide a walkthrough player. Generated explanations and guided playback remain future work.

### 6. Feature Walkthroughs and Replay — Future

After a feature is implemented, developers could review the components added or modified and how the feature integrates into the application. Walkthrough generation, change history, and replay remain future work. The supplied outline ends during this section; detailed replay behavior still needs definition.

## Storage and Source of Truth

**The repository is the source of truth. The Texo database is a cache and index.**

The architecture graph is stored as a structured file (for example `.texo/architecture.json`, or a `.texo/` directory of files for larger systems) committed to the project's repository. The Texo web app is a viewer and editor over that file, not the owner of the data.

### Why the repository

- **Agents already have the repo.** Coding agents work inside the checkout. If the architecture is a file there, they can read it with no network call, no API key, and no dependency on Texo's servers being up.

- **It stays in sync by construction.** A code change and its architecture update can land in the same commit or PR. Each branch carries its own architecture state, so there is no separate mapping between "which diagram matches which commit."

- **History and review come for free.** Diffs, blame, rollback, and PR review work on the architecture file the same way they work on code.

- **Trust.** Teams that are wary of sending architecture details to a third-party service can still adopt the format without handing over their data.

- **It reinforces the product philosophy.** The architecture model lives next to the code it describes, so it is part of the development workflow rather than documentation maintained separately.

### What the database is for

The database holds anything that is not tied to a specific commit, and a fast copy of what is:

- Users, teams, permissions, and billing

- Cached, parsed copies of the architecture for fast canvas rendering and search

- Comments and discussion on components

- Cross-project views, such as all services across an organization

- Pending canvas edits that have not yet been written back to the repo

### File format principles

- **Stable IDs.** Every component and relationship has a stable ID so edits can be diffed and matched across versions, and so renames don't break relationships.

- **Deterministic serialization.** Keys and arrays are written in a consistent order so diffs are minimal and merge conflicts are rare.

- **Schema versioning.** The file declares a schema version so older files can be migrated.

- **Human-readable.** The file should be reviewable in a PR without Texo.

- **Splittable.** Large systems can be divided into multiple files (for example per service) to reduce merge conflicts.

### Sync model

```
Agent edits  → MCP server → .texo/ file in repo → synced to Texo cache → Canvas updates
Canvas edits → Texo cache → pending changes → written to .texo/ file in repo (via MCP server or CLI)
```

- The MCP server runs where the agent runs, reads and writes the repo file directly, and syncs changes to Texo so the canvas stays current.

- Edits made on the canvas are stored as pending changes. They are written into the repo file the next time the local MCP server or CLI syncs, and the agent can ask what has changed since it last looked.

- Later, an optional GitHub integration can write canvas edits back as commits or pull requests without needing a local agent session.

- When the repo file and the canvas disagree, the repo file wins, and the user is shown the conflict to resolve rather than being silently overwritten.

## Model and Implementation Principles

The canvas presents a structured model rather than owning a separate drawing. Stable component IDs link views, explanations, relationships, and source references. Future hierarchical views should share identities and attach file/function locations without duplicating component context.

Code remains the implementation truth. Explanations must distinguish verified references from agent-authored descriptions and proposed architecture. Diagrams should be reviewed with the code changes they describe.

The repository-storage and cache/sync design above is retained from the existing architecture direction. Storage, sync, conflict handling, MCP, and connected-repository code verification are planned and are not present in the current app.

## Current Prototype

Implemented:

- Sample project directory, project pages, and an empty-project state.
- Development-only Texo local project with real file/function search, captured source, direct static caller/callee navigation, history, and explicit snapshot refresh.
- Three Atlas Commerce views: system overview, service dependencies, and checkout request flow.
- Interactive React Flow canvas with pan, zoom, selection, and diagram navigation.
- Right component inspector with overview, labeled connections, source entry points, and expandable technical details.
- Resizable read-only source workspace with syntax coloring, curated function/range explanations, linked navigation, and synchronized graph focus.
- Clickable feature-flow steps and explicit unavailable-source/connection states.
- Keyboard activation, Escape dismissal, focus restoration, independent inspector scrolling, and a separate details pane below the graph on narrow screens.

Atlas and Beacon use local fixtures. The development-only Texo project parses the checkout running Next.js and serves targeted code queries from an in-memory snapshot. There is no authentication, persistence, remote repository connection, MCP server, graph editing, real-source architecture mapping, hierarchical component drill-down, automatic update, change highlighting, or generated walkthrough.

## Delivery Outline

1. **Exploration foundation:** refine the canvas and inspector so developers can understand components and follow their relationships. This is the current prototype phase.
2. **Model and agent updates:** define the versioned repository format, connect a local MCP server, and reflect agent changes on the canvas during project development.
3. **Implementation navigation:** the curated source/function demo validates exploration; connect repository source, add component-level drill-down, and provide IDE links.
4. **Explanations and verification:** provide visual execution walkthroughs, change highlighting, and stale-reference checks.
5. **Later exploration:** feature walkthroughs and replay, collaboration, optional GitHub integration, and cross-project views.

## Open Questions

- What is the first repository language supported for validating files and function references?
- How are source code and IDE locations accessed safely from the viewer?
- How quickly should agent changes appear while implementation is in progress?
- What distinguishes implemented architecture from a proposed change?
- Should larger models use one file or files split by service?
- How should the canvas expose branch conflicts and pending edits?
- Which fields can teams exclude from a cloud cache?
- What is the first useful scope for feature walkthroughs and replay?
