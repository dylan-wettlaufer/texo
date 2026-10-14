import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { isCallableNode, sourceRange } from "./declarations.mts";
import type { DeclarationAnalysis } from "./declarations.mts";
import type { ModuleBinding, ModuleReference, RepositoryIndex, RepositoryDeclaration } from "./types.mts";

const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
export interface ParsedSource extends DeclarationAnalysis {
  tree: ts.SourceFile;
  fileId: string;
}
/** No repository source is reread: programs operate on the Phase A snapshot. */
export function extractRelationships(root: string, sources: ParsedSource[], index: RepositoryIndex) {
  const sourceByPath = new Map(sources.map((source) => [source.tree.fileName, source]));
  const byNode = new Map(sources.flatMap((source) => [...source.byNode]));
  const jsonCache = new Map<string, string | undefined>();
  function safePath(name: string) {
    const full = path.resolve(name);
    if (full !== root && !full.startsWith(root + path.sep)) return undefined;
    try {
      // Reject symlinked paths, including ancestors, even when the target is inside root.
      if (realpathSync(full) !== full) return undefined;
      return full;
    } catch { return undefined; }
  }
  const host: ts.ModuleResolutionHost = {
    fileExists(name) {
      const full = path.resolve(name);
      if (sourceByPath.has(full)) return true;
      const safe = safePath(full);
      return Boolean(safe && lstatSync(safe).isFile());
    },
    readFile(name) {
      const full = path.resolve(name);
      const source = sourceByPath.get(full);
      if (source) return source.tree.text;
      if (jsonCache.has(full)) return jsonCache.get(full);
      const safe = safePath(full);
      let content: string | undefined;
      if (safe && /\.jsonc?$/.test(full) && lstatSync(safe).size <= MAX_CONFIG_BYTES) {
        try { content = readFileSync(safe, "utf8"); } catch { /* Reported by config parsing/resolution. */ }
      }
      jsonCache.set(full, content);
      return content;
    },
    directoryExists(name) {
      const safe = safePath(name);
      return Boolean(safe && lstatSync(safe).isDirectory());
    },
    getCurrentDirectory: () => root,
    realpath: (name) => safePath(name) ?? name,
  };
  const defaultOptions: ts.CompilerOptions = {
    allowJs: true, checkJs: false, noEmit: true, noLib: true,
    target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.Preserve,
    allowImportingTsExtensions: true,
  };
  const configOptions = new Map<string, ts.CompilerOptions>();
  function optionsFor(fileName: string) {
    let directory = path.dirname(fileName);
    let config: string | undefined;
    while (directory === root || directory.startsWith(root + path.sep)) {
      config = ["tsconfig.json", "jsconfig.json"].map((name) => path.join(directory, name)).find((name) => host.fileExists(name));
      if (config || directory === root) break;
      directory = path.dirname(directory);
    }
    if (!config) return { key: "default", options: defaultOptions };
    let options = configOptions.get(config);
    if (!options) {
      const configFile = ts.readConfigFile(config, (name) => host.readFile(name));
      const report = (diagnostic: ts.Diagnostic) => index.diagnostics.push({ code: "config-error", path: path.relative(root, config!).split(path.sep).join("/"), message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").replaceAll(root, "<root>") });
      if (configFile.error) report(configFile.error);
      const parsed = ts.parseJsonConfigFileContent(configFile.config ?? {}, {
        useCaseSensitiveFileNames: true,
        fileExists: host.fileExists,
        readFile: host.readFile,
        // Discovery owns inclusion. Avoid a second filesystem crawl for config globs.
        readDirectory: () => [],
      }, path.dirname(config), undefined, config);
      parsed.errors.filter((diagnostic) => diagnostic.code !== 18003 && diagnostic.code !== 18002).forEach(report);
      options = { ...defaultOptions, ...parsed.options, noEmit: true, noLib: true, allowJs: true };
      configOptions.set(config, options);
    }
    return { key: config, options };
  }
  const programs = new Map<string, ts.Program>();
  function programFor(fileName: string) {
    const { key, options } = optionsFor(fileName);
    let program = programs.get(key);
    if (!program) {
      const compilerHost: ts.CompilerHost = {
        ...host,
        getSourceFile: (name) => sourceByPath.get(path.resolve(name))?.tree,
        getDefaultLibFileName: () => "",
        writeFile: () => { throw new Error("Repository analysis cannot emit files"); },
        getCanonicalFileName: (name) => path.resolve(name),
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getCurrentDirectory: () => root,
        // Programs must not bypass the repository-bound resolution host.
        resolveModuleNames: (names, containingFile) => names.map((name) => ts.resolveModuleName(name, containingFile, optionsFor(containingFile).options, host).resolvedModule),
      };
      program = ts.createProgram({ rootNames: [...sourceByPath.keys()], options, host: compilerHost });
      programs.set(key, program);
    }
    return { program, options };
  }
  function moduleResolution(specifier: string, containingFile: string, options: ts.CompilerOptions): Pick<ModuleReference, "resolution" | "targetFileId" | "unresolvedReason"> {
    const resolved = ts.resolveModuleName(specifier, containingFile, options, host).resolvedModule;
    const target = resolved && sourceByPath.get(path.resolve(resolved.resolvedFileName));
    if (target) return { resolution: "local", targetFileId: target.fileId };
    const bare = !specifier.startsWith(".") && !path.isAbsolute(specifier);
    const alias = Object.keys(options.paths ?? {}).some((pattern) => {
      const star = pattern.indexOf("*");
      return star < 0 ? pattern === specifier : specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1));
    });
    if (bare && !alias && !specifier.startsWith("#")) return { resolution: "external", unresolvedReason: "External packages are not indexed" };
    return { resolution: "unresolved", unresolvedReason: resolved ? "Resolved file is outside the captured source index" : "Module could not be resolved" };
  }
  for (const source of sources) {
    const { program, options } = programFor(source.tree.fileName);
    const checker = program.getTypeChecker();
    let moduleCount = 0;
    let callCount = 0;
    const addModule = (node: ts.Node, kind: ModuleReference["kind"], specifier: string | undefined, bindings: ModuleBinding[], typeOnly = false) => {
      const record: ModuleReference = { id: `${source.fileId}#module:${++moduleCount}`, fileId: source.fileId, kind,
        ...(specifier !== undefined ? { specifier } : {}), bindings, typeOnly, range: sourceRange(source.tree, node),
        ...(specifier === undefined ? { resolution: "not-applicable" as const } : moduleResolution(specifier, source.tree.fileName, options)),
      };
      index.modules.push(record);
      if (record.resolution === "unresolved") index.diagnostics.push({ code: "module-unresolved", path: source.fileId, range: record.range, message: `${specifier}: ${record.unresolvedReason}` });
    };
    const followAlias = (symbol: ts.Symbol | undefined) => {
      const seen = new Set<ts.Symbol>();
      while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        if (seen.has(symbol)) return undefined;
        seen.add(symbol);
        symbol = checker.getAliasedSymbol(symbol);
      }
      return symbol;
    };
    const callableTargets = (symbol: ts.Symbol | undefined) => {
      const targets = new Map<string, RepositoryDeclaration>();
      const seen = new Set<ts.Symbol>();
      function collect(candidate: ts.Symbol | undefined) {
        const resolved = followAlias(candidate);
        if (!resolved || seen.has(resolved)) return;
        seen.add(resolved);
        for (const declaration of resolved.declarations ?? []) {
          const node = ts.isExportAssignment(declaration) ? declaration.expression : declaration;
          const record = byNode.get(node);
          if (record?.callable) targets.set(record.id, record);
          else if (ts.isExportAssignment(declaration) && (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))) collect(checker.getSymbolAtLocation(node));
        }
      }
      collect(symbol);
      return [...targets.values()];
    };
    function resolveCall(node: ts.CallExpression): { target?: RepositoryDeclaration; reason?: string } {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return { reason: "Dynamic import is a module load, not an indexed function" };
      const expression = node.expression;
      if (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression)) return { reason: "Dynamic callee expression" };
      if (ts.isPropertyAccessExpression(expression)) {
        const receiver = expression.expression;
        // Higher-order return values and arbitrary expressions are intentionally excluded.
        const staticReceiver = (candidate: ts.Expression): boolean => ts.isIdentifier(candidate) || candidate.kind === ts.SyntaxKind.ThisKeyword
          || (ts.isNewExpression(candidate) && staticReceiver(candidate.expression)) || (ts.isPropertyAccessExpression(candidate) && staticReceiver(candidate.expression));
        if (!staticReceiver(receiver)) return { reason: "Dynamic method receiver" };
        const rawReceiverType = checker.getTypeAtLocation(receiver);
        const receiverType = receiver.kind === ts.SyntaxKind.ThisKeyword ? checker.getBaseConstraintOfType(rawReceiverType) ?? rawReceiverType : rawReceiverType;
        if (receiverType.isUnion() || receiverType.isIntersection() || receiverType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) return { reason: "Ambiguous or unknown method receiver" };
      }
      const targets = callableTargets(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression) ? expression.name : expression));
      if (targets.length !== 1 || targets.some((target) => target.duplicate)) return { reason: targets.length ? "Ambiguous callable declarations" : "No directly indexed callable implementation" };
      const target = targets[0];
      if (!target.implementationRange) return { reason: "Callable has signatures but no indexed implementation" };
      return { target };
    }
    function visit(node: ts.Node, caller?: RepositoryDeclaration) {
      const own = byNode.get(node);
      // Constructors/accessors are not indexed callables; do not attribute their calls to an outer function.
      const nextCaller = isCallableNode(node) ? own : ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node) ? undefined : caller;
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const bindings: ModuleBinding[] = [];
        const clause = node.importClause;
        if (clause?.name) bindings.push({ name: "default", localName: clause.name.text, typeOnly: clause.isTypeOnly });
        if (clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) bindings.push({ name: "*", localName: clause.namedBindings.name.text, typeOnly: clause.isTypeOnly });
          else for (const element of clause.namedBindings.elements) bindings.push({ name: element.propertyName?.text ?? element.name.text, localName: element.name.text, typeOnly: clause.isTypeOnly || element.isTypeOnly });
        }
        addModule(node, "import", node.moduleSpecifier.text, bindings, clause?.isTypeOnly ?? false);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
        addModule(node, "import", node.moduleReference.expression.text, [{ name: "*", localName: node.name.text, typeOnly: node.isTypeOnly }], node.isTypeOnly);
      } else if (ts.isExportDeclaration(node)) {
        const bindings: ModuleBinding[] = [];
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) bindings.push({ name: element.name.text, localName: element.propertyName?.text ?? element.name.text, typeOnly: node.isTypeOnly || element.isTypeOnly });
        } else bindings.push({ name: node.exportClause && ts.isNamespaceExport(node.exportClause) ? node.exportClause.name.text : "*", typeOnly: node.isTypeOnly });
        addModule(node, "export", node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined, bindings, node.isTypeOnly);
      } else if (ts.isExportAssignment(node)) {
        addModule(node, "export", undefined, [{ name: node.isExportEquals ? "export=" : "default", localName: node.expression.getText(source.tree), typeOnly: false }]);
      } else if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const isDefault = ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
        const bindingNames = (name: ts.BindingName): string[] => ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => ts.isBindingElement(element) ? bindingNames(element.name) : []);
        const declarations = ts.isVariableStatement(node) ? node.declarationList.declarations.flatMap((declaration) => bindingNames(declaration.name))
          : "name" in node && node.name && ts.isIdentifier(node.name as ts.Node) ? [(node.name as ts.Identifier).text] : ["default"];
        const typeOnly = ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);
        addModule(node, "export", undefined, declarations.map((name) => ({ name: isDefault ? "default" : name, localName: name, typeOnly })), typeOnly);
      }
      if (ts.isCallExpression(node)) {
        const argument = node.arguments[0];
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require" && !checker.getSymbolAtLocation(node.expression)?.declarations?.some((declaration) => sourceByPath.has(declaration.getSourceFile().fileName));
        if (argument && ts.isStringLiteralLike(argument)) {
          if (node.expression.kind === ts.SyntaxKind.ImportKeyword) addModule(node, "dynamic-import", argument.text, []);
          else if (isRequire) addModule(node, "require", argument.text, []);
        }
        const { target, reason } = resolveCall(node);
        index.calls.push({ id: `${source.fileId}#call:${++callCount}`, fileId: source.fileId,
          ...(caller ? { callerDeclarationId: caller.id } : {}), callee: node.expression.getText(source.tree), range: sourceRange(source.tree, node),
          ...(target ? { resolution: "resolved", targetDeclarationId: target.id } : { resolution: "unresolved", unresolvedReason: reason ?? "Unresolved call" }),
        });
      }
      ts.forEachChild(node, (child) => visit(child, nextCaller));
    }
    visit(source.tree);
  }
}
