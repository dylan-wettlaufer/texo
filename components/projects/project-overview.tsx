import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Diagram, Project } from "@/lib/architecture/types";
import { DiagramList } from "./diagram-list";

export function ProjectOverview({ project, diagrams }: { project: Project; diagrams: Diagram[] }) {
  return <div className="page-content"><Card className="project-summary flex-row gap-4 ring-0"><span className={`project-icon ${project.id === "beacon" ? "purple" : ""}`}>{project.initials}</span><div><span className="eyebrow">PROJECT CONTEXT</span><p>{project.description}</p></div><Badge variant="secondary" className="badge">{project.language}</Badge></Card><div className="section-heading"><div><h2>Architecture diagrams</h2><p>Different perspectives. One shared understanding.</p></div><Badge variant="secondary" className="count-badge">{diagrams.length}</Badge></div><DiagramList diagrams={diagrams} /></div>;
}
