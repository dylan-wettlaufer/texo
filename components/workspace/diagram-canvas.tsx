import { useCallback, useMemo } from "react";
import { Background, ConnectionMode, MarkerType, ReactFlow, useNodesState, type Edge, type NodeChange } from "@xyflow/react";
import type { Diagram } from "@/lib/architecture/types";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/architecture/geometry";
import { ArchitectureNode, type FlowArchitectureNode } from "./architecture-node";
import { CanvasControls } from "./canvas-controls";

const nodeTypes = { architecture: ArchitectureNode };

export function DiagramCanvas({ diagram, selectedId, onSelect }: { diagram: Diagram; selectedId: string | null; onSelect: (id: string, trigger?: HTMLElement) => void }) {
  const [nodes, , onNodesChange] = useNodesState<FlowArchitectureNode>(diagram.nodes.map((node) => ({
    id: node.id, type: "architecture", position: { ...node.position }, data: { node },
    width: NODE_WIDTH, height: NODE_HEIGHT,
    ariaLabel: `${node.name}. Press Enter or Space to inspect; use arrow keys to move when selected.`,
  })));
  const handleNodesChange = useCallback((changes: NodeChange<FlowArchitectureNode>[]) => {
    // Only explicit activation opens the inspector; flow selection also occurs on drag.
    onNodesChange(changes.filter((change) => change.type !== "select"));
  }, [onNodesChange]);
  const displayedNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: node.id === selectedId })), [nodes, selectedId]);
  const edges = useMemo<Edge[]>(() => diagram.edges.map((edge) => {
    const source = nodes.find((node) => node.id === edge.source)!;
    const target = nodes.find((node) => node.id === edge.target)!;
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const active = selectedId === edge.source || selectedId === edge.target;
    const color = active ? "var(--primary)" : "var(--input)";
    return {
      ...edge, type: "smoothstep",
      sourceHandle: horizontal ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top"),
      targetHandle: horizontal ? (dx >= 0 ? "left" : "right") : (dy >= 0 ? "top" : "bottom"),
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: active ? 2 : 1.5 },
      labelStyle: { fill: active ? "var(--foreground)" : "var(--muted-foreground)", fontSize: 10 },
      labelBgStyle: { fill: "var(--card)", stroke: "var(--border)" }, labelBgPadding: [8, 5], labelBgBorderRadius: 2,
    };
  }), [diagram.edges, nodes, selectedId]);

  return (
    <div className="canvas-viewport" aria-label={`${diagram.name} diagram canvas`} onKeyDownCapture={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".react-flow__node") : null;
      if (!target?.dataset.id) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(target.dataset.id, target);
    }}>
      <ReactFlow<FlowArchitectureNode>
        nodes={displayedNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleNodesChange}
        onNodeClick={(event, node) => onSelect(node.id, event.currentTarget as HTMLElement)}
        selectNodesOnDrag={false} connectionMode={ConnectionMode.Loose}
        nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null} multiSelectionKeyCode={null}
        minZoom={0.1} maxZoom={1.8} fitView fitViewOptions={{ padding: 0.1, maxZoom: 1.4 }}
      >
        <Background color="var(--border)" gap={20} />
        <CanvasControls />
      </ReactFlow>
    </div>
  );
}
