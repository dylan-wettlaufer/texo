import type { CallReference, DeclarationKind, ModuleReference, RepositoryDeclaration, RepositoryFile, RepositoryIndex, SourceRange } from "./types.mts";

export interface PageOptions { offset?: number; limit?: number }
export interface QueryPage<T> { items: T[]; total: number; offset: number; limit: number }
export interface FileQueryOptions extends PageOptions { pathContains?: string }
export interface DeclarationQueryOptions extends PageOptions { text: string; fileId?: string; kind?: DeclarationKind }
export interface ModuleQueryOptions extends PageOptions { direction?: "outgoing" | "incoming" }
export type FileSummary = Omit<RepositoryFile, "content">;
export type DeclarationSummary = Pick<RepositoryDeclaration, "id" | "fileId" | "kind" | "name" | "qualifiedName" | "range" | "callable" | "duplicate" | "parentId">;
export interface FileDetail extends RepositoryFile { declarations: DeclarationSummary[] }
export interface DeclarationDetail extends RepositoryDeclaration {
  source: string;
  sourceRange: SourceRange;
  signatures: { range: SourceRange; source: string }[];
}
export interface CallQueryResult extends CallReference { caller?: DeclarationSummary; target?: DeclarationSummary }
export interface ModuleQueryResult extends ModuleReference { target?: FileSummary }
export interface RepositorySummary {
  repository: RepositoryIndex["repository"];
  files: number;
  declarations: number;
  calls: { total: number; resolved: number; unresolved: number };
  modules: { total: number; local: number; external: number; unresolved: number; "not-applicable": number };
  diagnostics: { total: number; byCode: Record<string, number> };
}
export interface RepositoryQuery {
  getSummary(): RepositorySummary;
  listFiles(options?: FileQueryOptions): QueryPage<FileSummary>;
  searchDeclarations(options: DeclarationQueryOptions): QueryPage<DeclarationSummary>;
  getFile(fileId: string): FileDetail | undefined;
  getDeclaration(id: string): DeclarationDetail | undefined;
  getCallers(id: string, options?: PageOptions): QueryPage<CallQueryResult>;
  getCallees(id: string, options?: PageOptions): QueryPage<CallQueryResult>;
  getModules(fileId: string, options?: ModuleQueryOptions): QueryPage<ModuleQueryResult>;
}
