import "server-only";
import { projects } from "@/lib/architecture/data";
import type { Project } from "@/lib/architecture/types";

export const localProject: Project = { id: "texo", name: "Texo", description: "Explore the source and static call relationships in this local checkout.", language: "TypeScript", initials: "TX" };
export function availableProjects(): Project[] { return process.env.NODE_ENV === "development" ? [...projects, localProject] : projects; }
