import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { gitDiscovery } from "./discovery.mts";
import type { ParseRepositoryOptions, RepositoryFile, RepositoryDiagnostic, RepositoryMetadata } from "./types.mts";

export interface RepositoryCapture {
  root: string;
  metadata: RepositoryMetadata;
  files: Pick<RepositoryFile, "id" | "path" | "content" | "hash">[];
  diagnostics: RepositoryDiagnostic[];
  contentHash: string;
}
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const excluded = new Set(["node_modules", ".git", ".next", "build", "dist", "out", "coverage", ".texo", ".cache"]);
export const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export async function captureRepository({ rootPath, discovery = gitDiscovery }: ParseRepositoryOptions): Promise<RepositoryCapture> {
  const root = await realpath(rootPath);
  if (!(await lstat(root)).isDirectory()) throw new Error("rootPath must be a directory");
  const discovered = await discovery.discover(root);
  const capture: RepositoryCapture = { root, metadata: discovered.metadata, files: [], diagnostics: [], contentHash: "" };
  for (const relative of [...new Set(discovered.paths)].sort(compareText)) {
    const parts = relative.split("/");
    if (path.isAbsolute(relative) || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
      capture.diagnostics.push({ code: "invalid-path", path: relative, message: "Discovery returned an unsafe relative path" });
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
        capture.diagnostics.push({ code: "symlink-skipped", path: relative, message: "Symlinks are not indexed" });
        continue;
      }
      const stat = await lstat(fullPath);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_SOURCE_BYTES) {
        capture.diagnostics.push({ code: "source-too-large", path: relative, message: `Source exceeds ${MAX_SOURCE_BYTES} bytes` });
        continue;
      }
      bytes = await readFile(fullPath);
      if (bytes.length > MAX_SOURCE_BYTES) {
        capture.diagnostics.push({ code: "source-too-large", path: relative, message: `Source exceeds ${MAX_SOURCE_BYTES} bytes` });
        continue;
      }
    } catch (error) {
      capture.diagnostics.push({ code: "source-unreadable", path: relative, message: error instanceof Error ? error.message.replaceAll(root, "<root>") : "Unable to read source" });
      continue;
    }
    capture.files.push({ id: relative, path: relative, content: bytes.toString("utf8"), hash: hash(bytes) });
  }
  capture.contentHash = hash(JSON.stringify(capture.files.map(({ path: filePath, hash: fileHash }) => [filePath, fileHash])));
  return capture;
}
