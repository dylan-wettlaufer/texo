export interface SourceReference {
  path: string;
  description: string;
  fileId?: string;
  defaultFunctionId?: string;
  directory?: boolean;
}
export interface SourceRange { startLine: number; endLine: number }
export interface Interaction { source: string; target: string; description: string }
export interface SourceFile {
  id: string;
  path: string;
  description: string;
  content: string;
}
export interface FunctionRecord {
  id: string;
  fileId: string;
  name: string;
  componentIds: string[];
  purpose: string;
  behavior: string[];
  inputs: string[];
  outputs: string[];
  sideEffects: string[];
  calleeIds: string[];
  interactions: Interaction[];
}
export interface Annotation {
  id: string;
  functionId: string;
  title: string;
  code: string;
  does: string;
  why: string;
  interactions: Interaction[];
}
export interface FeatureFlow {
  id: string;
  name: string;
  description: string;
  steps: { title: string; description: string; functionId: string; annotationId?: string }[];
}
export interface ExplorationData {
  files: SourceFile[];
  functions: FunctionRecord[];
  annotations: Annotation[];
  flows: FeatureFlow[];
}
export type TokenKind = "plain" | "keyword" | "string" | "number" | "comment";
export interface SourceToken { text: string; kind: TokenKind }
export interface PreparedFile extends SourceFile {
  lines: { number: number; tokens: SourceToken[] }[];
}
export interface PreparedFunction extends FunctionRecord { range?: SourceRange; unavailableReason?: string }
export interface PreparedAnnotation extends Annotation { range?: SourceRange; unavailableReason?: string }
export interface ExplorationModel {
  files: PreparedFile[];
  functions: PreparedFunction[];
  annotations: PreparedAnnotation[];
  flows: FeatureFlow[];
  issues: string[];
}
export interface ExplorationSelection {
  path: string;
  fileId?: string;
  functionId?: string;
  annotationId?: string;
  directory?: boolean;
}
export interface ExplorationHistory {
  entries: ExplorationSelection[];
  index: number;
}
