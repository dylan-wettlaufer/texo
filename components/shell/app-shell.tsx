import { projects } from "@/lib/architecture/data";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><AppSidebar projects={projects} /><main id="main-content" className="app-main">{children}</main></div>;
}
