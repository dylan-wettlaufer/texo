import { useCallback, useMemo } from "react";
import { Background, ConnectionMode, MarkerType, ReactFlow, useNodesState, type Edge, type NodeChange } from "@xyflow/react";
import type { Diagram } from "@/lib/architecture/types";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/architecture/geometry";
import { ArchitectureNode, type FlowArchitectureNode } from "./architecture-node";
import type { Interaction } from "@/lib/exploration/types";
import { matchesInteraction } from "@/lib/exploration/navigation";
import { GraphViewportManager } from "./graph-viewport";
import { CanvasControls } from "./canvas-controls";

const nodeTypes = { architecture: ArchitectureNode };

export function DiagramCanvas({ diagram, selectedId, onSelect, exploring, interactions, focusedNodeIds }: { diagram: Diagram; selectedId: string | null; onSelect: (id: string, trigger?: HTMLElement) => void; exploring: boolean; interactions?: Interaction[]; focusedNodeIds?: string[] }) {
  const [nodes, , onNodesChange] = useNodesState<FlowArchitectureNode>(diagram.nodes.map((node) => ({
    id: node.id, type: "architecture", position: { ...node.position }, data: { node },
    width: NODE_WIDTH, height: NODE_HEIGHT,
    ariaLabel: `${node.name}. Press Enter or Space to inspect; use arrow keys to move when selected.`,
  })));
  const handleNodesChange = useCallback((changes: NodeChange<FlowArchitectureNode>[]) => {
    // Only explicit activation opens the inspector; flow selection also occurs on drag.
    onNodesChange(changes.filter((change) => change.type !== "select"));
  }, [onNodesChange]);
  const displayedNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: focusedNodeIds ? false : node.id === selectedId, data: { ...node.data, focused: focusedNodeIds?.includes(node.id) } })), [nodes, selectedId, focusedNodeIds]);
  const edges = useMemo<Edge[]>(() => diagram.edges.map((edge) => {
    const source = nodes.find((node) => node.id === edge.source)!;
    const target = nodes.find((node) => node.id === edge.target)!;
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const active = interactions ? matchesInteraction(edge, interactions) : selectedId === edge.source || selectedId === edge.target;
    const color = active ? "var(--primary)" : "var(--input)";
    return {
      ...edge, className: active && interactions ? "function-connection" : undefined, type: "default", pathOptions: { curvature: 0.35 },
      label: diagram.type === "Request flow" || active ? edge.label : undefined,
      sourceHandle: horizontal ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top"),
      targetHandle: horizontal ? (dx >= 0 ? "left" : "right") : (dy >= 0 ? "top" : "bottom"),
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: active ? 2 : 1.2, opacity: interactions && !active ? 0.35 : 1 },
      labelStyle: { fill: active ? "var(--foreground)" : "var(--muted-foreground)", fontSize: 10 },
      labelBgStyle: { fill: "var(--card)", stroke: "var(--border)" }, labelBgPadding: [8, 5], labelBgBorderRadius: 6,
    };
  }), [diagram.edges, diagram.type, nodes, selectedId, interactions]);

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
        minZoom={0.1} maxZoom={1.8} fitView fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
      >
        <Background color="var(--border)" gap={20} />
        <GraphViewportManager exploring={exploring} />
        <CanvasControls />
      </ReactFlow>
    </div>
  );
}
