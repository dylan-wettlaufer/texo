import Link from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ArchitectureNode, Diagram } from "@/lib/architecture/types";
import type { ExplorationModel, PreparedAnnotation, PreparedFunction, PreparedStep } from "@/lib/exploration/types";
import { matchesInteraction } from "@/lib/exploration/navigation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="explanation-section"><h3>{title}</h3>{children}</section>;
}
function List({ values }: { values: string[] }) {
  return <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>;
}

export function ExplorationContext({ model, fn, functionRequested, annotation, annotationRequested, step, stepRequested, catalogue, diagram, diagrams, onFunction, onStep, onOverview }: {
  model: ExplorationModel;
  fn?: PreparedFunction;
  functionRequested?: string;
  annotation?: PreparedAnnotation;
  annotationRequested: boolean;
  step?: PreparedStep;
  stepRequested?: string;
  catalogue: ArchitectureNode[];
  diagram: Diagram;
  diagrams: Diagram[];
  onFunction: (id: string, annotationId?: string) => void;
  onStep: (functionId: string, stepId: string) => void;
  onOverview: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (stepRequested || annotationRequested) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.closest<HTMLElement>(".explorer-context")?.scrollTo({ top: 0 });
  }, [fn?.id, functionRequested, stepRequested, annotationRequested]);
  useLayoutEffect(() => {
    if (!stepRequested && !annotationRequested) return;
    const heading = detailRef.current;
    heading?.focus({ preventScroll: true });
    const region = heading?.closest<HTMLElement>(".explorer-context");
    if (heading && region && region.getClientRects().length) {
      region.scrollTo({ top: region.scrollTop + heading.getBoundingClientRect().top - region.getBoundingClientRect().top - 16 });
    }
  }, [stepRequested, annotationRequested, annotation?.id]);
  if (!fn && functionRequested) return <div className="exploration-explanation"><h2 ref={headingRef} tabIndex={-1}>Function unavailable</h2><p role="status">No function record is available for {functionRequested} in this file.</p></div>;
  if (!fn) return <div className="exploration-explanation"><h2 ref={headingRef} tabIndex={-1}>Explore an implementation</h2><p>Select a file or function to connect its source code to the architecture.</p></div>;
  const detailRequested = Boolean(stepRequested || annotationRequested);
  const detail = step?.explanation ?? (annotation ? { does: annotation.does, why: annotation.why } : undefined);
  const interactions = detailRequested ? step?.interactions ?? annotation?.interactions ?? [] : fn.interactions;
  const name = (id: string) => catalogue.find((node) => node.id === id)?.name ?? `${id} (component unavailable)`;
  const functionLinks = (ids: string[], empty: string) => ids.length ? <ul className="explanation-links">{ids.map((id) => {
    const related = model.functions.find((candidate) => candidate.id === id);
    return <li key={id}><Button variant="ghost" onClick={() => onFunction(id)}>{related?.name ?? id}(){!related && " — Function unavailable"}</Button></li>;
  })}</ul> : <p className="inspector-empty">{empty}</p>;
  const connections = <Section title="Architecture connections">
    {interactions.length ? <ul className="architecture-interactions">{interactions.map((interaction, index) => {
      const shown = diagram.edges.some((edge) => matchesInteraction(edge, [interaction]));
      const availableDiagram = diagrams.find((candidate) => candidate.edges.some((edge) => matchesInteraction(edge, [interaction])));
      return <li key={`${interaction.source}-${interaction.target}-${index}`}><strong>{name(interaction.source)} → {name(interaction.target)}</strong><p>{interaction.description}</p>{!shown && <small>Not shown in this diagram.{availableDiagram && <> <Link href={`/projects/${diagram.projectId}/diagrams/${availableDiagram.id}`}>Open {availableDiagram.name}</Link></>}</small>}</li>;
    })}</ul> : <p className="inspector-empty">This step runs within its highlighted component; no directed architecture connection is documented.</p>}
  </Section>;
  return <div className="exploration-explanation">
    <h2 ref={headingRef} tabIndex={-1}>{fn.name}()</h2>
    {fn.unavailableReason && <p role="status" className="source-unavailable">{fn.unavailableReason}</p>}
    <p className="function-purpose">{fn.purpose}</p>
    <Section title="Implementation steps"><ol className="implementation-steps">{fn.steps.map((candidate, index) => <li key={candidate.id}>
      <Button variant="ghost" aria-current={step?.id === candidate.id ? "step" : undefined} onClick={() => onStep(fn.id, candidate.id)}>
        <span className="implementation-step-number" aria-hidden="true">{index + 1}.</span>
        <span className="implementation-step-copy"><span className="implementation-step-title">{candidate.title}</span><span className="implementation-step-meta"><small>{candidate.range ? `Lines ${candidate.range.startLine}–${candidate.range.endLine}` : "Source range unavailable"}</small>{step?.id === candidate.id && <span className="implementation-step-selected">Selected</span>}</span></span>
      </Button>
    </li>)}</ol></Section>
    {detailRequested && <section className="selected-step-explanation" aria-label="Selected implementation step" aria-live="polite">
      <h2 ref={detailRef} tabIndex={-1}>{step?.title ?? annotation?.title ?? "Step unavailable"}</h2>
      <Button variant="outline" size="sm" onClick={onOverview}>Return to function overview</Button>
      {((stepRequested && !step) || step?.unavailableReason || (!step && !annotation?.range)) && <p role="status" className="source-unavailable">{step?.unavailableReason ?? annotation?.unavailableReason ?? "This step has no available source range."}</p>}
      {detail ? <><Section title="What this code does"><p>{detail.does}</p></Section><Section title="Why it is necessary"><p>{detail.why}</p></Section></> : <p>No detailed explanation has been authored for this step.</p>}
      {connections}
    </section>}
    <Collapsible className="explanation-details">
      <CollapsibleTrigger asChild><Button variant="ghost" className="explorer-section-trigger">Details<ChevronDown aria-hidden="true" /></Button></CollapsibleTrigger>
      <CollapsibleContent>
        <Section title="Inputs"><List values={fn.inputs} /></Section>
        <Section title="Outputs"><List values={fn.outputs} /></Section>
        <Section title="Side effects"><List values={fn.sideEffects} /></Section>
        <Section title="Called by">{functionLinks(model.functions.filter((candidate) => candidate.calleeIds.includes(fn.id)).map((candidate) => candidate.id), "No callers documented in this demo. Entry points may be invoked by HTTP requests or provider events.")}</Section>
        <Section title="Calls">{functionLinks(fn.calleeIds, "No linked application functions. External adapter calls are described in the source and steps above.")}</Section>
        {!detailRequested && connections}
        {model.flows.filter((flow) => flow.steps.some((flowStep) => flowStep.functionId === fn.id)).map((flow) => <Section key={flow.id} title={`Feature flow · ${flow.name}`}>
          <p className="inspector-empty">{flow.description}</p>
          <ol className="feature-flow">{flow.steps.map((flowStep, index) => <li key={`${index}-${flowStep.title}`}><Button variant="ghost" aria-current={flowStep.functionId === fn.id && flowStep.annotationId === annotation?.id ? "step" : undefined} onClick={() => onFunction(flowStep.functionId, flowStep.annotationId)}>{flowStep.title}</Button><p>{flowStep.description}</p></li>)}</ol>
        </Section>)}
      </CollapsibleContent>
    </Collapsible>
  </div>;
}
