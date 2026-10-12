import ts from "typescript";
import type { ExplorationData, ExplorationModel, PreparedFile, SourceRange, SourceToken, TokenKind } from "./types";

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
    const lines: PreparedFile["lines"] = [{ number: 1, tokens: [] }];
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, file.content);
    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
      const kind: TokenKind = token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword ? "keyword"
        : token === ts.SyntaxKind.StringLiteral || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ? "string"
        : token === ts.SyntaxKind.NumericLiteral ? "number"
        : token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia ? "comment" : "plain";
      const pieces = scanner.getTokenText().split(/(\n)/);
      for (const text of pieces) {
        if (text === "\n") lines.push({ number: lines.length + 1, tokens: [] });
        else if (text) lines[lines.length - 1].tokens.push({ text, kind } satisfies SourceToken);
      }
      token = scanner.scan();
    }
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
    return { ...fn, range: unavailableReason ? undefined : ranges?.[0], unavailableReason };
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
