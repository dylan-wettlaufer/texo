import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { getProjectDiagrams, projects } from "@/lib/architecture/data";

export default function ProjectsPage() {
  return <><PageHeader title="Your projects" description="A home for the architecture behind your code." /><div className="page-content"><section className="welcome-panel"><div><span className="eyebrow">MAKE THE BIG PICTURE CLEAR</span><h2>Good architecture starts<br />with shared understanding.</h2><p>Explore your systems, follow the connections, and keep<br className="desktop-break" /> the context close to your code.</p></div><div className="welcome-art" aria-hidden="true"><span className="art-node art-a">▦</span><span className="art-line art-line-a" /><span className="art-node art-b">⌘</span><span className="art-line art-line-b" /><span className="art-node art-c">▤</span><span className="art-caption">CONNECTED BY CONTEXT</span></div></section><div className="section-heading"><div><h2>Projects <Badge variant="secondary" className="count-badge">{projects.length}</Badge></h2><p>Choose a project to explore its architecture.</p></div><span className="muted small-text">Sample workspace</span></div><div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} diagramCount={getProjectDiagrams(project.id).length} />)}</div><p className="page-footnote">A clearer view of how everything fits together.</p></div></>;
}
