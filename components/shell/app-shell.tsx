"use client";

import { usePathname } from "next/navigation";
import type { Project } from "@/lib/architecture/types";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children, projects }: { children: React.ReactNode; projects: Project[] }) {
  const diagramView = /^\/projects\/[^/]+\/diagrams\/[^/]+$/.test(usePathname());
  return <div className={diagramView ? "app-shell diagram-shell" : "app-shell"}><a className="skip-link" href="#main-content">Skip to content</a>{!diagramView && <AppSidebar projects={projects} />}<main id="main-content" className="app-main">{children}</main></div>;
}
