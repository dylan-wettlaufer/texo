import Link from "next/link";
import type { Project } from "@/lib/architecture/types";

export function ProjectCard({ project, diagramCount }: { project: Project; diagramCount: number }) {
  return <Link className="project-card" href={`/projects/${project.id}`}><div className="card-top"><span className={`project-icon ${project.id === "beacon" ? "purple" : ""}`}>{project.initials}</span><span className="card-arrow" aria-hidden="true">↗</span></div><h2>{project.name}</h2><p>{project.description}</p><div className="card-footer"><span><span className={`language-dot ${project.language === "Python" ? "purple" : ""}`} />{project.language}</span><span>{diagramCount} {diagramCount === 1 ? "diagram" : "diagrams"}</span></div></Link>;
}
