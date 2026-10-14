import path from "node:path";
import ts from "typescript";
import { extractDeclarations } from "./declarations.mts";
import { extractRelationships } from "./relationships.mts";
import { compareText } from "./capture.mts";
import type { RepositoryCapture } from "./capture.mts";
import type { ParsedSource } from "./relationships.mts";
import type { RepositoryIndex } from "./types.mts";

export function scriptKind(filePath: string) {
  return /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : /\.jsx$/.test(filePath) ? ts.ScriptKind.JSX
    : /\.(?:js|mjs|cjs)$/.test(filePath) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}
export function analyzeRepository(capture: RepositoryCapture) {
  const index: RepositoryIndex = { schemaVersion: 1, repository: { ...capture.metadata, contentHash: capture.contentHash }, files: [], declarations: [], modules: [], calls: [], diagnostics: structuredClone(capture.diagnostics) };
  const sources: ParsedSource[] = [];
  for (const file of capture.files) {
    // IO failures are recoverable; unexpected parser failures must reject the scan.
    const { content, path: relative, hash } = file;
    const fullPath = path.join(capture.root, relative);
    const tree = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true, scriptKind(relative));
    const syntax = (tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    for (const diagnostic of syntax) index.diagnostics.push({ code: "syntax-error", path: relative, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n") });
    index.files.push({ id: relative, path: relative, content, hash, declarationFile: /\.d\.(?:ts|mts|cts)$/.test(relative), status: syntax.length ? "partial" : "parsed" });
    const analysis = extractDeclarations(tree, relative, index.diagnostics);
    index.declarations.push(...analysis.declarations);
    sources.push({ tree, fileId: relative, ...analysis });
  }
  const resolutionInputs = extractRelationships(capture.root, sources, index);
  index.declarations.sort((a, b) => compareText(a.id, b.id));
  index.modules.sort((a, b) => compareText(a.id, b.id));
  index.calls.sort((a, b) => compareText(a.id, b.id));
  index.diagnostics.sort((a, b) => compareText(a.path ?? "", b.path ?? "") || compareText(a.code, b.code) || (a.range?.start ?? 0) - (b.range?.start ?? 0) || compareText(a.message, b.message));
  return { index, resolutionInputs };
}
