import Link from "next/link";
import type { Diagram, Project } from "@/lib/architecture/types";

export function DiagramNavigator({ project, diagrams, currentId }: { project: Project; diagrams: Diagram[]; currentId: string }) {
  return (
    <nav className="diagram-navigator" aria-label="Project diagrams">
      <div className="panel-title"><h2>Diagrams</h2><span className="count-badge">{diagrams.length}</span></div>
      <div className="diagram-navigation-list">
        {diagrams.map((diagram) => <Link key={diagram.id} href={`/projects/${project.id}/diagrams/${diagram.id}`} className={`diagram-nav-link ${diagram.id === currentId ? "active" : ""}`} aria-current={diagram.id === currentId ? "page" : undefined}><span aria-hidden="true">{diagram.type === "Request flow" ? "⇢" : "◇"}</span><div><strong>{diagram.name}</strong><small>{diagram.type}</small></div></Link>)}
      </div>
      <div className="navigator-note"><span className="eyebrow">ONE SYSTEM, MANY VIEWS</span><p>Each diagram offers a different perspective on your architecture.</p><Link href={`/projects/${project.id}`}>Project overview →</Link></div>
    </nav>
  );
}
