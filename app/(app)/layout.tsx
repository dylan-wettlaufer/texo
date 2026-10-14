import { AppShell } from "@/components/shell/app-shell";

import { availableProjects } from "@/lib/local-repository/projects";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <AppShell projects={availableProjects()}>{children}</AppShell>;
}
