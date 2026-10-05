
**Tagline:** An architecture context layer for developers and coding agents.

## The Problem

Coding agents are becoming increasingly capable of modifying large codebases, but they often lack a persistent understanding of how a software system is designed.

Agents can inspect files and infer relationships from code, but they repeatedly spend context discovering the same things:

- What services exist?
    
- What is each component responsible for?
    
- How do services communicate?
    
- What databases, queues, caches, and external systems are involved?
    
- What architectural decisions has the team made?
    
- Which parts of the codebase implement a particular component?
    

Traditional architecture diagrams don't solve this well. They're usually static documents created in tools like Miro, draw.io, or Confluence. They quickly become outdated, and coding agents generally cannot use them as structured context.

## The Idea

**Texo is a shared architecture model that both developers and coding agents can understand and modify.**

Developers get a collaborative visual canvas for understanding and designing their software architecture.

Coding agents interact with the same architecture through **MCP**.

The key idea is:

**Human ↔ Texo ↔ Coding Agent ↔ Code**

Texo becomes the persistent architectural context between the developer and their coding agents.

It is **not primarily an AI diagram generator** and does not need its own LLM integration.

Instead, users bring the coding agent they already use—such as Codex, Claude Code, Cursor, or another MCP-compatible agent. Their agent understands their codebase and uses Texo's MCP tools to create, query, and update the architecture model.

## Example Workflow

A developer creates a new Texo project and connects the Texo MCP server to their coding agent.

They can then tell their agent:

> Analyze this codebase and create its architecture in Texo.

The coding agent inspects the local repository using its existing capabilities and calls Texo's MCP tools to construct the architecture.

For example:

```
Developer
    │
    ▼
Coding Agent
    │
    │ MCP
    ▼
Texo Architecture Model
    │
    ▼
Visual Architecture Canvas
```

No GitHub integration is required.

Texo does not clone the repository, index the entire codebase, or send the user's code through its own LLM.

The coding agent remains responsible for understanding the code. **Texo provides the persistent structured architecture representation.**

## The Architecture Model

The important technical distinction is that **the visual diagram is not the source of truth**.

Underneath the canvas, Texo stores a structured architecture graph.

For example:

```
Checkout Service
    │
    ├── depends on → Payments Service
    │
    └── uses → Redis

Payments Service
    │
    ├── depends on → PostgreSQL
    └── integrates with → Stripe
```

Each architecture node can contain structured information such as:

- Name
    
- Component type
    
- Description/responsibility
    
- Dependencies
    
- Consumers
    
- Interfaces
    
- Technologies
    
- Architectural decisions
    
- Relevant files or directories
    
- Notes and metadata
    

The canvas is simply the **human interface to this graph**.

MCP is the **agent interface to this graph**.

```
                     ┌─────────────────────┐
                     │        TEXO         │
                     │                     │
                     │ Architecture Graph  │
                     └─────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
          Visual Canvas                  MCP Server
          Human Interface              Agent Interface
                  │                         │
                  ▼                         ▼
             Developers                Coding Agents
```

## Node Inspector

Clicking a component on the canvas should reveal considerably more than its name.

For example, clicking **Payments Service** might show:

```
Payments Service

Responsibility
Processes customer payments and tracks payment state.

Provides
POST /payments
GET /payments/:id

Depends On
Stripe
PostgreSQL

Used By
Checkout Service

Code
/services/payments/
/services/payments/payment.service.ts
/services/payments/payment.controller.ts

Architecture Decisions
Stripe is considered the source of truth for payment state.
```

This makes Texo useful both as a high-level diagram and as a way to navigate and understand a system.

## MCP

MCP is central to the product rather than an optional integration.

Texo could expose tools conceptually similar to:

```
get_architecture()
get_component()
search_architecture()

create_component()
update_component()
delete_component()

create_relationship()
update_relationship()
delete_relationship()

attach_code_reference()

get_decisions()
add_decision()
```

