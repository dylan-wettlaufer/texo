import { randomUUID } from "node:crypto";
import { createRepositoryQuery, parseRepository } from "../repository/index.mts";
import { validatePage } from "../repository/query.mts";
import { tokenizeSource } from "../exploration/tokenize.mts";
import type { RepositoryIndex } from "../repository/types.mts";
import type { LocalFileDetail, SnapshotResult } from "./types.mts";

export class RepositoryRequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
type Snapshot = { revision: string; query: ReturnType<typeof createRepositoryQuery> };
export function createLocalRepositoryStore(scan: () => Promise<RepositoryIndex>, enabled: () => boolean) {
  let current: Snapshot | undefined;
  let pending: Promise<Snapshot> | undefined;
  function guard() { if (!enabled()) throw new RepositoryRequestError(404, "disabled", "Local repository browsing is unavailable"); }
  function load(): Promise<Snapshot> {
    if (pending) return pending;
    pending = scan().then((index) => {
      const next = { revision: randomUUID(), query: createRepositoryQuery(index) };
      current = next;
      return next;
    }).finally(() => { pending = undefined; });
    return pending;
  }
  async function snapshot(revision?: string) {
    guard();
    const value = current ?? await load();
    if (revision !== undefined && revision !== value.revision) throw new RepositoryRequestError(409, "stale-revision", "The repository scan changed. Reload the current scan.");
    return value;
  }
  return {
    async refresh() { guard(); const value = await load(); return { revision: value.revision, data: value.query.getSummary() }; },
    async read(params: URLSearchParams): Promise<SnapshotResult<unknown>> {
      guard();
      const operation = params.get("operation") ?? "summary";
      const allowed: Record<string, string[]> = {
        summary: [], files: ["revision", "pathContains", "offset", "limit"],
        search: ["revision", "text", "offset", "limit"], file: ["revision", "id"],
        declaration: ["revision", "id"], callers: ["revision", "id", "offset", "limit"], callees: ["revision", "id", "offset", "limit"],
      };
      if (!Object.hasOwn(allowed, operation)) throw new RepositoryRequestError(400, "invalid-request", "Unknown repository operation");
      for (const key of params.keys()) {
        if ((key !== "operation" && !allowed[operation].includes(key)) || params.getAll(key).length !== 1) throw new RepositoryRequestError(400, "invalid-request", `Invalid parameter: ${key}`);
      }
      const requireParam = (key: string) => {
        const value = params.get(key);
        if (!value) throw new RepositoryRequestError(400, "invalid-request", `Missing parameter: ${key}`);
        return value;
      };
      const pagination = { offset: 0, limit: 50 };
      for (const key of ["offset", "limit"] as const) {
        const value = params.get(key);
        if (value !== null) {
          if (!/^\d+$/.test(value)) throw new RepositoryRequestError(400, "invalid-request", "Invalid pagination");
          pagination[key] = Number(value);
        }
      }
      try { validatePage(pagination); } catch { throw new RepositoryRequestError(400, "invalid-request", "Invalid pagination"); }
      const revision = operation === "summary" ? undefined : requireParam("revision");
      const id = ["file", "declaration", "callers", "callees"].includes(operation) ? requireParam("id") : undefined;
      if (id && (id.startsWith("/") || id.split("/").includes("..") || id.includes("\\"))) throw new RepositoryRequestError(400, "invalid-request", "Expected an indexed repository ID");
      const text = operation === "search" ? requireParam("text") : "";
      const { query, revision: currentRevision } = await snapshot(revision);
      let data: unknown;
      switch (operation) {
        case "summary": data = query.getSummary(); break;
        case "files": data = query.listFiles({ pathContains: params.get("pathContains") ?? undefined, ...pagination }); break;
        case "search": {
          // The query API has one kind filter. Filter both callable kinds before pagination.
          const callables = [];
          for (let offset = 0; ; offset += 200) {
            const page = query.searchDeclarations({ text, offset, limit: 200 });
            callables.push(...page.items.filter((item) => item.callable && (item.kind === "function" || item.kind === "method")));
            if (offset + page.items.length >= page.total) break;
          }
          data = { items: callables.slice(pagination.offset, pagination.offset + pagination.limit), total: callables.length, ...pagination };
          break;
        }
        case "file": {
          const file = query.getFile(id!);
          if (file) {
            const { content, ...metadata } = file;
            data = { ...metadata, lines: tokenizeSource(content, file.path) } satisfies LocalFileDetail;
          }
          break;
        }
        case "declaration": data = query.getDeclaration(id!); break;
        case "callers":
        case "callees":
          if (!query.getDeclaration(id!)) break;
          data = operation === "callers" ? query.getCallers(id!, pagination) : query.getCallees(id!, pagination);
          break;
      }
      if (data === undefined) throw new RepositoryRequestError(404, "not-found", "The selected file or declaration is unavailable in this scan");
      return { revision: currentRevision, data };
    },
  };
}
export function defaultScan() { return parseRepository({ rootPath: process.cwd() }); }
