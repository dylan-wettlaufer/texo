import type { Diagram, Project } from "@/lib/architecture/types";
import { DiagramList } from "./diagram-list";

export function ProjectOverview({ project, diagrams }: { project: Project; diagrams: Diagram[] }) {
  return <div className="page-content"><div className="project-summary"><span className={`project-icon ${project.id === "beacon" ? "purple" : ""}`}>{project.initials}</span><div><span className="eyebrow">PROJECT CONTEXT</span><p>{project.description}</p></div><span className="badge">{project.language}</span></div><div className="section-heading"><div><h2>Architecture diagrams</h2><p>Different perspectives. One shared understanding.</p></div><span className="count-badge">{diagrams.length}</span></div><DiagramList diagrams={diagrams} /></div>;
}
