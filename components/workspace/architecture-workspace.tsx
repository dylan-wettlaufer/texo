"use client";

import { useState } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { NodeInspector } from "./node-inspector";

export function ArchitectureWorkspace({ project, diagram, diagrams }: { project: Project; diagram: Diagram; diagrams: Diagram[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <section className="architecture-workspace" aria-label="Architecture workspace" onKeyDown={(event) => { if (event.key === "Escape") setSelectedId(null); }}>
      <DiagramCanvas diagram={diagram} selectedId={selectedId} onSelect={setSelectedId} />
      <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
      <div className="workspace-theme"><ThemeToggle /></div>
      <NodeInspector node={diagram.nodes.find((node) => node.id === selectedId)} diagram={diagram} onSelect={setSelectedId} onClear={() => setSelectedId(null)} />
    </section>
  );
}
