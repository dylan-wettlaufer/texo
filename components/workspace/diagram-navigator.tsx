import Link from "next/link";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Diagram, Project } from "@/lib/architecture/types";

export function DiagramNavigator({ project, diagrams, currentId }: { project: Project; diagrams: Diagram[]; currentId: string }) {
  const current = diagrams.find((diagram) => diagram.id === currentId);
  return (
    <nav className="diagram-switcher" aria-label="Diagram navigation">
      <Button asChild variant="ghost" size="icon-sm"><Link href={`/projects/${project.id}`} aria-label="Back to project" title="Back to project"><ArrowLeft aria-hidden="true" /></Link></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label={`Switch diagram: ${current?.name}`}><span className="diagram-name">{current?.name}</span><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          {diagrams.map((diagram) => <DropdownMenuItem key={diagram.id} asChild><Link href={`/projects/${project.id}/diagrams/${diagram.id}`} aria-current={diagram.id === currentId ? "page" : undefined}>{diagram.name}{diagram.id === currentId && <Check className="ml-auto" aria-hidden="true" />}</Link></DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
