import type { ArchitectureNode, Diagram } from "@/lib/architecture/types";
import { kindLabels } from "./architecture-node";

export function NodeInspector({ node, diagram, onSelect, onClear }: { node?: ArchitectureNode; diagram: Diagram; onSelect: (id: string) => void; onClear: () => void }) {
  const incoming = diagram.edges.filter((edge) => edge.target === node?.id);
  const outgoing = diagram.edges.filter((edge) => edge.source === node?.id);
  return (
    <aside className="node-inspector" aria-label="Node inspector">
      <div className="panel-title"><h2>Inspector</h2>{node && <button className="icon-button" aria-label="Clear node selection" onClick={onClear}>×</button>}</div>
      {!node ? <div className="inspector-empty"><span className="empty-icon" aria-hidden="true">⌖</span><h3>A little more context</h3><p>Select a node to explore its role, technology, and connections.</p><div className="inspector-tip">Tip: use Tab to move between nodes and Enter to select one.</div></div> : <div className="inspector-content" aria-live="polite">
        <span className={`badge kind-badge node-${node.kind}`}>{kindLabels[node.kind]}</span>
        <h3>{node.name}</h3>
        <p>{node.description}</p>
        <div className="inspector-section"><h4>TECHNOLOGY</h4><span className="technology-value">{node.technology}</span></div>
        {([{ title: "Incoming", edges: incoming, direction: "source" }, { title: "Outgoing", edges: outgoing, direction: "target" }] as const).map(({ title, edges, direction }) => <div key={title} className="inspector-section"><h4>{title.toUpperCase()} CONNECTIONS <span>{edges.length}</span></h4>{edges.length ? edges.map((edge) => {
          const related = diagram.nodes.find((candidate) => candidate.id === edge[direction]);
          return <button key={edge.id} className="relationship" onClick={() => onSelect(edge[direction])}><strong>{related?.name}<span aria-hidden="true">↗</span></strong><small>{edge.label}</small></button>;
        }) : <p className="muted small-text">No {title.toLowerCase()} connections.</p>}</div>)}
      </div>}
    </aside>
  );
}
