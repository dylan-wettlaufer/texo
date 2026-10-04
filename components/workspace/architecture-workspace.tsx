"use client";

import { useState } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { NodeInspector } from "./node-inspector";

export function ArchitectureWorkspace({ project, diagram, diagrams }: { project: Project; diagram: Diagram; diagrams: Diagram[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <section className="architecture-workspace" aria-label="Architecture workspace" onKeyDown={(event) => { if (event.key === "Escape") setSelectedId(null); }}>
      <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
      <div className="canvas-panel">
        <div className="canvas-toolbar"><span><span className="status-dot" />{diagram.type}</span><span>{diagram.nodes.length} nodes <span className="toolbar-separator">/</span> {diagram.edges.length} connections</span></div>
        <div className="canvas-container">
          <DiagramCanvas diagram={diagram} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="canvas-footer"><span className="legend-item"><i className="legend-dot application" />Application</span><span className="legend-item"><i className="legend-dot service" />Service</span><span className="legend-item"><i className="legend-dot storage" />Data store</span><span className="legend-item"><i className="legend-dot external" />External</span><span className="read-only-label">Drag to arrange</span></div>
      </div>
      <NodeInspector node={diagram.nodes.find((node) => node.id === selectedId)} diagram={diagram} onSelect={setSelectedId} onClear={() => setSelectedId(null)} />
    </section>
  );
}
