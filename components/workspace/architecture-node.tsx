import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import type { ArchitectureNode as ArchitectureNodeData } from "@/lib/architecture/types";

export type FlowArchitectureNode = Node<{ node: ArchitectureNodeData }, "architecture">;
export const kindLabels = { application: "Application", service: "Service", storage: "Data store", external: "External service" };
const kindIcons = { application: "▦", service: "⌘", storage: "▤", external: "↗" };

export function ArchitectureNode({ data: { node }, selected }: NodeProps<FlowArchitectureNode>) {
  return (
    <Card className={`architecture-node node-${node.kind} ${selected ? "selected" : ""}`} style={{ width: "100%", height: "100%" }}>
      {([Position.Left, Position.Right, Position.Top, Position.Bottom] as const).map((position) => <Handle key={position} id={position} type="source" position={position} isConnectable={false} />)}
      <span className="node-top"><span className="node-symbol" aria-hidden="true">{kindIcons[node.kind]}</span><span className="node-kind">{kindLabels[node.kind]}</span></span>
      <strong>{node.name}</strong>
      <span className="node-technology">{node.technology}</span>
    </Card>
  );
}
