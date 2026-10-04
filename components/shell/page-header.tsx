import Link from "next/link";

export function PageHeader({ title, description, project }: { title: string; description: string; project?: { id: string; name: string } }) {
  return <header className="page-header"><div className="breadcrumbs"><Link href="/projects">Projects</Link>{project && <><span>/</span><Link href={`/projects/${project.id}`}>{project.name}</Link></>}<span>/</span><span className="breadcrumb-current">{title}</span></div><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><span className="badge prototype-badge"><span className="status-dot" />Prototype</span></div></header>;
}
