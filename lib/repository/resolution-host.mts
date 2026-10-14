import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type ts from "typescript";

const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
type Probe = "file" | "directory" | "read" | "realpath";
export type ResolutionInputs = Map<string, string>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

/** Track resolution inputs, including missing paths, without retaining JSON contents. */
export function createResolutionHost(root: string, sources: ReadonlyMap<string, { tree: ts.SourceFile }> = new Map()) {
  const inputs: ResolutionInputs = new Map();
  const jsonCache = new Map<string, string | undefined>();
  function safePath(name: string) {
    const full = path.resolve(name);
    if (full !== root && !full.startsWith(root + path.sep)) return undefined;
    try { return realpathSync(full) === full ? full : undefined; } catch { return undefined; }
  }
  function observe<T>(kind: Probe, name: string, value: T): T {
    inputs.set(JSON.stringify([kind, path.resolve(name)]), digest(value));
    return value;
  }
  const host: ts.ModuleResolutionHost = {
    fileExists(name) {
      if (sources.has(path.resolve(name))) return true;
      let exists = false;
      try { const safe = safePath(name); exists = Boolean(safe && lstatSync(safe).isFile()); } catch { /* A removed path is missing. */ }
      return observe("file", name, exists);
    },
    readFile(name) {
      const full = path.resolve(name);
      const source = sources.get(full);
      if (source) return source.tree.text;
      if (jsonCache.has(full)) return jsonCache.get(full);
      let content: string | undefined;
      try {
        const safe = safePath(full);
        if (safe && /\.jsonc?$/.test(full) && lstatSync(safe).size <= MAX_CONFIG_BYTES) content = readFileSync(safe, "utf8");
      } catch { /* Config parsing reports unreadable configuration. */ }
      jsonCache.set(full, content);
      return observe("read", full, content);
    },
    directoryExists(name) {
      let exists = false;
      try { const safe = safePath(name); exists = Boolean(safe && lstatSync(safe).isDirectory()); } catch { /* A removed directory is missing. */ }
      return observe("directory", name, exists);
    },
    getCurrentDirectory: () => root,
    realpath: (name) => observe("realpath", name, safePath(name) ?? name),
  };
  return { host, inputs };
}
export function resolutionInputsUnchanged(root: string, inputs: ResolutionInputs) {
  const { host } = createResolutionHost(root);
  for (const [key, previous] of inputs) {
    const [kind, name] = JSON.parse(key) as [Probe, string];
    const value = kind === "file" ? host.fileExists(name) : kind === "directory" ? host.directoryExists!(name)
      : kind === "read" ? host.readFile(name) : host.realpath!(name);
    if (digest(value) !== previous) return false;
  }
  return true;
}
