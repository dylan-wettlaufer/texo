import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectOverview } from "@/components/projects/project-overview";
import { getProjectDiagrams } from "@/lib/architecture/data";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { availableProjects } from "@/lib/local-repository/projects";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = availableProjects().find((candidate) => candidate.id === projectId);
  if (!project) notFound();
  if (project.id === "texo") return <><PageHeader title="Texo · Local checkout" description="Explore real source from the checkout running this app." /><div className="page-content"><p>Browse files and functions, then follow their static call relationships.</p><Button asChild className="mt-4"><Link href="/projects/texo/code">Open Code Explorer</Link></Button><p className="page-footnote">Architecture mapping and authored explanations are not available for this checkout yet.</p></div></>;
  return <><PageHeader title={project.name} description="Explore the system from every angle." /><ProjectOverview project={project} diagrams={getProjectDiagrams(projectId)} /></>;
}
