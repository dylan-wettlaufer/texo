import { createHash, randomUUID } from "node:crypto";
import { createRepositoryQuery } from "./query.mts";
import type { RepositoryQuery } from "./query-types.mts";
import type { RepositoryIndex } from "./types.mts";

export interface RepositorySnapshot {
  revision: string;
  indexHash: string;
  query: RepositoryQuery;
}

/** One published in-memory snapshot; failed scans leave the previous one intact. */
export function createRepositorySnapshots(scan: () => Promise<RepositoryIndex>) {
  let current: RepositorySnapshot | undefined;
  let pending: Promise<RepositorySnapshot> | undefined;

  function refresh(): Promise<RepositorySnapshot> {
    if (pending) return pending;
    pending = scan().then((index) => {
      // Source hashes alone exclude config-dependent relationships and diagnostics.
      const indexHash = createHash("sha256").update(JSON.stringify(index)).digest("hex");
      if (current?.indexHash === indexHash) return current;
      const next = { revision: randomUUID(), indexHash, query: createRepositoryQuery(index) };
      current = next;
      return next;
    }).finally(() => { pending = undefined; });
    return pending;
  }

  return {
    read: async () => current ?? await refresh(),
    refresh,
  };
}
