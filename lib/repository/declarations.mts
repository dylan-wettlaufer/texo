import ts from "typescript";
import type { DeclarationKind, RepositoryDeclaration, RepositoryDiagnostic, SourceRange } from "./types.mts";

export function sourceRange(tree: ts.SourceFile, node: ts.Node): SourceRange {
  const start = node.getStart(tree);
  const end = node.getEnd();
  const a = tree.getLineAndCharacterOfPosition(start);
  const b = tree.getLineAndCharacterOfPosition(end);
  return { start, end, startLine: a.line + 1, startColumn: a.character + 1, endLine: b.line + 1, endColumn: b.character + 1 };
}
export function isCallableNode(node: ts.Node): node is ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
}
export interface DeclarationAnalysis {
  declarations: RepositoryDeclaration[];
  byNode: Map<ts.Node, RepositoryDeclaration>;
}
export function extractDeclarations(tree: ts.SourceFile, fileId: string, diagnostics: RepositoryDiagnostic[]): DeclarationAnalysis {
  const declarations: RepositoryDeclaration[] = [];
  const byNode = new Map<ts.Node, RepositoryDeclaration>();
  const byBase = new Map<string, RepositoryDeclaration[]>();
  const counters = new Map<string, number>();
  const next = (scope: string, kind: string) => {
    const key = `${scope}:${kind}`;
    const value = (counters.get(key) ?? 0) + 1;
    counters.set(key, value);
    return value;
  };
  const add = (node: ts.Node, kind: DeclarationKind, name: string, scope: string, parent?: RepositoryDeclaration, callableNode?: ts.Node) => {
    const qualifiedName = scope ? `${scope}.${name}` : name;
    const base = `${fileId}#${kind}:${encodeURIComponent(qualifiedName)}`;
    const siblings = byBase.get(base) ?? [];
    const record: RepositoryDeclaration = {
      id: siblings.length ? `${base}~${siblings.length + 1}` : base,
      fileId, kind, name, qualifiedName, ...(parent ? { parentId: parent.id } : {}),
      range: sourceRange(tree, node), signatureRanges: [], callable: Boolean(callableNode), duplicate: siblings.length > 0,
    };
    if (callableNode && isCallableNode(callableNode)) {
      if (callableNode.body) record.implementationRange = sourceRange(tree, callableNode);
      else record.signatureRanges.push(sourceRange(tree, callableNode));
    }
    if (siblings.length) {
      siblings.forEach((sibling) => { sibling.duplicate = true; });
      diagnostics.push({ code: "duplicate-declaration", path: fileId, range: record.range, message: `Duplicate declaration: ${qualifiedName}` });
    }
    siblings.push(record);
    byBase.set(base, siblings);
    declarations.push(record);
    byNode.set(node, record);
    if (callableNode) byNode.set(callableNode, record);
    return record;
  };
  const declarationName = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.name?.getText(tree) ?? "default";
    return undefined;
  };
  const overloadNodes = new Map<ts.Node, ts.Node[]>();
  // Only adjacent signatures of the same name/kind/static modifier form overload groups.
  function findOverloads(node: ts.Node) {
    const children = ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) ? [...node.statements]
      : ts.isClassDeclaration(node) || ts.isClassExpression(node) ? [...node.members] : [];
    for (let i = 0; i < children.length; i++) {
      const first = children[i];
      if (!ts.isFunctionDeclaration(first) && !ts.isMethodDeclaration(first)) continue;
      if (first.body) continue;
      const group: ts.Node[] = [first];
      const staticFlag = (n: ts.Node) => ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
      while (i + 1 < children.length) {
        const candidate = children[i + 1];
        if (candidate.kind !== first.kind || declarationName(candidate) !== declarationName(first) || staticFlag(candidate) !== staticFlag(first)) break;
        group.push(candidate);
        i++;
        if ((candidate as ts.FunctionDeclaration | ts.MethodDeclaration).body) break;
      }
      if (group.length > 1) group.forEach((member) => overloadNodes.set(member, group));
    }
    ts.forEachChild(node, findOverloads);
  }
  findOverloads(tree);
  function visit(node: ts.Node, scope = "", parent?: RepositoryDeclaration) {
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) scope = `${scope}.$static`;
    const group = overloadNodes.get(node);
    if (group && group[0] !== node) return;
    let record: RepositoryDeclaration | undefined;
    let bindingFunction: ts.FunctionExpression | ts.ArrowFunction | undefined;
    if ((ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) || ts.isPropertyDeclaration(node) || (ts.isBindingElement(node) && ts.isIdentifier(node.name)) || (ts.isPropertyAssignment(node) && (ts.isFunctionExpression(node.initializer) || ts.isArrowFunction(node.initializer)))) {
      const initializer = node.initializer;
      if (!ts.isBindingElement(node) && initializer && (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer))) bindingFunction = initializer;
      record = add(node, bindingFunction ? (ts.isVariableDeclaration(node) ? "function" : "method") : "variable", node.name.getText(tree), scope, parent, bindingFunction);
    } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const name = declarationName(node)!;
      record = add(node, ts.isMethodDeclaration(node) ? "method" : "function", name, scope, parent, node);
    } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const name = ts.isFunctionExpression(node) && node.name ? node.name.text : `$callback${next(scope, "callback")}`;
      record = add(node, "function", name, scope, parent, node);
    } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      record = add(node, "class", node.name?.text ?? (ts.isClassDeclaration(node) ? "default" : `$class${next(scope, "class")}`), scope, parent);
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      record = add(node, ts.isInterfaceDeclaration(node) ? "interface" : "type", node.name.text, scope, parent);
    }
    if (record && group) {
      record.signatureRanges = group.filter((member) => !(member as ts.FunctionDeclaration | ts.MethodDeclaration).body).map((member) => sourceRange(tree, member));
      const implementation = group.find((member) => (member as ts.FunctionDeclaration | ts.MethodDeclaration).body);
      record.implementationRange = implementation ? sourceRange(tree, implementation) : undefined;
      const lastRange = sourceRange(tree, group[group.length - 1]);
      record.range = { ...record.range, end: lastRange.end, endLine: lastRange.endLine, endColumn: lastRange.endColumn };
      for (const member of group) {
        byNode.set(member, record);
        ts.forEachChild(member, (child) => visit(child, record!.qualifiedName, record));
      }
      return;
    }
    if (bindingFunction && record) {
      // The binding and its initializer denote the same callable, not two functions.
      ts.forEachChild(bindingFunction, (child) => visit(child, record!.qualifiedName, record));
      return;
    }
    let childScope = record?.qualifiedName ?? scope;
    if (ts.isModuleDeclaration(node)) childScope = `${scope ? `${scope}.` : ""}${node.name.getText(tree)}`;
    if (ts.isObjectLiteralExpression(node)) {
      if (ts.isPropertyAssignment(node.parent)) childScope = `${scope ? `${scope}.` : ""}${node.parent.name.getText(tree)}`;
      else if (!ts.isVariableDeclaration(node.parent) && !ts.isPropertyDeclaration(node.parent)) childScope = `${scope ? `${scope}.` : ""}$object${next(scope, "object")}`;
    }
    if (ts.isBlock(node) && !isCallableNode(node.parent) && !ts.isConstructorDeclaration(node.parent) && !ts.isGetAccessorDeclaration(node.parent) && !ts.isSetAccessorDeclaration(node.parent)) {
      childScope = `${scope ? `${scope}.` : ""}$block${next(scope, "block")}`;
    }
    if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isCatchClause(node)) childScope = `${scope ? `${scope}.` : ""}$scope${next(scope, "loop-catch")}`;
    ts.forEachChild(node, (child) => visit(child, childScope, record ?? parent));
  }
  visit(tree);
  return { declarations, byNode };
}
