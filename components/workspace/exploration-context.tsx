import Link from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ArchitectureNode, Diagram } from "@/lib/architecture/types";
import type { ExplorationModel, Interaction, PreparedAnnotation, PreparedFunction } from "@/lib/exploration/types";
import { matchesInteraction } from "@/lib/exploration/navigation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="explanation-section"><h3>{title}</h3>{children}</section>;
}
function List({ values }: { values: string[] }) {
  return <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>;
}

export function ExplorationContext({ model, fn, functionRequested, annotation, annotationRequested, catalogue, diagram, diagrams, onFunction, onAnnotation, onOverview }: {
  model: ExplorationModel;
  fn?: PreparedFunction;
  functionRequested?: string;
  annotation?: PreparedAnnotation;
  annotationRequested: boolean;
  catalogue: ArchitectureNode[];
  diagram: Diagram;
  diagrams: Diagram[];
  onFunction: (id: string, annotationId?: string) => void;
  onAnnotation: (id: string) => void;
  onOverview: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [fn?.id, annotationRequested, annotation?.id, functionRequested]);
  if (!fn && functionRequested) return <div className="exploration-explanation"><h2 ref={headingRef} tabIndex={-1}>Function unavailable</h2><p role="status">No function record is available for {functionRequested} in this file.</p></div>;
  if (!fn) return <div className="exploration-explanation"><h2 ref={headingRef} tabIndex={-1}>Explore an implementation</h2><p>Select a file or function to connect its source code to the architecture.</p></div>;
  const interactions: Interaction[] = annotationRequested ? annotation?.interactions ?? [] : fn.interactions;
  const name = (id: string) => catalogue.find((node) => node.id === id)?.name ?? `${id} (component unavailable)`;
  const functionLinks = (ids: string[], empty: string) => ids.length ? <ul className="explanation-links">{ids.map((id) => {
    const related = model.functions.find((candidate) => candidate.id === id);
    return <li key={id}><Button variant="ghost" onClick={() => onFunction(id)}>{related?.name ?? id}(){!related && " — Function unavailable"}</Button></li>;
  })}</ul> : <p className="inspector-empty">{empty}</p>;
  return <div className="exploration-explanation" aria-live="polite">
    <p className="exploration-eyebrow">{annotationRequested ? "Code explanation" : "Function overview"} · Curated demo</p>
    <h2 ref={headingRef} tabIndex={-1}>{annotationRequested ? annotation?.title ?? "Annotation unavailable" : `${fn.name}()`}</h2>
    {(fn.unavailableReason || (annotationRequested && (!annotation?.range || annotation.unavailableReason))) && <p role="status" className="source-unavailable">{annotationRequested ? annotation?.unavailableReason ?? "Annotated source range unavailable." : fn.unavailableReason}</p>}
    {annotationRequested ? <>
      <Button variant="outline" size="sm" onClick={onOverview}>Return to function overview</Button>
      {annotation && <><Section title="What this code does"><p>{annotation.does}</p></Section><Section title="Why it exists"><p>{annotation.why}</p></Section></>}
    </> : <>
      <Section title="Purpose"><p>{fn.purpose}</p></Section>
      <Section title="Step-by-step behavior"><ol>{fn.behavior.map((step) => <li key={step}>{step}</li>)}</ol></Section>
      <Section title="Inputs"><List values={fn.inputs} /></Section>
      <Section title="Outputs"><List values={fn.outputs} /></Section>
      <Section title="Side effects"><List values={fn.sideEffects} /></Section>
      <Section title="Called by">{functionLinks(model.functions.filter((candidate) => candidate.calleeIds.includes(fn.id)).map((candidate) => candidate.id), "No callers documented in this demo. Entry points may be invoked by HTTP requests or provider events.")}</Section>
      <Section title="Calls">{functionLinks(fn.calleeIds, "No linked application functions. External adapter calls are described in the source and behavior above.")}</Section>
      <Section title="Code explanations"><ul className="explanation-links">{model.annotations.filter((candidate) => candidate.functionId === fn.id).map((candidate) => <li key={candidate.id}><Button variant="ghost" onClick={() => onAnnotation(candidate.id)}>{candidate.title}{!candidate.range && " — Range unavailable"}</Button></li>)}</ul></Section>
    </>}
    <Section title="Architecture connections">
      {interactions.length ? <ul className="architecture-interactions">{interactions.map((interaction, index) => {
        const shown = diagram.edges.some((edge) => matchesInteraction(edge, [interaction]));
        const availableDiagram = diagrams.find((candidate) => candidate.edges.some((edge) => matchesInteraction(edge, [interaction])));
        return <li key={`${interaction.source}-${interaction.target}-${index}`}><strong>{name(interaction.source)} → {name(interaction.target)}</strong><p>{interaction.description}</p>{!shown && <small>Not shown in this diagram.{availableDiagram && <> <Link href={`/projects/${diagram.projectId}/diagrams/${availableDiagram.id}`}>Open {availableDiagram.name}</Link></>}</small>}</li>;
      })}</ul> : <p className="inspector-empty">No architecture connections documented for this range.</p>}
    </Section>
    {model.flows.filter((flow) => flow.steps.some((step) => step.functionId === fn.id)).map((flow) => <Section key={flow.id} title={`Feature flow · ${flow.name}`}>
      <p className="inspector-empty">{flow.description}</p>
      <ol className="feature-flow">{flow.steps.map((step, index) => <li key={`${index}-${step.title}`}><Button variant="ghost" aria-current={step.functionId === fn.id && step.annotationId === annotation?.id ? "step" : undefined} onClick={() => onFunction(step.functionId, step.annotationId)}>{step.title}</Button><p>{step.description}</p></li>)}</ol>
    </Section>)}
  </div>;
}
