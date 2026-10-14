/** Offsets are UTF-16 code units, end-exclusive; lines/columns are one-based. */
export interface SourceRange {
  start: number;
  end: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
export interface RepositoryDiagnostic {
  code: string;
  message: string;
  path?: string;
  range?: SourceRange;
}
export interface RepositoryMetadata {
  kind: string;
  head: string | null;
}
export interface DiscoveryResult {
  metadata: RepositoryMetadata;
  paths: string[];
}
/** Implementations enumerate paths only; the parser owns safe reads and analysis. */
export interface RepositoryDiscovery {
  discover(rootPath: string): Promise<DiscoveryResult>;
}
export type DeclarationKind = "function" | "class" | "method" | "interface" | "type" | "variable";
export interface RepositoryDeclaration {
  id: string;
  fileId: string;
  kind: DeclarationKind;
  name: string;
  qualifiedName: string;
  parentId?: string;
  range: SourceRange;
  signatureRanges: SourceRange[];
  implementationRange?: SourceRange;
  callable: boolean;
  duplicate: boolean;
}
export interface RepositoryFile {
  id: string;
  path: string;
  content: string;
  hash: string;
  declarationFile: boolean;
  status: "parsed" | "partial";
}
export interface ModuleBinding {
  name: string;
  localName?: string;
  typeOnly: boolean;
}
export interface ModuleReference {
  id: string;
  fileId: string;
  kind: "import" | "export" | "dynamic-import" | "require";
  specifier?: string;
  bindings: ModuleBinding[];
  typeOnly: boolean;
  range: SourceRange;
  resolution: "local" | "external" | "unresolved" | "not-applicable";
  targetFileId?: string;
  unresolvedReason?: string;
}
export interface CallReference {
  id: string;
  fileId: string;
  callerDeclarationId?: string;
  callee: string;
  range: SourceRange;
  resolution: "resolved" | "unresolved";
  targetDeclarationId?: string;
  unresolvedReason?: string;
}
export interface RepositoryIndex {
  schemaVersion: 1;
  repository: RepositoryMetadata & { contentHash: string };
  files: RepositoryFile[];
  declarations: RepositoryDeclaration[];
  modules: ModuleReference[];
  calls: CallReference[];
  diagnostics: RepositoryDiagnostic[];
}
export interface ParseRepositoryOptions {
  rootPath: string;
  discovery?: RepositoryDiscovery;
}
