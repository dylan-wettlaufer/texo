import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectOverview } from "@/components/projects/project-overview";
import { getProject, getProjectDiagrams } from "@/lib/architecture/data";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();
  return <><PageHeader title={project.name} description="Explore the system from every angle." /><ProjectOverview project={project} diagrams={getProjectDiagrams(projectId)} /></>;
}
