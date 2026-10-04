"use client";

import { useCallback, useRef, useState } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { diagramSize, fitScale } from "@/lib/architecture/geometry";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { CanvasControls } from "./canvas-controls";
import { NodeInspector } from "./node-inspector";

export function ArchitectureWorkspace({ project, diagram, diagrams }: { project: Project; diagram: Diagram; diagrams: Diagram[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.5);
  const [fitRevision, setFitRevision] = useState(0);
  const viewport = useRef({ width: 800, height: 580 });
  const autoFit = useRef(true);
  const resize = useCallback((size: { width: number; height: number }) => {
    viewport.current = size;
    if (autoFit.current) setScale(fitScale(size, diagramSize(diagram.nodes)));
  }, [diagram.nodes]);

  function fit() {
    autoFit.current = true;
    setScale(fitScale(viewport.current, diagramSize(diagram.nodes)));
    setFitRevision((current) => current + 1);
  }

  return (
    <section className="architecture-workspace" aria-label="Architecture workspace" onKeyDown={(event) => { if (event.key === "Escape") setSelectedId(null); }}>
      <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
      <div className="canvas-panel">
        <div className="canvas-toolbar"><span><span className="status-dot" />{diagram.type}</span><span>{diagram.nodes.length} nodes <span className="toolbar-separator">/</span> {diagram.edges.length} connections</span></div>
        <div className="canvas-container">
          <DiagramCanvas diagram={diagram} selectedId={selectedId} scale={scale} fitRevision={fitRevision} onSelect={setSelectedId} onResize={resize} />
          <CanvasControls scale={scale} onFit={fit} onZoom={(direction) => { autoFit.current = false; setScale((current) => Math.max(0.1, Math.min(1.8, current + direction * 0.1))); }} />
        </div>
        <div className="canvas-footer"><span className="legend-item"><i className="legend-dot application" />Application</span><span className="legend-item"><i className="legend-dot service" />Service</span><span className="legend-item"><i className="legend-dot storage" />Data store</span><span className="legend-item"><i className="legend-dot external" />External</span><span className="read-only-label">Exploration mode</span></div>
      </div>
      <NodeInspector node={diagram.nodes.find((node) => node.id === selectedId)} diagram={diagram} onSelect={setSelectedId} onClear={() => setSelectedId(null)} />
    </section>
  );
}
