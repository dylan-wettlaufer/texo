import path from "node:path";
import { parseArgs } from "node:util";
import { createRepositoryQuery, parseRepository } from "../lib/repository/index.mts";
import { validatePage } from "../lib/repository/query.mts";
import type { CallQueryResult, DeclarationDetail, DeclarationSummary, ModuleQueryResult, QueryPage, RepositoryQuery } from "../lib/repository/query-types.mts";

const help = `Usage: npm run repo:query -- [command] [options]

Commands:
  summary                  Index counts (default)
  files [path-filter]      List files without source
  search <text>            Search declaration names
  file <relative-path>     Captured source and declarations
  declaration <selector>   Declaration source and signatures
  callers <selector>       Resolved incoming call sites
  callees <selector>       Outgoing call sites, including unresolved calls
  modules <relative-path>  Outgoing module references; --incoming reverses direction

Options:
  --root <checkout-root>   Scan this checkout instead of the current directory
  --json                   Emit only the targeted JSON result to stdout
  --file <relative-path>   Filter search or disambiguate a declaration selector
  --offset <integer>       List offset (default 0)
  --limit <1-200>           List size (default 50)
  --incoming               Incoming references (modules only)
  --help                   Show help without scanning

Selectors are exact IDs or unique exact names/qualified names.
Use npm run --silent repo:query for clean output when piping.
`;
const commands = ["summary", "files", "search", "file", "declaration", "callers", "callees", "modules"] as const;
type Command = typeof commands[number];
const listCommands: readonly Command[] = ["files", "search", "callers", "callees", "modules"];
function relativePath(value: string) {
  const normalized = path.posix.normalize(value);
  if (path.isAbsolute(value) || value.includes("\\") || normalized === ".." || normalized.startsWith("../")) throw new Error(`Expected a repository-relative path: ${value}`);
  return normalized;
}
function location(item: { fileId: string; range: { startLine: number; startColumn: number } }) {
  return `${item.fileId}:${item.range.startLine}:${item.range.startColumn}`;
}
function declarationLine(item: DeclarationSummary) {
  return `${item.qualifiedName} (${item.kind}${item.duplicate ? ", duplicate" : ""}) — ${location(item)}\n  ${item.id}`;
}
function pageText<T>(result: QueryPage<T>, render: (item: T) => string) {
  const first = result.items.length ? result.offset + 1 : 0;
  const last = result.items.length ? result.offset + result.items.length : 0;
  return [...result.items.map(render), `Showing ${first}–${last} of ${result.total}.`].join("\n");
}
function selectDeclaration(query: RepositoryQuery, selector: string, fileId?: string): DeclarationDetail {
  const exact = query.getDeclaration(selector);
  if (exact && (!fileId || exact.fileId === fileId)) return exact;
  const matches: DeclarationSummary[] = [];
  let offset = 0;
  while (true) {
    const result = query.searchDeclarations({ text: selector, fileId, offset, limit: 200 });
    matches.push(...result.items.filter((item) => item.name === selector || item.qualifiedName === selector));
    offset += result.items.length;
    if (offset >= result.total) break;
  }
  if (!matches.length) throw new Error(`Declaration not found: ${selector}${fileId ? ` in ${fileId}` : ""}`);
  if (matches.length > 1) throw new Error(`Ambiguous declaration: ${selector}. Use an exact ID or --file.\n${matches.map(declarationLine).join("\n")}`);
  return query.getDeclaration(matches[0].id)!;
}
function callLine(call: CallQueryResult) {
  return `${location(call)} — ${call.callee}\n  Caller: ${call.caller?.qualifiedName ?? "none (outside an indexed callable)"}\n  ${call.resolution === "resolved" ? `Resolved: ${call.target?.qualifiedName ?? call.targetDeclarationId} (${call.targetDeclarationId})` : `Unresolved: ${call.unresolvedReason}`}`;
}
function moduleLine(reference: ModuleQueryResult) {
  const bindings = reference.bindings.map((binding) => `${binding.typeOnly ? "type " : ""}${binding.localName && binding.localName !== binding.name ? `${binding.localName} → ` : ""}${binding.name}`).join(", ");
  return `${location(reference)} — ${reference.kind}${reference.typeOnly ? " (type only)" : ""} ${reference.specifier ?? "(local export)"}${bindings ? ` [${bindings}]` : ""}\n  ${reference.resolution}${reference.targetFileId ? `: ${reference.targetFileId}` : reference.unresolvedReason ? `: ${reference.unresolvedReason}` : ""}`;
}
async function main() {
  const { values, positionals } = parseArgs({ options: {
    root: { type: "string" }, json: { type: "boolean" }, file: { type: "string" },
    offset: { type: "string" }, limit: { type: "string" }, incoming: { type: "boolean" }, help: { type: "boolean" },
  }, allowPositionals: true, strict: true });
  if (values.help) { process.stdout.write(help); return; }
  const name = positionals[0] ?? "summary";
  if (!commands.includes(name as Command)) throw new Error(`Unknown command: ${name}. Use --help.`);
  const command = name as Command;
  const args = positionals.slice(1);
  const required = command !== "summary" && command !== "files";
  if ((required && args.length !== 1) || (!required && args.length > (command === "files" ? 1 : 0))) throw new Error(`Invalid arguments for ${command}. Use --help.`);
  if (values.incoming && command !== "modules") throw new Error("--incoming is only supported by modules");
  if (values.file !== undefined && !["search", "declaration", "callers", "callees"].includes(command)) throw new Error("--file is only supported by search and declaration selectors");
  if ((values.offset !== undefined || values.limit !== undefined) && !listCommands.includes(command)) throw new Error("--offset and --limit require a list command");
  const integer = (value: string | undefined, fallback: number) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw new Error("Pagination values must be nonnegative integers");
    return Number(value);
  };
  const pagination = validatePage({ offset: integer(values.offset, 0), limit: integer(values.limit, 50) });
  const fileId = values.file !== undefined ? relativePath(values.file) : undefined;
  if (command === "file" || command === "modules") args[0] = relativePath(args[0]);
  const index = await parseRepository({ rootPath: values.root ?? process.cwd() });
  for (const diagnostic of index.diagnostics) process.stderr.write(`[${diagnostic.code}] ${diagnostic.path ?? "repository"}: ${diagnostic.message}\n`);
  const query = createRepositoryQuery(index);
  if (fileId && !query.getFile(fileId)) throw new Error(`File not found: ${fileId}`);
  let result: unknown;
  let text: string;
  switch (command) {
    case "summary": {
      const summary = query.getSummary();
      result = summary;
      text = `Files: ${summary.files}\nDeclarations: ${summary.declarations}\nCalls: ${summary.calls.total} (${summary.calls.resolved} resolved, ${summary.calls.unresolved} unresolved)\nModules: ${summary.modules.total} (${summary.modules.local} local, ${summary.modules.external} external, ${summary.modules.unresolved} unresolved, ${summary.modules["not-applicable"]} local exports)\nDiagnostics: ${summary.diagnostics.total}${Object.entries(summary.diagnostics.byCode).map(([code, count]) => `\n  ${code}: ${count}`).join("")}`;
      break;
    }
    case "files": {
      const files = query.listFiles({ pathContains: args[0], ...pagination });
      result = files;
      text = pageText(files, (file) => `${file.path} (${file.status}${file.declarationFile ? ", declaration file" : ""})`);
      break;
    }
    case "search": {
      const declarations = query.searchDeclarations({ text: args[0], fileId, ...pagination });
      result = declarations;
      text = pageText(declarations, declarationLine);
      break;
    }
    case "file": {
      const file = query.getFile(args[0]);
      if (!file) throw new Error(`File not found: ${args[0]}`);
      result = file;
      text = `${file.path} (${file.status})\nDeclarations: ${file.declarations.length}\n${file.declarations.map(declarationLine).join("\n")}\n\nSource:\n${file.content}`;
      break;
    }
    case "declaration": {
      const declaration = selectDeclaration(query, args[0], fileId);
      result = declaration;
      text = `${declarationLine(declaration)}\n\n${declaration.implementationRange ? "Implementation" : "Declaration"}:\n${declaration.source}${declaration.signatures.length ? `\n\nSignatures:\n${declaration.signatures.map((signature) => signature.source).join("\n")}` : ""}`;
      break;
    }
    case "callers":
    case "callees": {
      const declaration = selectDeclaration(query, args[0], fileId);
      const calls = command === "callers" ? query.getCallers(declaration.id, pagination) : query.getCallees(declaration.id, pagination);
      result = calls;
      text = `${command === "callers" ? "Callers" : "Callees"} of ${declaration.qualifiedName}:\n${pageText(calls, callLine)}`;
      break;
    }
    case "modules": {
      const references = query.getModules(args[0], { direction: values.incoming ? "incoming" : "outgoing", ...pagination });
      result = references;
      text = `${values.incoming ? "Incoming" : "Outgoing"} module references for ${args[0]}:\n${pageText(references, moduleLine)}`;
      break;
    }
  }
  process.stdout.write(values.json ? `${JSON.stringify(result, null, 2)}\n` : `${text}\n`);
}
main().catch((error: unknown) => {
  process.stderr.write(`Repository query failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
