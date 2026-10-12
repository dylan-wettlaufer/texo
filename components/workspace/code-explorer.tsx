import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectionContext } from "@/lib/exploration/navigation";
import type { ExplorationHistory, ExplorationModel, ExplorationSelection } from "@/lib/exploration/types";

export function CodeExplorer({ model, selection, history, onNavigate, onFunction, onAnnotation, onHistory, onClose, context, contextKey }: {
  model: ExplorationModel;
  selection: ExplorationSelection;
  history: ExplorationHistory;
  onNavigate: (selection: ExplorationSelection) => void;
  onFunction: (id: string, annotationId?: string) => void;
  onAnnotation: (id: string) => void;
  onHistory: (delta: number) => void;
  onClose: () => void;
  context: ReactNode;
  contextKey: string;
}) {
  const { file, fn, range } = selectionContext(selection, model);
  const sourceRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const functions = model.functions.filter((candidate) => candidate.fileId === file?.id);
  const annotations = model.annotations.filter((candidate) => functions.some((record) => record.id === candidate.functionId));
  const fileId = file?.id;
  const startLine = range?.startLine;
  const endLine = range?.endLine;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [fileId, selection.directory, selection.path]);
  useEffect(() => {
    if (!startLine) return;
    const frame = requestAnimationFrame(() => {
      const row = sourceRef.current?.querySelector<HTMLElement>(`[data-line="${startLine}"]`);
      if (row && sourceRef.current) sourceRef.current.scrollTo({ top: Math.max(0, row.offsetTop - 24), behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [fileId, startLine, endLine, selection.annotationId]);
  return <section className="code-explorer" aria-label="Code exploration">
    <header className="explorer-header">
      <div className="explorer-toolbar">
        <Button variant="ghost" size="icon-sm" aria-label="Exploration back" disabled={history.index === 0} onClick={() => onHistory(-1)}><ArrowLeft aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Exploration forward" disabled={history.index === history.entries.length - 1} onClick={() => onHistory(1)}><ArrowRight aria-hidden="true" /></Button>
        <span className="exploration-eyebrow">Example source · Read only</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close code exploration" onClick={onClose}><X aria-hidden="true" /></Button>
      </div>
      <h2 ref={headingRef} tabIndex={-1} title={selection.path}>{selection.path}</h2>
      <div className="explorer-pickers">
        <label>File<select aria-label="Explore source file" value={file?.id ?? ""} onChange={(event) => {
          const next = model.files.find((candidate) => candidate.id === event.target.value);
          if (next) onNavigate({ path: next.path, fileId: next.id, functionId: model.functions.find((candidate) => candidate.fileId === next.id)?.id });
        }}><option value="" disabled>Select a file</option>{model.files.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.path}</option>)}</select></label>
        {file && <label>Function<select aria-label="Select function" value={fn?.id ?? ""} onChange={(event) => onFunction(event.target.value)}><option value="" disabled>{functions.length ? "Select a function" : "No functions in this file"}</option>{functions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}()</option>)}</select></label>}
      </div>
    </header>
    <div ref={sourceRef} className="code-scroll" tabIndex={0} role="region" aria-label="Source code">
      {selection.directory ? <div className="source-file-chooser"><FolderOpen aria-hidden="true" /><h3>Payment integration files</h3>{model.files.filter((candidate) => candidate.path.startsWith(selection.path)).map((candidate) => <Button key={candidate.id} variant="outline" onClick={() => onNavigate({ path: candidate.path, fileId: candidate.id, functionId: model.functions.find((record) => record.fileId === candidate.id)?.id })}><span>{candidate.path.split("/").pop()}<small>{candidate.description}</small></span></Button>)}{!model.files.some((candidate) => candidate.path.startsWith(selection.path)) && <p role="status">No source files available for this directory.</p>}</div>
        : file ? <div className="source-lines">{file.lines.map((line) => {
          const declaration = functions.find((candidate) => candidate.range?.startLine === line.number);
          const markers = annotations.filter((candidate) => candidate.range?.startLine === line.number);
          const highlighted = range && line.number >= range.startLine && line.number <= range.endLine;
          const tokens = line.tokens.map((token, index) => <span key={index} className={`syntax-${token.kind}`}>{token.text}</span>);
          return <div key={line.number} data-line={line.number} className={`source-line${highlighted ? " is-highlighted" : ""}`}>
            <span className="line-number" aria-hidden="true">{line.number}</span>
            <span className="code-markers">{markers.map((marker) => <button key={marker.id} type="button" aria-label={`Explain: ${marker.title}`} title={marker.title} aria-pressed={selection.annotationId === marker.id} onClick={() => onAnnotation(marker.id)}>●</button>)}</span>
            <code>{declaration ? <button className="code-declaration" type="button" aria-label={`Explore ${declaration.name}`} onClick={() => onFunction(declaration.id)}>{tokens}</button> : tokens}</code>
          </div>;
        })}</div> : <div className="source-file-chooser"><h3>Source unavailable</h3><p role="status">This path is a documentation reference without sample source. Choose an available file to explore.</p></div>}
    </div>
    <div key={contextKey} className="explorer-context" tabIndex={0} role="region" aria-label="Interactive explanation">{context}</div>
  </section>;
}
