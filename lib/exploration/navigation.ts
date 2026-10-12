import type { ArchitectureEdge } from "../architecture/types";
import type { ExplorationHistory, ExplorationModel, ExplorationSelection, Interaction, SourceReference } from "./types";

export function resolveSource(reference: SourceReference, model: ExplorationModel): ExplorationSelection {
  if (reference.directory || reference.path.endsWith("/")) return { path: reference.path, directory: true };
  const file = reference.fileId ? model.files.find((candidate) => candidate.id === reference.fileId) : model.files.find((candidate) => candidate.path === reference.path);
  const fn = reference.defaultFunctionId ? model.functions.find((candidate) => candidate.id === reference.defaultFunctionId && candidate.fileId === file?.id) : model.functions.find((candidate) => candidate.fileId === file?.id);
  return { path: reference.path, fileId: file?.id, functionId: reference.defaultFunctionId ?? fn?.id };
}
export function functionSelection(id: string, model: ExplorationModel, annotationId?: string): ExplorationSelection {
  const fn = model.functions.find((candidate) => candidate.id === id);
  const file = model.files.find((candidate) => candidate.id === fn?.fileId);
  return { path: file?.path ?? "Source unavailable", fileId: file?.id, functionId: id, annotationId };
}
export function pushSelection(history: ExplorationHistory | null, selection: ExplorationSelection): ExplorationHistory {
  if (!history) return { entries: [selection], index: 0 };
  const current = history.entries[history.index];
  if (JSON.stringify(current) === JSON.stringify(selection)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), selection];
  return { entries, index: entries.length - 1 };
}
export function moveHistory(history: ExplorationHistory, delta: number): ExplorationHistory {
  return { ...history, index: Math.max(0, Math.min(history.entries.length - 1, history.index + delta)) };
}
export function selectionContext(selection: ExplorationSelection, model: ExplorationModel) {
  const file = model.files.find((candidate) => candidate.id === selection.fileId);
  const fn = model.functions.find((candidate) => candidate.id === selection.functionId && (!file || candidate.fileId === file.id));
  const annotation = model.annotations.find((candidate) => candidate.id === selection.annotationId && candidate.functionId === fn?.id);
  return { file, fn, annotation, range: selection.annotationId ? annotation?.range : fn?.range };
}
export function matchesInteraction(edge: Pick<ArchitectureEdge, "source" | "target">, interactions: Interaction[]) {
  return interactions.some((interaction) => interaction.source === edge.source && interaction.target === edge.target);
}
