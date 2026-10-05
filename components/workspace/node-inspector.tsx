import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArchitectureNode } from "@/lib/architecture/types";
import { nodeRelationships } from "@/lib/architecture/node-details";
import { kindLabels } from "./architecture-node";

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="inspector-section"><h4>{title}</h4>{children}</section>;
}

function DetailList({ values, empty, code = false }: { values?: string[]; empty: string; code?: boolean }) {
  if (!values) return <p className="inspector-empty">Not documented.</p>;
  if (values.length === 0) return <p className="inspector-empty">{empty}</p>;
  return <ul className={`inspector-list${code ? " inspector-code" : ""}`}>{values.map((value, index) => <li key={`${index}-${value}`}>{code ? <code>{value}</code> : value}</li>)}</ul>;
}

export function NodeInspector({ node, catalogue, onSelect, onClear }: { node?: ArchitectureNode; catalogue: ArchitectureNode[]; onSelect: (id: string) => void; onClear: () => void }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const nodeId = node?.id;

  useLayoutEffect(() => {
    if (nodeId) headingRef.current?.focus({ preventScroll: true });
  }, [nodeId]);

  if (!node) return null;
  const { dependencies, consumers } = nodeRelationships(node, catalogue);
  return (
    <aside className="node-inspector" aria-labelledby="inspector-title">
      <header className="inspector-header">
        <h2 ref={headingRef} id="inspector-title" tabIndex={-1}>Node details</h2>
        <Button variant="ghost" size="icon" className="inspector-close" aria-label="Close node details" title="Close node details" onClick={onClear}><X aria-hidden="true" /></Button>
      </header>
      <div key={node.id} className="inspector-content" tabIndex={0} aria-label={`${node.name} details`}>
        <Badge variant="secondary" className={`badge kind-badge node-${node.kind}`}>{kindLabels[node.kind]}</Badge>
        <h3 className="inspector-node-name" aria-live="polite">{node.name}</h3>
        <InspectorSection title="Responsibility"><p>{node.description || "Not documented."}</p></InspectorSection>
        <InspectorSection title="Depends On">
          {dependencies === undefined ? <p className="inspector-empty">Not documented.</p> : dependencies.length === 0 ? <p className="inspector-empty">No dependencies.</p> : dependencies.map(({ id, node: related }) => related
            ? <Button variant="ghost" key={id} className="relationship" onClick={() => onSelect(id)}><strong>{related.name}<span aria-hidden="true">↗</span></strong><small>{kindLabels[related.kind]}</small></Button>
            : <p key={id} className="inspector-empty">{id} — Node unavailable.</p>)}
        </InspectorSection>
        <InspectorSection title="Used By">
          {consumers === undefined ? <p className="inspector-empty">Not documented.</p> : consumers.length === 0 ? <p className="inspector-empty">No consumers.</p> : consumers.map((related) => <Button variant="ghost" key={related.id} className="relationship" onClick={() => onSelect(related.id)}><strong>{related.name}<span aria-hidden="true">↗</span></strong><small>{kindLabels[related.kind]}</small></Button>)}
        </InspectorSection>
        <InspectorSection title="Interfaces"><DetailList values={node.interfaces} empty="No interfaces." /></InspectorSection>
        <InspectorSection title="Technologies"><DetailList values={node.technologies ?? (node.technology ? [node.technology] : undefined)} empty="No technologies." /></InspectorSection>
        <InspectorSection title="Architecture Decisions"><DetailList values={node.architectureDecisions} empty="No architectural decisions recorded." /></InspectorSection>
        <InspectorSection title="Relevant Files or Directories"><DetailList values={node.codeReferences} empty="No code references." code /></InspectorSection>
        <InspectorSection title="Notes and Metadata">
          <p>{node.notes === undefined ? "Notes not documented." : node.notes || "No notes."}</p>
          {node.metadata === undefined ? <p className="inspector-empty">Metadata not documented.</p> : Object.keys(node.metadata).length === 0 ? <p className="inspector-empty">No metadata.</p> : <dl className="inspector-metadata">{Object.entries(node.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
        </InspectorSection>
      </div>
    </aside>
  );
}
