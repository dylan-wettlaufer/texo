"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Network, SquareCode } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import type { Project } from "@/lib/architecture/types";

export function AppSidebar({ projects, workspace }: { projects: Project[]; workspace?: { view: "architecture" | "code"; onArchitecture: () => void; onCode: () => void; codeAvailable: boolean } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <Link href="/projects" className="brand" aria-label="Texo projects"><span className="brand-mark">t</span>texo<span className="brand-dot">.</span></Link>
        <div className="sidebar-actions"><ThemeToggle /><Button variant="ghost" className="mobile-menu icon-button" aria-label="Toggle navigation" aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(!open)}>☰</Button></div>
      </div>
      <nav id="app-navigation" className={`sidebar-navigation ${open ? "is-open" : ""}`} aria-label="Main navigation">
        {workspace && <>
          <Button variant="ghost" className={`nav-link ${workspace.view === "architecture" ? "active" : ""}`} aria-current={workspace.view === "architecture" ? "page" : undefined} onClick={() => { workspace.onArchitecture(); setOpen(false); }}><Network aria-hidden="true" />Architecture</Button>
          <Button variant="ghost" className={`nav-link ${workspace.view === "code" ? "active" : ""}`} aria-current={workspace.view === "code" ? "page" : undefined} disabled={!workspace.codeAvailable} onClick={() => { workspace.onCode(); setOpen(false); }}><SquareCode aria-hidden="true" />Code Explorer</Button>
        </>}
        <Link href="/projects" className={`nav-link ${pathname === "/projects" ? "active" : ""}`} aria-current={pathname === "/projects" ? "page" : undefined} onClick={() => setOpen(false)}><span aria-hidden="true">▦</span> All projects</Link>
        <p className="eyebrow sidebar-section-label">YOUR PROJECTS</p>
        {projects.map((project) => {
          const active = pathname.startsWith(`/projects/${project.id}`);
          return <Link key={project.id} href={`/projects/${project.id}`} className={`nav-link ${active ? "active" : ""}`} aria-current={pathname === `/projects/${project.id}` ? "page" : undefined} onClick={() => setOpen(false)}><span className="project-mini">{project.initials}</span>{project.name}</Link>;
        })}
        <div className="sidebar-note"><span className="status-dot" /> Prototype workspace<p>Explore a sample architecture.<br />Everything here is demo data.</p></div>
      </nav>
      <div className="sidebar-footer"><Avatar className="avatar"><AvatarFallback>T</AvatarFallback></Avatar><div>Texo workspace<small>Architecture, in context</small></div></div>
    </aside>
  );
}
