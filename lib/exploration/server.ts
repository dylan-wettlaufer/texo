import "server-only";
import { commerceExploration } from "./demo";
import { prepareExploration } from "./prepare";
import type { ExplorationModel } from "./types";

const atlasModel = prepareExploration(commerceExploration, ["api", "web", "payments", "db", "queue", "worker"]);
export function getExplorationModel(projectId: string): ExplorationModel {
  return projectId === "atlas" ? atlasModel : { files: [], functions: [], annotations: [], flows: [], issues: [] };
}
