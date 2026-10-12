"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { projectNodeCatalogue } from "@/lib/architecture/node-details";
import type { ExplorationHistory, ExplorationModel, ExplorationSelection, SourceReference } from "@/lib/exploration/types";
import { functionSelection, pushSelection, resolveSource, selectionContext } from "@/lib/exploration/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { NodeInspector } from "./node-inspector";
import { CodeExplorer } from "./code-explorer";
import { ExplorationContext } from "./exploration-context";
import { ExplorationDivider } from "./exploration-divider";

export function ArchitectureWorkspace({ project, diagram, diagrams, exploration }: { project: Project; diagram: Diagram; diagrams: Diagram[]; exploration: ExplorationModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ExplorationHistory | null>(null);
  const [componentContext, setComponentContext] = useState(false);
  const [split, setSplit] = useState(60);
  const catalogue = useMemo(() => projectNodeCatalogue(diagrams), [diagrams]);
  const triggerRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const selection = history?.entries[history.index];
  const context = selection ? selectionContext(selection, exploration) : undefined;
  const focused = Boolean(history && !componentContext && context?.fn);
  const interactions = focused ? (selection?.annotationId ? context?.annotation?.interactions ?? [] : context?.fn?.interactions ?? []) : undefined;
  const focusedNodeIds = focused ? [...new Set([...(context?.fn?.componentIds ?? []), ...(interactions ?? []).flatMap((interaction) => [interaction.source, interaction.target])])] : undefined;

  function selectNode(id: string, trigger?: HTMLElement) {
    if (trigger) triggerRef.current = trigger;
    setSelectedId(id);
    if (history) setComponentContext(true);
  }
  function navigate(next: ExplorationSelection) {
    setHistory((previous) => pushSelection(previous, next));
    setComponentContext(false);
  }
  function openSource(reference: SourceReference) { navigate(resolveSource(reference, exploration)); }
  function selectFunction(id: string, annotationId?: string) { navigate(functionSelection(id, exploration, annotationId)); }
  function selectAnnotation(id: string) {
    const annotation = exploration.annotations.find((candidate) => candidate.id === id);
    if (annotation) selectFunction(annotation.functionId, id);
  }
  function returnToOverview() { if (selection?.functionId) selectFunction(selection.functionId); }
  function closeExploration() {
    const path = selection?.path;
    setHistory(null);
    setComponentContext(false);
    requestAnimationFrame(() => {
      const entry = [...(workspaceRef.current?.querySelectorAll<HTMLElement>("[data-source-path]") ?? [])].find((element) => element.dataset.sourcePath === path);
      (entry ?? workspaceRef.current?.querySelector<HTMLElement>("#inspector-title") ?? workspaceRef.current)?.focus({ preventScroll: true });
    });
  }
  function closeInspector() {
    setSelectedId(null);
    (triggerRef.current?.isConnected ? triggerRef.current : workspaceRef.current)?.focus({ preventScroll: true });
  }
  const inspector = <NodeInspector node={catalogue.find((node) => node.id === selectedId)} catalogue={catalogue} edges={diagram.edges} onSelect={selectNode} onClear={history ? () => setComponentContext(false) : closeInspector} onOpenSource={openSource} />;
  const explanation = componentContext ? (
    <div className="component-exploration-context">
      {selection?.functionId && <Button variant="ghost" className="return-to-code" onClick={returnToOverview}>Return to function overview</Button>}
      {inspector}
    </div>
  ) : (
    <ExplorationContext
      model={exploration} fn={context?.fn} functionRequested={selection?.functionId}
      annotation={context?.annotation} annotationRequested={Boolean(selection?.annotationId)}
      catalogue={catalogue} diagram={diagram} diagrams={diagrams}
      onFunction={selectFunction} onAnnotation={selectAnnotation} onOverview={returnToOverview}
    />
  );
  return (
    <section ref={workspaceRef} tabIndex={-1} style={{ "--code-share": `${split}fr`, "--graph-share": `${100 - split}fr` } as CSSProperties} className={`architecture-workspace${history ? " is-exploring" : selectedId ? " has-inspector" : ""}`} aria-label="Architecture workspace" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (history) { event.stopPropagation(); closeExploration(); }
      else if (selectedId) { event.stopPropagation(); closeInspector(); }
    }}>
      {history && selection && <CodeExplorer
        model={exploration} selection={selection}
        onNavigate={navigate} onFunction={selectFunction} onAnnotation={selectAnnotation}
        onClose={closeExploration}
        contextKey={componentContext ? `component:${selectedId}` : `code:${selection.path}:${selection.functionId}:${selection.annotationId}`}
        context={explanation}
      />}
      {history && <ExplorationDivider value={split} onChange={setSplit} container={workspaceRef} />}
      <div className="workspace-graph">
        <DiagramCanvas diagram={diagram} selectedId={selectedId} onSelect={selectNode} exploring={Boolean(history)} interactions={interactions} focusedNodeIds={focusedNodeIds} />
        <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
        <div className="workspace-theme"><ThemeToggle /></div>
      </div>
      {!history && inspector}
    </section>
  );
}
