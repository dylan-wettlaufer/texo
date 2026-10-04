import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ArchitectureWorkspace } from "@/components/workspace/architecture-workspace";
import { getDiagram, getProject, getProjectDiagrams } from "@/lib/architecture/data";

export default async function DiagramPage({ params }: { params: Promise<{ projectId: string; diagramId: string }> }) {
  const { projectId, diagramId } = await params;
  const project = getProject(projectId);
  const diagram = getDiagram(projectId, diagramId);
  if (!project || !diagram) notFound();
  return <><PageHeader title={diagram.name} description={diagram.description} project={project} /><ArchitectureWorkspace key={`${projectId}/${diagramId}`} project={project} diagram={diagram} diagrams={getProjectDiagrams(projectId)} /></>;
}
