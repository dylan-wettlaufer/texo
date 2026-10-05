import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArchitectureNode, Diagram } from "@/lib/architecture/types";
import { kindLabels } from "./architecture-node";

export function NodeInspector({ node, diagram, onSelect, onClear }: { node?: ArchitectureNode; diagram: Diagram; onSelect: (id: string) => void; onClear: () => void }) {
  if (!node) return null;
  const incoming = diagram.edges.filter((edge) => edge.target === node.id);
  const outgoing = diagram.edges.filter((edge) => edge.source === node.id);
  return (
    <aside className="node-inspector" aria-label="Node details">
      <Button variant="ghost" size="icon-sm" className="inspector-close" aria-label="Close node details" title="Close node details" onClick={onClear}>×</Button>
      <div className="inspector-content" aria-live="polite">
        <Badge variant="secondary" className={`badge kind-badge node-${node.kind}`}>{kindLabels[node.kind]}</Badge>
        <h3>{node.name}</h3>
        <p>{node.description}</p>
        <div className="inspector-section"><h4>TECHNOLOGY</h4><span className="technology-value">{node.technology}</span></div>
        {([{ title: "Incoming", edges: incoming, direction: "source" }, { title: "Outgoing", edges: outgoing, direction: "target" }] as const).map(({ title, edges, direction }) => edges.length > 0 && <div key={title} className="inspector-section"><h4>{title.toUpperCase()} CONNECTIONS <span>{edges.length}</span></h4>{edges.map((edge) => {
          const related = diagram.nodes.find((candidate) => candidate.id === edge[direction]);
          return <Button variant="ghost" key={edge.id} className="relationship" onClick={() => onSelect(edge[direction])}><strong>{related?.name}<span aria-hidden="true">↗</span></strong><small>{edge.label}</small></Button>;
        })}</div>)}
      </div>
    </aside>
  );
}
