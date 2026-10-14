"use client";

import { useMemo, useRef, useState } from "react";
import type { Diagram, Project } from "@/lib/architecture/types";
import { projectNodeCatalogue } from "@/lib/architecture/node-details";
import type { ExplorationHistory, ExplorationModel, ExplorationSelection, SourceReference } from "@/lib/exploration/types";
import { functionSelection, moveHistory, pushSelection, resolveSource, selectionContext, stepSelection } from "@/lib/exploration/navigation";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DiagramNavigator } from "./diagram-navigator";
import { DiagramCanvas } from "./diagram-canvas";
import { NodeInspector } from "./node-inspector";
import { CodeExplorer } from "./code-explorer";
import { ExplorationContext } from "./exploration-context";

export function ArchitectureWorkspace({ project, diagram, diagrams, exploration }: { project: Project; diagram: Diagram; diagrams: Diagram[]; exploration: ExplorationModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ExplorationHistory | null>(null);
  const [view, setView] = useState<"architecture" | "code">("architecture");
  const catalogue = useMemo(() => projectNodeCatalogue(diagrams), [diagrams]);
  const triggerRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const selection = history?.entries[history.index];
  const context = selection ? selectionContext(selection, exploration) : undefined;


  function selectNode(id: string, trigger?: HTMLElement) {
    if (trigger) triggerRef.current = trigger;
    setSelectedId(id);
  }
  function navigate(next: ExplorationSelection) {
    setHistory((previous) => pushSelection(previous, next));
    setView("code");
  }
  function openSource(reference: SourceReference) { navigate(resolveSource(reference, exploration)); }
  function selectFunction(id: string, annotationId?: string) { navigate(functionSelection(id, exploration, annotationId)); }
  function selectStep(functionId: string, stepId: string) { navigate(stepSelection(functionId, stepId, exploration)); }
  function returnToOverview() { if (selection?.functionId) selectFunction(selection.functionId); }
  function closeExploration() {
    const path = selection?.path;
    setView("architecture");
    requestAnimationFrame(() => {
      const entry = [...(workspaceRef.current?.querySelectorAll<HTMLElement>("[data-source-path]") ?? [])].find((element) => element.dataset.sourcePath === path);
      (entry ?? workspaceRef.current?.querySelector<HTMLElement>("#inspector-title") ?? workspaceRef.current)?.focus({ preventScroll: true });
    });
  }
  function closeInspector() {
    setSelectedId(null);
    (triggerRef.current?.isConnected ? triggerRef.current : workspaceRef.current)?.focus({ preventScroll: true });
  }
  function openExplorer() {
    if (selection) setView("code");
    else if (exploration.files[0]) openSource(exploration.files[0]);
  }
  const inspector = <NodeInspector node={catalogue.find((node) => node.id === selectedId)} catalogue={catalogue} edges={diagram.edges} onSelect={selectNode} onClear={closeInspector} onOpenSource={openSource} />;
  const explanation = (
    <ExplorationContext
      model={exploration} fn={context?.fn} functionRequested={selection?.functionId}
      annotation={context?.annotation} annotationRequested={Boolean(selection?.annotationId)}
      step={context?.step} stepRequested={selection?.stepId}
      catalogue={catalogue} diagram={diagram} diagrams={diagrams}
      onFunction={selectFunction} onStep={selectStep} onOverview={returnToOverview}
    />
  );
  return (
    <div className="diagram-workspace-shell">
      <AppSidebar projects={[project]} workspace={{ view, onArchitecture: closeExploration, onCode: openExplorer, codeAvailable: Boolean(selection || exploration.files.length) }} />
      <section ref={workspaceRef} tabIndex={-1} className={`architecture-workspace${view === "code" ? " is-exploring" : selectedId ? " has-inspector" : ""}`} aria-label={view === "code" ? "Code Explorer workspace" : "Architecture workspace"} onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (view === "code") { event.stopPropagation(); closeExploration(); }
        else if (selectedId) { event.stopPropagation(); closeInspector(); }
      }}>
        {view === "architecture" && <header className="workspace-header">
          <Breadcrumb aria-label="Workspace breadcrumbs"><BreadcrumbList>
            <BreadcrumbItem><Link href={`/projects/${project.id}`}>{project.name}</Link></BreadcrumbItem><BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Architecture</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList></Breadcrumb>
        </header>}
        {view === "code" && history && selection && <CodeExplorer
          model={exploration} selection={selection}
          onNavigate={navigate} onFunction={selectFunction} onStep={selectStep}
          onClose={closeExploration} history={history}
          onHistory={(delta) => setHistory((previous) => previous && moveHistory(previous, delta))}
          contextKey={`code:${selection.path}:${selection.functionId}`}
          context={explanation}
        />}
        <div className="workspace-architecture" hidden={view === "code"}>
          <div className="workspace-graph">
            <DiagramCanvas diagram={diagram} selectedId={selectedId} onSelect={selectNode} exploring={false} />
            <DiagramNavigator project={project} diagrams={diagrams} currentId={diagram.id} />
            <div className="workspace-theme"><ThemeToggle /></div>
          </div>
          {inspector}
        </div>
      </section>
    </div>
  );
}
