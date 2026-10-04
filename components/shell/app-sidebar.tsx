"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Project } from "@/lib/architecture/types";

export function AppSidebar({ projects }: { projects: Project[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <Link href="/projects" className="brand" aria-label="Texo projects"><span className="brand-mark">t</span>texo<span className="brand-dot">.</span></Link>
        <button className="mobile-menu icon-button" aria-label="Toggle navigation" aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(!open)}>☰</button>
      </div>
      <nav id="app-navigation" className={`sidebar-navigation ${open ? "is-open" : ""}`} aria-label="Main navigation">
        <Link href="/projects" className={`nav-link ${pathname === "/projects" ? "active" : ""}`} aria-current={pathname === "/projects" ? "page" : undefined} onClick={() => setOpen(false)}><span aria-hidden="true">▦</span> All projects</Link>
        <p className="eyebrow sidebar-section-label">YOUR PROJECTS</p>
        {projects.map((project) => {
          const active = pathname.startsWith(`/projects/${project.id}`);
          return <Link key={project.id} href={`/projects/${project.id}`} className={`nav-link ${active ? "active" : ""}`} aria-current={pathname === `/projects/${project.id}` ? "page" : undefined} onClick={() => setOpen(false)}><span className="project-mini">{project.initials}</span>{project.name}</Link>;
        })}
        <div className="sidebar-note"><span className="status-dot" /> Prototype workspace<p>Explore a sample architecture.<br />Everything here is demo data.</p></div>
      </nav>
      <div className="sidebar-footer"><span className="avatar">T</span><div>Texo workspace<small>Architecture, in context</small></div></div>
    </aside>
  );
}
