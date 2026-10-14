import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import { captureRepository } from "./capture.mts";
import { analyzeRepository } from "./analyze.mts";
import { resolutionInputsUnchanged } from "./resolution-host.mts";
import type { ParseRepositoryOptions } from "./types.mts";

// Increment when analysis semantics change; cache entries never survive a process restart.
const CACHE_VERSION = 1;
type Entry = ReturnType<typeof analyzeRepository>;
/** Bounded, root-scoped cache. Content is recaptured before every lookup; mtimes are not trusted. */
export function createRepositoryCache(options: ParseRepositoryOptions, { maxEntries = 2 }: { maxEntries?: number } = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 10) throw new Error("maxEntries must be an integer between 1 and 10");
  const captureOptions = { ...options, rootPath: path.resolve(options.rootPath) };
  const entries = new Map<string, Entry>();
  const stats = { hits: 0, misses: 0, analyses: 0 };
  let pending: Promise<Entry["index"]> | undefined;
  async function load() {
    const capture = await captureRepository(captureOptions);
    const key = createHash("sha256").update(JSON.stringify([CACHE_VERSION, ts.version, capture.root, capture.metadata, capture.contentHash, capture.diagnostics])).digest("hex");
    let entry = entries.get(key);
    if (entry && resolutionInputsUnchanged(capture.root, entry.resolutionInputs)) {
      stats.hits++;
      entries.delete(key);
      entries.set(key, entry);
    } else {
      stats.misses++;
      entry = analyzeRepository(capture);
      stats.analyses++;
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    }
    return entry.index;
  }
  return {
    async read() {
      // Callers cannot mutate cached records, even when concurrent requests share analysis.
      pending ??= load().finally(() => { pending = undefined; });
      return structuredClone(await pending);
    },
    getStats: () => ({ ...stats, entries: entries.size }),
  };
}
