import type { RepositoryHistory, RepositorySelection } from "./types.mts";
import type { CallQueryResult, DeclarationDetail } from "../repository/query-types.mts";

export function pushRepositorySelection(history: RepositoryHistory, selection: RepositorySelection): RepositoryHistory {
  if (JSON.stringify(history.entries[history.index]) === JSON.stringify(selection)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), selection];
  return { entries, index: entries.length - 1 };
}
export function moveRepositoryHistory(history: RepositoryHistory, delta: number): RepositoryHistory {
  return { ...history, index: Math.max(0, Math.min(history.entries.length - 1, history.index + delta)) };
}
export function callSelection(call: CallQueryResult, direction: "callers" | "callees"): RepositorySelection | undefined {
  if (direction === "callees") return call.target ? { fileId: call.target.fileId, declarationId: call.target.id } : undefined;
  return { fileId: call.fileId, ...(call.caller ? { declarationId: call.caller.id } : {}), callRange: call.range };
}
export function selectionRange(selection: RepositorySelection, revision: string, declaration?: Pick<DeclarationDetail, "sourceRange">) {
  return selection.revision === revision && selection.callRange ? selection.callRange : declaration?.sourceRange;
}
/** Each independent request channel owns a ticket; late responses cannot replace newer data. */
export function createRequestGate() {
  let sequence = 0;
  return { next: () => ++sequence, current: (ticket: number) => ticket === sequence, cancel: () => { sequence++; } };
}
