import type { CallReference, ModuleReference, RepositoryDeclaration, RepositoryFile, RepositoryIndex } from "./types.mts";
import type { DeclarationSummary, PageOptions, QueryPage, RepositoryQuery, RepositorySummary } from "./query-types.mts";

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function validatePage({ offset = 0, limit = 50 }: PageOptions = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset must be a nonnegative safe integer");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error("limit must be an integer between 1 and 200");
  return { offset, limit };
}
function page<T>(items: T[], options: PageOptions = {}): QueryPage<T> {
  const { offset, limit } = validatePage(options);
  return structuredClone({ items: items.slice(offset, offset + limit), total: items.length, offset, limit });
}
const compareLocation = (a: { fileId: string; range: { start: number }; id: string }, b: { fileId: string; range: { start: number }; id: string }) => compareText(a.fileId, b.fileId) || a.range.start - b.range.start || compareText(a.id, b.id);
function declarationSummary({ id, fileId, kind, name, qualifiedName, range, callable, duplicate, parentId }: RepositoryDeclaration): DeclarationSummary {
  return { id, fileId, kind, name, qualifiedName, range, callable, duplicate, ...(parentId ? { parentId } : {}) };
}
function fileSummary({ id, path, hash, declarationFile, status }: RepositoryFile) {
  return { id, path, hash, declarationFile, status };
}
function append<T>(map: Map<string, T[]>, id: string, item: T) {
  const items = map.get(id);
  if (items) items.push(item);
  else map.set(id, [item]);
}
/** Queries use a private snapshot; neither sorting nor returned objects mutate the supplied index. */
export function createRepositoryQuery(index: RepositoryIndex): RepositoryQuery {
  const snapshot = structuredClone(index);
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const declarations = new Map(snapshot.declarations.map((declaration) => [declaration.id, declaration]));
  const summaries = snapshot.declarations.map(declarationSummary).sort(compareLocation);
  const fileSummaries = snapshot.files.map(fileSummary).sort((a, b) => compareText(a.path, b.path) || compareText(a.id, b.id));
  const declarationsByFile = new Map<string, DeclarationSummary[]>();
  const incomingCalls = new Map<string, CallReference[]>();
  const outgoingCalls = new Map<string, CallReference[]>();
  const incomingModules = new Map<string, ModuleReference[]>();
  const outgoingModules = new Map<string, ModuleReference[]>();
  for (const summary of summaries) append(declarationsByFile, summary.fileId, summary);
  for (const call of snapshot.calls.slice().sort(compareLocation)) {
    if (call.resolution === "resolved" && call.targetDeclarationId) append(incomingCalls, call.targetDeclarationId, call);
    if (call.callerDeclarationId) append(outgoingCalls, call.callerDeclarationId, call);
  }
  for (const reference of snapshot.modules.slice().sort(compareLocation)) {
    append(outgoingModules, reference.fileId, reference);
    if (reference.resolution === "local" && reference.targetFileId) append(incomingModules, reference.targetFileId, reference);
  }
  const requireDeclaration = (id: string) => {
    if (!declarations.has(id)) throw new Error(`Unknown declaration: ${id}`);
  };
  const withCallSummaries = (call: CallReference) => {
    const caller = call.callerDeclarationId && declarations.get(call.callerDeclarationId);
    const target = call.targetDeclarationId && declarations.get(call.targetDeclarationId);
    return { ...call, ...(caller ? { caller: declarationSummary(caller) } : {}), ...(target ? { target: declarationSummary(target) } : {}) };
  };
  const diagnosticsByCode: Record<string, number> = Object.create(null);
  for (const diagnostic of snapshot.diagnostics) diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] ?? 0) + 1;
  const summary: RepositorySummary = {
    repository: snapshot.repository, files: files.size, declarations: declarations.size,
    calls: { total: snapshot.calls.length, resolved: snapshot.calls.filter((call) => call.resolution === "resolved").length, unresolved: snapshot.calls.filter((call) => call.resolution === "unresolved").length },
    modules: { total: snapshot.modules.length, local: 0, external: 0, unresolved: 0, "not-applicable": 0 },
    diagnostics: { total: snapshot.diagnostics.length, byCode: Object.fromEntries(Object.entries(diagnosticsByCode).sort(([a], [b]) => compareText(a, b))) },
  };
  for (const reference of snapshot.modules) summary.modules[reference.resolution]++;
  return {
    getSummary: () => structuredClone(summary),
    listFiles: (options = {}) => page(fileSummaries.filter((file) => file.path.toLowerCase().includes((options.pathContains ?? "").toLowerCase())), options),
    searchDeclarations: (options) => {
      const text = options.text.toLowerCase();
      return page(summaries.filter((declaration) => (!options.fileId || declaration.fileId === options.fileId) && (!options.kind || declaration.kind === options.kind) && (declaration.name.toLowerCase().includes(text) || declaration.qualifiedName.toLowerCase().includes(text))), options);
    },
    getFile: (fileId) => {
      const file = files.get(fileId);
      return file ? structuredClone({ ...file, declarations: declarationsByFile.get(fileId) ?? [] }) : undefined;
    },
    getDeclaration: (id) => {
      const declaration = declarations.get(id);
      if (!declaration) return undefined;
      const file = files.get(declaration.fileId);
      if (!file) throw new Error(`Source unavailable for declaration: ${id}`);
      const sourceRange = declaration.implementationRange ?? declaration.range;
      return structuredClone({ ...declaration, sourceRange, source: file.content.slice(sourceRange.start, sourceRange.end), signatures: declaration.signatureRanges.map((range) => ({ range, source: file.content.slice(range.start, range.end) })) });
    },
    getCallers: (id, options) => { requireDeclaration(id); return page((incomingCalls.get(id) ?? []).map(withCallSummaries), options); },
    getCallees: (id, options) => { requireDeclaration(id); return page((outgoingCalls.get(id) ?? []).map(withCallSummaries), options); },
    getModules: (fileId, options = {}) => {
      if (!files.has(fileId)) throw new Error(`Unknown file: ${fileId}`);
      if (options.direction !== undefined && options.direction !== "outgoing" && options.direction !== "incoming") throw new Error("direction must be outgoing or incoming");
      const references = (options.direction === "incoming" ? incomingModules : outgoingModules).get(fileId) ?? [];
      return page(references.map((reference) => {
        const target = reference.targetFileId && files.get(reference.targetFileId);
        if (!target) return { ...reference };
        return { ...reference, target: fileSummary(target) };
      }), options);
    },
  };
}
