import type { LineRange, SourceLine } from "../source/types";

export interface SourceReference {
  path: string;
  description: string;
  fileId?: string;
  defaultFunctionId?: string;
  directory?: boolean;
}
export type SourceRange = LineRange;
export interface Interaction { source: string; target: string; description: string }
export interface SourceFile {
  id: string;
  path: string;
  description: string;
  content: string;
}
export interface ExplanationStep {
  id: string;
  title: string;
  range?: SourceRange;
  componentIds: string[];
  interactions: Interaction[];
  annotationId?: string;
  explanation?: { does: string; why: string };
}
export interface FunctionRecord {
  id: string;
  fileId: string;
  name: string;
  componentIds: string[];
  purpose: string;
  behavior: string[];
  steps: ExplanationStep[];
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
export interface PreparedFile extends SourceFile {
  lines: SourceLine[];
}
export interface PreparedStep extends ExplanationStep { unavailableReason?: string }
export interface PreparedFunction extends FunctionRecord { steps: PreparedStep[]; range?: SourceRange; unavailableReason?: string }
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
  stepId?: string;
  directory?: boolean;
}
export interface ExplorationHistory {
  entries: ExplorationSelection[];
  index: number;
}
