import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { gitDiscovery } from "./discovery.mts";
import { extractDeclarations } from "./declarations.mts";
import { extractRelationships } from "./relationships.mts";
import type { ParsedSource } from "./relationships.mts";
import type { ParseRepositoryOptions, RepositoryIndex } from "./types.mts";

export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const excluded = new Set(["node_modules", ".git", ".next", "build", "dist", "out", "coverage", ".texo", ".cache"]);
export const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function scriptKind(filePath: string) {
  return /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : /\.jsx$/.test(filePath) ? ts.ScriptKind.JSX
    : /\.(?:js|mjs|cjs)$/.test(filePath) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}
export async function parseRepository({ rootPath, discovery = gitDiscovery }: ParseRepositoryOptions): Promise<RepositoryIndex> {
  const root = await realpath(rootPath);
  if (!(await lstat(root)).isDirectory()) throw new Error("rootPath must be a directory");
  const discovered = await discovery.discover(root);
  const index: RepositoryIndex = { schemaVersion: 1, repository: { ...discovered.metadata, contentHash: "" }, files: [], declarations: [], modules: [], calls: [], diagnostics: [] };
  const sources: ParsedSource[] = [];
  for (const relative of [...new Set(discovered.paths)].sort(compareText)) {
    const parts = relative.split("/");
    if (path.isAbsolute(relative) || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
      index.diagnostics.push({ code: "invalid-path", path: relative, message: "Discovery returned an unsafe relative path" });
      continue;
    }
    if (parts.some((part) => excluded.has(part)) || !/\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(relative)) continue;
    const fullPath = path.join(root, relative);
    let bytes: Buffer;
    try {
      let safe = true;
      for (let i = 1; i <= parts.length; i++) {
        if ((await lstat(path.join(root, ...parts.slice(0, i)))).isSymbolicLink()) { safe = false; break; }
      }
      if (!safe) {
        index.diagnostics.push({ code: "symlink-skipped", path: relative, message: "Symlinks are not indexed" });
        continue;
      }
      const stat = await lstat(fullPath);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_SOURCE_BYTES) {
        index.diagnostics.push({ code: "source-too-large", path: relative, message: `Source exceeds ${MAX_SOURCE_BYTES} bytes` });
        continue;
      }
      bytes = await readFile(fullPath);
      if (bytes.length > MAX_SOURCE_BYTES) {
        index.diagnostics.push({ code: "source-too-large", path: relative, message: `Source exceeds ${MAX_SOURCE_BYTES} bytes` });
        continue;
      }
    } catch (error) {
      index.diagnostics.push({ code: "source-unreadable", path: relative, message: error instanceof Error ? error.message.replaceAll(root, "<root>") : "Unable to read source" });
      continue;
    }
    // IO failures are recoverable; unexpected parser failures must reject the scan.
    const content = bytes.toString("utf8");
    const tree = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true, scriptKind(relative));
    const syntax = (tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    for (const diagnostic of syntax) index.diagnostics.push({ code: "syntax-error", path: relative, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n") });
    index.files.push({ id: relative, path: relative, content, hash: hash(bytes), declarationFile: /\.d\.(?:ts|mts|cts)$/.test(relative), status: syntax.length ? "partial" : "parsed" });
    const analysis = extractDeclarations(tree, relative, index.diagnostics);
    index.declarations.push(...analysis.declarations);
    sources.push({ tree, fileId: relative, ...analysis });
  }
  index.repository.contentHash = hash(JSON.stringify(index.files.map(({ path: filePath, hash: fileHash }) => [filePath, fileHash])));
  extractRelationships(root, sources, index);
  index.declarations.sort((a, b) => compareText(a.id, b.id));
  index.modules.sort((a, b) => compareText(a.id, b.id));
  index.calls.sort((a, b) => compareText(a.id, b.id));
  index.diagnostics.sort((a, b) => compareText(a.path ?? "", b.path ?? "") || compareText(a.code, b.code) || (a.range?.start ?? 0) - (b.range?.start ?? 0) || compareText(a.message, b.message));
  return index;
}
export type { ParseRepositoryOptions, RepositoryIndex, RepositoryDiscovery, RepositoryDiagnostic } from "./types.mts";
