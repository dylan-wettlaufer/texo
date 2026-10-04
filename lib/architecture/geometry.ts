import type { ArchitectureNode } from "./types";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 108;

export function diagramSize(nodes: ArchitectureNode[]) {
  return {
    width: Math.max(640, ...nodes.map((node) => node.position.x + NODE_WIDTH + 50)),
    height: Math.max(480, ...nodes.map((node) => node.position.y + NODE_HEIGHT + 70)),
  };
}

export function fitScale(viewport: { width: number; height: number }, diagram: { width: number; height: number }) {
  return Math.min(1, Math.max(0.1, Math.min((viewport.width - 48) / diagram.width, (viewport.height - 100) / diagram.height)));
}

export function edgeGeometry(source: ArchitectureNode, target: ArchitectureNode) {
  const a = { x: source.position.x + NODE_WIDTH / 2, y: source.position.y + NODE_HEIGHT / 2 };
  const b = { x: target.position.x + NODE_WIDTH / 2, y: target.position.y + NODE_HEIGHT / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Long connections take an upper lane instead of crossing intermediate nodes.
  if (Math.abs(dx) > 550) {
    const y = 20;
    return { path: `M ${a.x} ${source.position.y} V ${y} H ${b.x} V ${target.position.y}`, label: { x: (a.x + b.x) / 2, y } };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = Math.sign(dx) || 1;
    const start = { x: a.x + direction * NODE_WIDTH / 2, y: a.y };
    const end = { x: b.x - direction * NODE_WIDTH / 2, y: b.y };
    const middle = (start.x + end.x) / 2;
    return { path: `M ${start.x} ${start.y} C ${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`, label: { x: middle, y: (start.y + end.y) / 2 } };
  }
  const direction = Math.sign(dy);
  const start = { x: a.x, y: a.y + direction * NODE_HEIGHT / 2 };
  const end = { x: b.x, y: b.y - direction * NODE_HEIGHT / 2 };
  const middle = (start.y + end.y) / 2;
  return { path: `M ${start.x} ${start.y} C ${start.x} ${middle}, ${end.x} ${middle}, ${end.x} ${end.y}`, label: { x: (start.x + end.x) / 2, y: middle } };
}
