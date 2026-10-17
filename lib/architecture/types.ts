import type { SourceReference } from "../exploration/types";

export type NodeKind = "application" | "service" | "storage" | "external";
export interface ArchitectureNode {
  id: string;
  name: string;
  description: string;
  technology: string;
  kind: NodeKind;
  dependencyIds?: string[];
  interfaces?: string[];
  technologies?: string[];
  architectureDecisions?: string[];
  codeReferences?: string[];
  sourceFiles?: SourceReference[];
  notes?: string;
  metadata?: Record<string, string>;
}
export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
/** Coordinates belong to a diagram view, not the component's identity or details. */
export interface DiagramNode extends ArchitectureNode {
  position: { x: number; y: number };
}
export interface Diagram {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: "System architecture" | "Service dependencies" | "Request flow";
  nodes: DiagramNode[];
  edges: ArchitectureEdge[];
}
export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  initials: string;
}