This allows an agent to both **read and modify** architectural context.

Before implementing something, an agent could query Texo:

```
get_component("payments-service")
```

and learn its responsibilities, dependencies, interfaces, decisions, and relevant code locations without having to rediscover all of that context.

After changing the system, the agent can update Texo.

For example, if Redis is added:

```
create_component("redis", type="cache")

create_relationship(
    from="recommendation-service",
    to="redis",
    type="depends_on"
)
```

The architecture canvas updates accordingly.

## The Two-Way Relationship

This is the most important part of Texo.

Most architecture tools are:

```
Human → Diagram
```

Texo is:

```
Human
   ↕
Architecture Model
   ↕
Coding Agent
   ↕
Codebase
```

Humans can use Texo to communicate architectural intent to agents.

Agents can use Texo to communicate architectural changes back to humans.

For example, a developer could visually specify:

```
Recommendation Service
        │
        ▼
      Redis
```

Then tell their coding agent:

> Implement the Redis cache shown in our Texo architecture.

The agent queries Texo through MCP, understands the intended relationship, and implements it.

Likewise, if the developer tells their coding agent directly:

> Add Redis caching to the recommendation service and update Texo when you're done.

the agent can modify the code and then update the architecture model through MCP.

This keeps architecture connected to the actual development workflow rather than being documentation that developers have to remember to maintain separately.

## What Texo Is NOT

Texo should initially avoid becoming:

- A full IDE
    
- A coding agent
    
- A GitHub code indexer
    
- A source-code search engine
    
- An AI wrapper
    
- A repository hosting platform
    
- A replacement for coding agents
    
- A low-level AST/code intelligence platform
    

Texo should work **with** existing coding agents rather than competing with them.

The agent already has access to the repository and already has an LLM.

There is little reason for Texo to duplicate that infrastructure.

## Product Philosophy

The fundamental idea is:

> **Agents understand code. Texo remembers architecture.**

The coding agent handles reasoning about the repository.

Texo provides persistent, structured knowledge about how the system fits together.

That creates three useful layers:

```
CODE
Implementation truth
      ↑
      │
AGENT
Understands and modifies code
      ↕
      │ MCP
      ↕
TEXO
Persistent architecture context
      ↕
      │
DEVELOPER
Designs and understands the system
```

## Initial MVP

The first version should stay focused.

A user should be able to:

1. Create a Texo project.
    
2. Build architecture diagrams manually on a visual canvas.
    
3. Create components such as services, databases, caches, queues, APIs, and external systems.
    
4. Connect those components with typed relationships.
    
5. Click a component to inspect its responsibilities, dependencies, interfaces, decisions, and code references.
    
6. Connect Texo's MCP server to their coding agent.
    
7. Allow the agent to read the architecture.
    
8. Allow the agent to create and modify architecture components and relationships.
    
9. See agent-created changes immediately reflected on the canvas.
    

The killer first-run experience should be:

```
Create Texo Project
        ↓
Connect MCP
        ↓
Open coding agent
        ↓
"Analyze this repo and build its
 architecture in Texo."
        ↓
Agent examines local code
        ↓
Agent calls Texo MCP tools
        ↓
Architecture appears in Texo
```

Texo itself never needed access to the repository or an LLM.

## Longer-Term Vision

Texo could eventually become the **architecture context layer for agentic software development**.

As teams run more coding agents, those agents need more than raw source code. They need persistent context about:

- System boundaries
    
- Responsibilities
    
- Dependencies
    
- Interfaces
    
- Architectural constraints
    
- Technical decisions
    
- Ownership
    
- Intended system design
    

Instead of every agent repeatedly reconstructing this information from thousands of files, agents can query Texo.

That makes the architecture model useful not only as documentation, but as **machine-readable context for software agents**.

The long-term product isn't simply:

> Better architecture diagrams.

It's:

> **A shared model of a software system that humans and agents can work from together.**