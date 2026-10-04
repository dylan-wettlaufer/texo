import Link from "next/link";
import type { Diagram } from "@/lib/architecture/types";

export function DiagramList({ diagrams }: { diagrams: Diagram[] }) {
  if (!diagrams.length) return <div className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span><h3>A blank canvas, a new beginning</h3><p>This project doesn’t have any diagrams yet.</p><p className="muted">Explore Atlas Commerce to see a sample architecture workspace.</p><Link href="/projects/atlas" className="button secondary">Explore sample project →</Link></div>;
  return <div className="diagram-list">{diagrams.map((diagram, index) => <Link key={diagram.id} href={`/projects/${diagram.projectId}/diagrams/${diagram.id}`} className="diagram-card"><span className="diagram-icon" aria-hidden="true">{index === 2 ? "⇢" : "◇"}</span><div className="diagram-card-content"><span className="eyebrow">{diagram.type}</span><h3>{diagram.name}</h3><p>{diagram.description}</p></div><div className="diagram-card-meta"><span>{diagram.nodes.length} nodes · {diagram.edges.length} connections</span><span className="open-diagram">Open diagram <span aria-hidden="true">→</span></span></div></Link>)}</div>;
}
