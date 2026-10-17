import ts from "typescript";
import { tokenizeSource } from "../source/tokenize.mts";
import type { ExplorationData, ExplorationModel, PreparedFile, SourceRange } from "./types";

// Imported only by the server entry point and Node tests, never client components.
export function prepareExploration(data: ExplorationData, componentIds: string[]): ExplorationModel {
  const issues: string[] = [];
  const report = (message: string) => { issues.push(message); return message; };
  const trees = new Map<string, ts.SourceFile>();
  const symbols = new Map<string, Map<string, SourceRange[]>>();
  const files: PreparedFile[] = data.files.map((file) => {
    const tree = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    trees.set(file.id, tree);
    const names = new Map<string, SourceRange[]>();
    for (const statement of tree.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        const range = {
          startLine: tree.getLineAndCharacterOfPosition(statement.getStart(tree)).line + 1,
          endLine: tree.getLineAndCharacterOfPosition(statement.getEnd() - 1).line + 1,
        };
        names.set(statement.name.text, [...(names.get(statement.name.text) ?? []), range]);
      }
    }
    symbols.set(file.id, names);
    const lines = tokenizeSource(file.content, file.path);
    return { ...file, lines };
  });
  const fileById = new Map(files.map((file) => [file.id, file]));
  const functionIds = new Set(data.functions.map((fn) => fn.id));
  const checkInteractions = (owner: string, interactions: { source: string; target: string }[]) => {
    for (const interaction of interactions) {
      if (!componentIds.includes(interaction.source) || !componentIds.includes(interaction.target)) report(`${owner}: architecture component unavailable.`);
    }
  };
  for (const [label, records] of [["File", data.files], ["Function", data.functions], ["Annotation", data.annotations], ["Flow", data.flows]] as const) {
    if (new Set(records.map((record) => record.id)).size !== records.length) report(`${label} IDs must be unique.`);
  }
  const functions = data.functions.map((fn) => {
    const ranges = symbols.get(fn.fileId)?.get(fn.name);
    const unavailableReason = !fileById.has(fn.fileId) ? report(`${fn.name}: source file unavailable.`)
      : ranges?.length !== 1 ? report(`${fn.name}: function declaration unavailable or ambiguous.`) : undefined;
    fn.componentIds.forEach((id) => { if (!componentIds.includes(id)) report(`${fn.name}: component ${id} unavailable.`); });
    fn.calleeIds.forEach((id) => { if (!functionIds.has(id)) report(`${fn.name}: callee ${id} unavailable.`); });
    checkInteractions(fn.name, fn.interactions);
    const functionRange = unavailableReason ? undefined : ranges?.[0];
    const stepIds = new Set<string>();
    const annotationIds = new Set<string>();
    const steps = fn.steps.map((step) => {
      const unique = !stepIds.has(step.id);
      stepIds.add(step.id);
      const linkedAnnotation = !step.annotationId || (!annotationIds.has(step.annotationId) && data.annotations.some((annotation) => annotation.id === step.annotationId && annotation.functionId === fn.id));
      if (step.annotationId) annotationIds.add(step.annotationId);
      const range = step.range;
      const valid = range && functionRange && Number.isInteger(range.startLine) && Number.isInteger(range.endLine)
        && range.startLine >= functionRange.startLine && range.endLine <= functionRange.endLine && range.startLine <= range.endLine;
      const reason = !unique ? report(`${fn.name}: step IDs must be unique.`)
        : !valid ? report(`${step.title}: step source range unavailable.`) : undefined;
      if (!linkedAnnotation) report(`${step.title}: step annotation unavailable or ambiguous.`);
      step.componentIds.forEach((id) => { if (!componentIds.includes(id)) report(`${step.title}: component ${id} unavailable.`); });
      checkInteractions(step.title, step.interactions);
      return { ...step, annotationId: linkedAnnotation ? step.annotationId : undefined, range: reason ? undefined : range, unavailableReason: reason };
    });
    return { ...fn, steps, range: functionRange, unavailableReason };
  });
  const annotations = data.annotations.map((annotation) => {
    const fn = functions.find((candidate) => candidate.id === annotation.functionId);
    const file = fn && fileById.get(fn.fileId);
    const start = file?.content.indexOf(annotation.code) ?? -1;
    let range: SourceRange | undefined;
    if (file && annotation.code && start >= 0 && file.content.indexOf(annotation.code, start + 1) === -1) {
      const tree = trees.get(file.id)!;
      range = {
        startLine: tree.getLineAndCharacterOfPosition(start).line + 1,
        endLine: tree.getLineAndCharacterOfPosition(start + annotation.code.length - 1).line + 1,
      };
    }
    const valid = range && fn?.range && range.startLine >= fn.range.startLine && range.endLine <= fn.range.endLine;
    checkInteractions(annotation.title, annotation.interactions);
    return { ...annotation, range: valid ? range : undefined, unavailableReason: valid ? undefined : report(`${annotation.title}: annotated source range unavailable.`) };
  });
  for (const flow of data.flows) {
    for (const step of flow.steps) {
      if (!functionIds.has(step.functionId)) report(`${flow.name}: step function ${step.functionId} unavailable.`);
      if (step.annotationId && !annotations.some((annotation) => annotation.id === step.annotationId && annotation.functionId === step.functionId)) report(`${flow.name}: step annotation ${step.annotationId} unavailable.`);
    }
  }
  return { files, functions, annotations, flows: data.flows, issues };
}
