import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Box, Database, Globe, PanelsTopLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ArchitectureNode as ArchitectureNodeData } from "@/lib/architecture/types";

export type FlowArchitectureNode = Node<{ node: ArchitectureNodeData; focused?: boolean }, "architecture">;
export const kindLabels = { application: "Application", service: "Service", storage: "Data store", external: "External service" };
const kindIcons = { application: PanelsTopLeft, service: Box, storage: Database, external: Globe };

export function ArchitectureNode({ data: { node, focused }, selected }: NodeProps<FlowArchitectureNode>) {
  const Icon = kindIcons[node.kind];
  return (
    <Card className={`architecture-node node-${node.kind} ${selected ? "selected" : ""} ${focused ? "node-focused" : ""}`} style={{ width: "100%", height: "100%" }}>
      {([Position.Left, Position.Right, Position.Top, Position.Bottom] as const).map((position) => <Handle key={position} id={position} type="source" position={position} isConnectable={false} />)}
      <span className="node-symbol" aria-hidden="true"><Icon /></span>
      <span className="node-copy"><strong title={node.name}>{node.name}</strong><span className="node-kind">{kindLabels[node.kind]}</span></span>
    </Card>
  );
}
