import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createRepositoryQuery, parseRepository } from "./index.mts";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "texo-query-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  const sources = {
    "a.ts": '// 🙂\r\nexport function target(x: number): number;\r\nexport function target(x: number) { if (x > 0) return target(x - 1); return x; }\r\nexport function outer() { target(1); target(2); function nested() { target(3); } missing(); }\r\ntarget(0);\r\n',
    "b.ts": "import { target } from './a'; import type { Shape } from './types'; import 'external'; import './absent'; export { target } from './a'; export function run() { target(4); } export function twin() {} import('./a'); require('./a');",
    "c.ts": "function twin() {} function twin() {}",
    "types.d.ts": "export interface Shape { x: number } export declare function signature(): void;",
  };
  for (const [name, source] of Object.entries(sources)) await writeFile(path.join(root, name), source);
  const index = await parseRepository({ rootPath: root });
  return { root, index, sources, query: createRepositoryQuery(index) };
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
}
function named(query, name, fileId) {
  const result = query.searchDeclarations({ text: name, fileId });
  return result.items.find((item) => item.name === name);
}

test("query: filtered summaries, source ordering, stable pages and aggregate counts", async (t) => {
  const { index, query } = await fixture(t);
  const summary = query.getSummary();
  assert.equal(summary.files, index.files.length);
  assert.equal(summary.declarations, index.declarations.length);
  assert.equal(summary.calls.resolved + summary.calls.unresolved, summary.calls.total);
  assert.equal(summary.calls.total, index.calls.length);
  assert.equal(summary.modules.local + summary.modules.external + summary.modules.unresolved + summary.modules["not-applicable"], index.modules.length);
  assert.equal(summary.diagnostics.total, index.diagnostics.length);
  assert.equal(summary.diagnostics.byCode["duplicate-declaration"], 1);
  assert.equal(summary.diagnostics.byCode["module-unresolved"], 1);
  const files = query.listFiles({ offset: 1, limit: 2 });
  assert.deepEqual(files.items.map((file) => file.path), ["b.ts", "c.ts"]);
  assert.equal(files.total, 4);
  assert.ok(files.items.every((file) => !("content" in file)));
  assert.equal(query.listFiles({ pathContains: "TYPES" }).items[0].path, "types.d.ts");
  const declarations = query.searchDeclarations({ text: "TARGET", fileId: "a.ts", kind: "function" });
  assert.equal(declarations.total, 1);
  assert.equal(query.searchDeclarations({ text: "outer.nest" }).items[0].name, "nested");
  assert.equal(query.searchDeclarations({ text: "target", kind: "class" }).total, 0);
  assert.equal(query.searchDeclarations({ text: "absent" }).total, 0);
  assert.equal(query.listFiles({ offset: 100 }).items.length, 0);
  assert.equal(query.listFiles().limit, 50);
  const shuffled = { ...index, files: [...index.files].reverse(), declarations: [...index.declarations].reverse(), calls: [...index.calls].reverse(), modules: [...index.modules].reverse() };
  const reversed = createRepositoryQuery(shuffled);
  assert.deepEqual(query.listFiles(), reversed.listFiles());
  assert.deepEqual(query.searchDeclarations({ text: "" }), reversed.searchDeclarations({ text: "" }));
  assert.deepEqual(query.getModules("b.ts"), reversed.getModules("b.ts"));
  const order = query.searchDeclarations({ text: "", fileId: "a.ts" }).items.map((item) => item.name);
  assert.deepEqual(order, ["target", "outer", "nested"]);
});

test("query: overload implementation, signatures, Unicode/CRLF source and missing details", async (t) => {
  const { query, sources } = await fixture(t);
  const target = query.getDeclaration(named(query, "target").id);
  assert.equal(target.source, 'export function target(x: number) { if (x > 0) return target(x - 1); return x; }');
  assert.equal(target.signatures[0].source, "export function target(x: number): number;");
  assert.deepEqual(target.sourceRange, target.implementationRange);
  assert.equal(target.sourceRange.startLine, 3);
  const signature = query.getDeclaration(named(query, "signature").id);
  assert.equal(signature.implementationRange, undefined);
  assert.equal(signature.source, "export declare function signature(): void;");
  assert.deepEqual(signature.sourceRange, signature.range);
  const file = query.getFile("a.ts");
  assert.equal(file.content, sources["a.ts"]);
  assert.equal(file.declarations.length, 3);
  assert.equal(query.getFile("missing.ts"), undefined);
  assert.equal(query.getDeclaration("missing"), undefined);
});

