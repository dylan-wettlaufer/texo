"use client";

import { useMemo, useRef, useState } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { projectNodeCatalogue } from "@/lib/architecture/node-details";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { NodeInspector } from "./node-inspector";

export function ArchitectureWorkspace({ project, diagram, diagrams }: { project: Project; diagram: Diagram; diagrams: Diagram[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const catalogue = useMemo(() => projectNodeCatalogue(diagrams), [diagrams]);
  const triggerRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  function selectNode(id: string, trigger?: HTMLElement) {
    if (trigger) triggerRef.current = trigger;
    setSelectedId(id);
  }
  function closeInspector() {
    setSelectedId(null);
    // Related nodes may not be present on this diagram; restore the original trigger.
    (triggerRef.current?.isConnected ? triggerRef.current : workspaceRef.current)?.focus({ preventScroll: true });
  }
  return (
    <section ref={workspaceRef} tabIndex={-1} className={`architecture-workspace${selectedId ? " has-inspector" : ""}`} aria-label="Architecture workspace" onKeyDown={(event) => { if (event.key === "Escape" && selectedId) { event.stopPropagation(); closeInspector(); } }}>
      <DiagramCanvas diagram={diagram} selectedId={selectedId} onSelect={selectNode} />
      <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
      <div className="workspace-theme"><ThemeToggle /></div>
      <NodeInspector node={catalogue.find((node) => node.id === selectedId)} catalogue={catalogue} onSelect={selectNode} onClear={closeInspector} />
    </section>
  );
}
