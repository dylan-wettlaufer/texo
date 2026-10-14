import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, FolderOpen } from "lucide-react";
import { SourceViewer } from "./source-viewer";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { selectionContext, stepAtLine } from "@/lib/exploration/navigation";
import type { ExplorationHistory, ExplorationModel, ExplorationSelection } from "@/lib/exploration/types";

export function CodeExplorer({ model, selection, onNavigate, onFunction, onStep, onClose, context, contextKey, history, onHistory }: {
  model: ExplorationModel;
  selection: ExplorationSelection;
  onNavigate: (selection: ExplorationSelection) => void;
  onFunction: (id: string, annotationId?: string) => void;
  onStep: (functionId: string, stepId: string) => void;
  onClose: () => void;
  context: ReactNode;
  contextKey: string;
  history: ExplorationHistory;
  onHistory: (delta: number) => void;
}) {
  const { file, fn, range } = selectionContext(selection, model);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [explanationOpen, setExplanationOpen] = useState(true);
  const sourceRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const functions = model.functions.filter((candidate) => candidate.fileId === file?.id);
  const fileId = file?.id;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [fileId, selection.directory, selection.path]);
  function activateCodeStep(functionId: string, stepId: string) {
    setExplanationOpen(true);
    onStep(functionId, stepId);
  }
  return <section className="code-explorer" aria-label="Code exploration">
    <header className="explorer-header">
      <div className="explorer-toolbar">
        <h2 ref={headingRef} tabIndex={-1} title={selection.path}>{selection.path}</h2>
        <Button variant="outline" size="sm" onClick={onClose}><ArrowLeft aria-hidden="true" />Back to architecture</Button>
      </div>
      <div className="explorer-pickers">
        <label>File<select aria-label="Explore source file" value={file?.id ?? ""} onChange={(event) => {
          const next = model.files.find((candidate) => candidate.id === event.target.value);
          if (next) onNavigate({ path: next.path, fileId: next.id, functionId: model.functions.find((candidate) => candidate.fileId === next.id)?.id });
        }}><option value="" disabled>Select a file</option>{model.files.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.path}</option>)}</select></label>
        {file && <label>Function<select aria-label="Select function" value={fn?.id ?? ""} onChange={(event) => onFunction(event.target.value)}><option value="" disabled>{functions.length ? "Select a function" : "No functions in this file"}</option>{functions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}()</option>)}</select></label>}
        <div className="explorer-history">
          <Button variant="outline" size="icon-sm" aria-label="Exploration back" disabled={history.index === 0} onClick={() => onHistory(-1)}><ArrowLeft aria-hidden="true" /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Exploration forward" disabled={history.index === history.entries.length - 1} onClick={() => onHistory(1)}><ArrowRight aria-hidden="true" /></Button>
        </div>
      </div>
    </header>
    <div className="explorer-panes">
    <Collapsible open={sourceOpen} onOpenChange={setSourceOpen} className="explorer-section explorer-source-section">
      <CollapsibleTrigger asChild><Button variant="ghost" className="explorer-section-trigger">Source code<ChevronDown aria-hidden="true" /></Button></CollapsibleTrigger>
      <CollapsibleContent forceMount asChild>
        <div ref={sourceRef} className="code-scroll" tabIndex={0} role="region" aria-label="Source code">
      {selection.directory ? <div className="source-file-chooser"><FolderOpen aria-hidden="true" /><h3>Payment integration files</h3>{model.files.filter((candidate) => candidate.path.startsWith(selection.path)).map((candidate) => <Button key={candidate.id} variant="outline" onClick={() => onNavigate({ path: candidate.path, fileId: candidate.id, functionId: model.functions.find((record) => record.fileId === candidate.id)?.id })}><span>{candidate.path.split("/").pop()}<small>{candidate.description}</small></span></Button>)}{!model.files.some((candidate) => candidate.path.startsWith(selection.path)) && <p role="status">No source files available for this directory.</p>}</div>
        : file ? <SourceViewer lines={file.lines} declarations={functions} range={range} scrollKey={`${file.id}:${selection.annotationId}:${selection.stepId}`} scrollRef={sourceRef} visible={sourceOpen} onDeclaration={onFunction} annotationAtLine={(line) => {
          const annotated = stepAtLine(file.id, line, model);
          return annotated ? { label: `Explain ${annotated.step.title}, line ${line}`, active: annotated.fn.id === selection.functionId && annotated.step.id === selection.stepId, marker: annotated.step.range?.startLine === line, activate: () => activateCodeStep(annotated.fn.id, annotated.step.id) } : undefined;
        }} /> : <div className="source-file-chooser"><h3>Source unavailable</h3><p role="status">This path is a documentation reference without sample source. Choose an available file to explore.</p></div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
    <Collapsible open={explanationOpen} onOpenChange={setExplanationOpen} className="explorer-section explorer-explanation-section">
      <CollapsibleTrigger asChild><Button variant="ghost" className="explorer-section-trigger">Explanation<ChevronDown aria-hidden="true" /></Button></CollapsibleTrigger>
      <CollapsibleContent forceMount asChild>
        <div key={contextKey} className="explorer-context" tabIndex={0} role="region" aria-label="Interactive explanation">{context}</div>
      </CollapsibleContent>
    </Collapsible>
    </div>
  </section>;
}