test("query: incoming calls retain recursion, repeated sites and top-level callers; outgoing calls exclude nested functions", async (t) => {
  const { query } = await fixture(t);
  const target = named(query, "target").id;
  const outer = named(query, "outer").id;
  const incoming = query.getCallers(target);
  assert.equal(incoming.total, 6);
  assert.ok(incoming.items.some((call) => !call.callerDeclarationId && !call.caller));
  assert.ok(incoming.items.some((call) => call.callerDeclarationId === target));
  assert.equal(incoming.items.filter((call) => call.callerDeclarationId === outer).length, 2);
  assert.ok(incoming.items.every((call) => call.target.id === target && call.resolution === "resolved"));
  const outgoing = query.getCallees(outer);
  assert.equal(outgoing.total, 3);
  assert.deepEqual(outgoing.items.map((call) => call.callee), ["target", "target", "missing"]);
  assert.equal(outgoing.items[2].resolution, "unresolved");
  assert.ok(outgoing.items[2].unresolvedReason);
  assert.ok(outgoing.items.every((call) => call.caller.id === outer && !("content" in (call.target ?? {}))));
  assert.equal(query.getCallees(named(query, "nested").id).total, 1);
  assert.equal(query.getCallers(named(query, "signature").id).total, 0);
  assert.equal(query.getCallers(target, { offset: 1, limit: 2 }).items.length, 2);
});

test("query: module directions preserve types, re-exports and unresolved/external references", async (t) => {
  const { query } = await fixture(t);
  const outgoing = query.getModules("b.ts");
  assert.ok(outgoing.items.some((reference) => reference.typeOnly && reference.targetFileId === "types.d.ts"));
  assert.ok(outgoing.items.some((reference) => reference.resolution === "external"));
  assert.ok(outgoing.items.some((reference) => reference.resolution === "unresolved" && reference.unresolvedReason));
  assert.ok(outgoing.items.filter((reference) => reference.target).every((reference) => !("content" in reference.target)));
  assert.deepEqual(query.getModules("a.ts", { direction: "incoming" }).items.map((reference) => reference.kind), ["import", "export", "dynamic-import", "require"]);
  assert.ok(query.getModules("a.ts").items.every((reference) => reference.kind === "export"));
  assert.equal(query.getModules("types.d.ts", { direction: "incoming", limit: 1 }).total, 1);
  assert.throws(() => query.getModules("a.ts", { direction: "invalid" }), /direction/);
});

test("query: pagination validation, unknown relationship IDs and detached results", async (t) => {
  const { index } = await fixture(t);
  const before = JSON.stringify(index);
  freeze(index);
  const query = createRepositoryQuery(index);
  const id = named(query, "target").id;
  for (const options of [{ offset: -1 }, { offset: 0.5 }, { offset: Infinity }, { offset: Number.MAX_SAFE_INTEGER + 1 }, { limit: 0 }, { limit: 201 }, { limit: NaN }]) {
    for (const call of [() => query.listFiles(options), () => query.searchDeclarations({ text: "", ...options }), () => query.getCallers(id, options), () => query.getCallees(id, options), () => query.getModules("a.ts", options)]) assert.throws(call);
  }
  assert.throws(() => query.getCallers("missing"), /Unknown declaration/);
  assert.throws(() => query.getCallees("missing"), /Unknown declaration/);
  assert.throws(() => query.getModules("missing"), /Unknown file/);
  const detail = query.getDeclaration(id);
  detail.range.start = 100000;
  detail.signatures[0].source = "modified";
  const calls = query.getCallers(id);
  calls.items[0].target.name = "modified";
  const file = query.getFile("a.ts");
  file.content = "modified";
  file.declarations[0].range.start = 100000;
  query.getSummary().diagnostics.byCode.fake = 1;
  assert.notEqual(query.getDeclaration(id).range.start, 100000);
  assert.notEqual(query.getCallers(id).items[0].target.name, "modified");
  assert.notEqual(query.getFile("a.ts").content, "modified");
  assert.equal(query.getSummary().diagnostics.byCode.fake, undefined);
  assert.equal(JSON.stringify(index), before);
});

