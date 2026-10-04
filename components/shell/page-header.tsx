import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export function PageHeader({ title, description, project }: { title: string; description: string; project?: { id: string; name: string } }) {
  return <header className="page-header"><Breadcrumb className="breadcrumbs"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><Link href="/projects">Projects</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />{project && <><BreadcrumbItem><BreadcrumbLink asChild><Link href={`/projects/${project.id}`}>{project.name}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}<BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><Badge variant="secondary" className="badge prototype-badge"><span className="status-dot" />Prototype</Badge></div></header>;
}
