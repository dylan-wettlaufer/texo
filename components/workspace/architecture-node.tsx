import type { ArchitectureNode as Node } from "@/lib/architecture/types";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/architecture/geometry";

export const kindLabels = { application: "Application", service: "Service", storage: "Data store", external: "External service" };
const kindIcons = { application: "▦", service: "⌘", storage: "▤", external: "↗" };

export function ArchitectureNode({ node, selected, onSelect }: { node: Node; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      className={`architecture-node node-${node.kind} ${selected ? "selected" : ""}`}
      style={{ left: node.position.x, top: node.position.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      aria-label={`${node.name}, ${kindLabels[node.kind]}. Inspect details`}
    >
      <span className="node-top"><span className="node-symbol" aria-hidden="true">{kindIcons[node.kind]}</span><span className="node-kind">{kindLabels[node.kind]}</span></span>
      <strong>{node.name}</strong>
      <span className="node-technology">{node.technology}</span>
    </button>
  );
}
