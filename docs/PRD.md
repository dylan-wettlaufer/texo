#### Texo - Architecture context that moves with your code**

**The Problem:** Software architecture changes constantly, but architecture diagrams rarely do. Developers create system diagrams and flow charts early in a project, then abandon them as the codebase evolves. This leaves teams relying on outdated Confluence pages, screenshots, or their own knowledge to understand how a system works. Coding agents face a similar problem, often needing to search through large parts of a repository to understand architecture and flows.

**The Solution:**
- **In a line:** A living architecture workspace for codebases, built for both developers and AI coding agents.
- **Product:**
    - Connect a GitHub repository and automatically generate an initial architecture diagram.
    - Create and edit multiple diagrams for system architecture, service dependencies, data flows, and end-to-end flows.
    - Connect Claude Code, Cursor, or Codex through MCP to create, read, and update diagrams directly from an agent.
    - Give coding agents a structured view of the architecture so they can understand systems and flows without searching through the entire codebase.
    - Store diagrams in the cloud as a persistent source of architectural knowledge.
        
- **V1 Focus:** GitHub integration, AI-generated diagrams, visual editing, multiple diagram types, and MCP integration. No real-time collaboration or automatic architecture synchronization yet.
    
- **Tech Stack:**
    - **Frontend:** Next.js, React, TypeScript, React Flow, Tailwind, shadcn/ui
    - **Backend:** Next.js API, PostgreSQL, Drizzle
    - **Auth:** Clerk + GitHub
    - **Code Analysis:** Tree-sitter + LLM
    - **AI Integration:** MCP server (TypeScript)
    - **Deployment:** Vercel + managed PostgreSQL

