import type { ArchitectureEdge, ArchitectureNode, Diagram } from "./types";

export function projectNodeCatalogue(diagrams: Diagram[]): ArchitectureNode[] {
  return [...new Map(diagrams.flatMap((diagram) => diagram.nodes).map((node) => [node.id, node])).values()];
}

export function nodeRelationships(node: ArchitectureNode, catalogue: ArchitectureNode[]) {
  const byId = new Map(catalogue.map((candidate) => [candidate.id, candidate]));
  return {
    dependencies: node.dependencyIds?.map((id) => ({ id, node: byId.get(id) })),
    // Without every node's dependency documentation, an empty inverse is unknown.
    consumers: catalogue.every((candidate) => candidate.dependencyIds !== undefined)
      ? catalogue.filter((candidate) => candidate.dependencyIds?.includes(node.id))
      : undefined,
  };
}

// Flow direction describes communication, not dependency ownership.
export function nodeConnections(nodeId: string, edges: ArchitectureEdge[], catalogue: ArchitectureNode[]) {
  const byId = new Map(catalogue.map((node) => [node.id, node]));
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).map((edge) => {
    const incoming = edge.target === nodeId;
    const relatedId = incoming ? edge.source : edge.target;
    return { id: edge.id, incoming, label: edge.label, relatedId, node: byId.get(relatedId) };
  });
}