const entry = fileURLToPath(new URL("../../scripts/repo-query.mts", import.meta.url));
function cli(root, ...args) { return spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: "utf8" }); }

test("query CLI: summary, search, source details, name/ID selection and readable relationships", async (t) => {
  const { root, query } = await fixture(t);
  const summary = cli(root);
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /Files: 4/);
  assert.match(summary.stderr, /module-unresolved/);
  assert.doesNotMatch(summary.stderr, /MODULE_TYPELESS/);
  const search = cli(root, "search", "TARGET");
  assert.match(search.stdout, /target \(function\)/);
  assert.match(search.stdout, /a.ts:3:1|a.ts:2:1/);
  const target = named(query, "target");
  const declaration = cli(root, "declaration", "target");
  assert.equal(declaration.status, 0, declaration.stderr);
  assert.match(declaration.stdout, /Implementation:/);
  assert.match(declaration.stdout, /Signatures:/);
  assert.equal(cli(root, "declaration", target.id).stdout, declaration.stdout);
  assert.equal(cli(root, "declaration", "outer.nested").status, 0);
  assert.match(cli(root, "callers", "target").stdout, /none \(outside an indexed callable\)/);
  assert.match(cli(root, "callees", "outer").stdout, /Unresolved:/);
  assert.match(cli(root, "modules", "a.ts", "--incoming").stdout, /Incoming module references/);
  assert.match(cli(root, "file", "./a.ts").stdout, /Source:/);
  assert.equal(cli(root, "declaration", "twin", "--file", "b.ts").status, 0);
});

test("query CLI: targeted JSON, root override, pagination, filters and npm command", async (t) => {
  const { root } = await fixture(t);
  for (const args of [["summary"], ["files"], ["search", "target"], ["file", "a.ts"], ["declaration", "target"], ["callers", "target"], ["callees", "outer"], ["modules", "a.ts", "--incoming"]]) {
    const result = cli(root, ...args, "--json");
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.ok(data);
    assert.ok(!("files" in data && Array.isArray(data.files)));
  }
  const filtered = cli(root, "search", "twin", "--file", "c.ts", "--limit", "1", "--offset", "1", "--json");
  assert.equal(JSON.parse(filtered.stdout).total, 2);
  assert.equal(JSON.parse(filtered.stdout).items.length, 1);
  const project = fileURLToPath(new URL("../../", import.meta.url));
  const npm = spawnSync("npm", ["run", "--silent", "repo:query", "--", "files", "types", "--root", root, "--json"], { cwd: project, encoding: "utf8" });
  assert.equal(npm.status, 0, npm.stderr);
  assert.equal(JSON.parse(npm.stdout).items[0].path, "types.d.ts");
});

test("query CLI: help avoids scans; invalid input, missing records and ambiguity fail without stdout", async (t) => {
  const { root, query } = await fixture(t);
  const help = cli(root, "--help", "--root", "/definitely/missing");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(help.stderr, "");
  const cases = [["unknown"], ["search"], ["summary", "extra"], ["files", "--limit", "0"], ["files", "--offset", "-1"], ["files", "--limit", "201"], ["files", "--limit", "1.5"], ["file", "a.ts", "--offset", "1"], ["summary", "--incoming"], ["summary", "--file", "a.ts"], ["files", "--bad"], ["file", "missing.ts"], ["modules", "missing.ts"], ["declaration", "missing"], ["declaration", "twin"], ["callers", "twin", "--file", "c.ts"], ["declaration", "target", "--file", "b.ts"], ["file", "../outside.ts"], ["summary", "--root", "/definitely/missing"]];
  for (const args of cases) {
    const result = cli(root, ...args);
    assert.notEqual(result.status, 0, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, /Repository query failed:/);
  }
  const ambiguous = cli(root, "declaration", "twin");
  for (const candidate of query.searchDeclarations({ text: "twin" }).items) assert.ok(ambiguous.stderr.includes(candidate.id));
});
