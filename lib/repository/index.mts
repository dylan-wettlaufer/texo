import { captureRepository } from "./capture.mts";
import { analyzeRepository } from "./analyze.mts";
import type { ParseRepositoryOptions, RepositoryIndex } from "./types.mts";

export async function parseRepository(options: ParseRepositoryOptions): Promise<RepositoryIndex> {
  return analyzeRepository(await captureRepository(options)).index;
}
export { MAX_SOURCE_BYTES, compareText } from "./capture.mts";
export { scriptKind } from "./analyze.mts";
export { createRepositoryCache } from "./cache.mts";
export { createRepositorySnapshots } from "./snapshots.mts";
export type { RepositorySnapshot } from "./snapshots.mts";
export type { ParseRepositoryOptions, RepositoryIndex, RepositoryDiscovery, RepositoryDiagnostic } from "./types.mts";
export { createRepositoryQuery } from "./query.mts";
export type * from "./query-types.mts";
