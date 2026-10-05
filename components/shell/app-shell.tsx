"use client";

import { usePathname } from "next/navigation";
import { projects } from "@/lib/architecture/data";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const diagramView = /^\/projects\/[^/]+\/diagrams\/[^/]+$/.test(usePathname());
  return <div className={diagramView ? "app-shell diagram-shell" : "app-shell"}><a className="skip-link" href="#main-content">Skip to content</a>{!diagramView && <AppSidebar projects={projects} />}<main id="main-content" className="app-main">{children}</main></div>;
}
