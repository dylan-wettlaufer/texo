export type NodeKind = "application" | "service" | "storage" | "external";
export interface ArchitectureNode {
  id: string;
  name: string;
  description: string;
  technology: string;
  kind: NodeKind;
  position: { x: number; y: number };
}
export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
export interface Diagram {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: "System architecture" | "Service dependencies" | "Request flow";
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}
export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  initials: string;
}
