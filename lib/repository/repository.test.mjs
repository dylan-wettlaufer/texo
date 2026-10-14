import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseRepository, MAX_SOURCE_BYTES } from "./index.mts";

export async function checkout(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), "texo-parser-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  }
  return root;
}

test("Phase A: extension coverage, exact ranges, nested declarations, overloads and deterministic scans", async (t) => {
  const root = await checkout(t, {
    "code.ts": `export function parse(x: string): string;\nexport function parse(x: number): number;\nexport function parse(x: string | number) {\n  function nested() { return x; }\n  [1].map(() => nested());\n  return x;\n}\nconst arrow = (x: number) => x;\nconst obj = { method() { return arrow(1); } };\nclass C { method(x: string): string; method(x: string) { return x; } }\ninterface I { x: number }\ntype T = I;\n`,
    "view.tsx": "export const View = () => <div/>;",
    "view.jsx": "export function View() { return <div/>; }",
    "a.js": "const f = function () { return 1; };",
    "b.mjs": "export function b() {}",
    "c.cjs": "function c() {}",
    "d.mts": "export function d() {}",
    "e.cts": "function e() {}",
    "types.d.ts": "declare function signature(): void;",
  });
  const result = await parseRepository({ rootPath: root });
  assert.equal(result.files.length, 9);
  assert.equal(result.repository.head, null);
  assert.deepEqual(result, await parseRepository({ rootPath: root }));
  assert.deepEqual(result.diagnostics, []);
  const parse = result.declarations.find((d) => d.name === "parse");
  assert.equal(result.declarations.filter((d) => d.name === "parse").length, 1);
  assert.equal(parse.signatureRanges.length, 2);
  assert.ok(parse.implementationRange);
  assert.equal(result.declarations.find((d) => d.name === "nested").parentId, parse.id);
  assert.ok(result.declarations.some((d) => d.name === "$callback1"));
  assert.equal(result.declarations.find((d) => d.name === "arrow").kind, "function");
  assert.ok(result.files.find((f) => f.path === "types.d.ts").declarationFile);
  for (const declaration of result.declarations) {
    const file = result.files.find((f) => f.id === declaration.fileId);
    const ranges = [declaration.range, ...declaration.signatureRanges, declaration.implementationRange].filter(Boolean);
    for (const range of ranges) {
      assert.ok(range.end > range.start);
      assert.ok(file.content.slice(range.start, range.end).length);
      const before = file.content.slice(0, range.start).split("\n");
      assert.equal(range.startLine, before.length);
      assert.equal(range.startColumn, before.at(-1).length + 1);
      const through = file.content.slice(0, range.end).split("\n");
      assert.equal(range.endLine, through.length);
      assert.equal(range.endColumn, through.at(-1).length + 1);
    }
  }
  const ids = result.declarations.filter((d) => d.fileId === "code.ts").map((d) => d.id);
  await writeFile(path.join(root, "code.ts"), "// unrelated shift\n\n" + result.files.find((f) => f.id === "code.ts").content);
  const shifted = await parseRepository({ rootPath: root });
  assert.deepEqual(shifted.declarations.filter((d) => d.fileId === "code.ts").map((d) => d.id), ids);
  assert.notEqual(shifted.repository.contentHash, result.repository.contentHash);
});

test("Phase A: duplicate declarations stay distinct and syntax failures are partial", async (t) => {
  const root = await checkout(t, { "duplicates.ts": "function same() {}\nfunction same() {}", "broken.ts": "function valid() {}\nconst broken = ;" });
  const result = await parseRepository({ rootPath: root });
  const duplicates = result.declarations.filter((d) => d.name === "same");
  assert.equal(duplicates.length, 2);
  assert.ok(duplicates.every((d) => d.duplicate));
  assert.notEqual(duplicates[0].id, duplicates[1].id);
  assert.ok(result.diagnostics.some((d) => d.code === "duplicate-declaration"));
  assert.equal(result.files.find((f) => f.id === "broken.ts").status, "partial");
  assert.ok(result.declarations.some((d) => d.name === "valid"));
});

test("Phase A: Git discovery respects ignores, exclusions, symlinks, working edits and deletions", async (t) => {
  const root = await checkout(t, { ".gitignore": "ignored.ts\n", "ignored.ts": "const ignored=1;", "tracked.ts": "const old=1;", "deleted.ts": "const deleted=1;", "dist/tracked.ts": "const built=1;", "node_modules/pkg/index.ts": "const dependency=1;" });
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"]);
  await writeFile(path.join(root, "tracked.ts"), "const edited=2;");
  await writeFile(path.join(root, "untracked.ts"), "const untracked=1;");
  await rm(path.join(root, "deleted.ts"));
  await symlink(path.join(root, "tracked.ts"), path.join(root, "link.ts"));
  const result = await parseRepository({ rootPath: root });
  assert.deepEqual(result.files.map((f) => f.path), ["tracked.ts", "untracked.ts"]);
  assert.equal(result.files[0].content, "const edited=2;");
  assert.match(result.repository.head, /^[a-f0-9]{40,64}$/);
  assert.ok(result.diagnostics.some((d) => d.path === "deleted.ts" && d.code === "source-unreadable"));
  assert.ok(result.diagnostics.some((d) => d.code === "symlink-skipped"));
});

test("Phase A: discovery is injectable; unsafe paths, missing files and size limits are diagnosed", async (t) => {
  const root = await checkout(t, { "ok.ts": "function ok() {}", "large.ts": " ".repeat(MAX_SOURCE_BYTES + 1) });
  const discovery = { async discover() { return { metadata: { kind: "fixture", head: null }, paths: ["../outside.ts", "/outside.ts", "missing.ts", "large.ts", "ok.ts", "ok.ts"] }; } };
  const result = await parseRepository({ rootPath: root, discovery });
  assert.deepEqual(result.files.map((f) => f.path), ["ok.ts"]);
  assert.equal(result.repository.kind, "fixture");
  assert.equal(result.diagnostics.filter((d) => d.code === "invalid-path").length, 2);
  assert.ok(result.diagnostics.some((d) => d.code === "source-too-large"));
  assert.ok(result.diagnostics.some((d) => d.code === "source-unreadable"));
});

test("CLI: installed Node runs the native .mts command with JSON stdout and stderr diagnostics", async (t) => {
  const root = await checkout(t, { "a.ts": "function a() {}" });
  const project = fileURLToPath(new URL("../../", import.meta.url));
  const result = spawnSync("npm", ["run", "--silent", "repo:parse", "--", root], { cwd: project, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).files.length, 1);
  assert.match(result.stderr, /Indexed 1 files/);
  assert.doesNotMatch(result.stderr, /MODULE_TYPELESS/);
  const failed = spawnSync(process.execPath, ["scripts/repo-parse.mts", path.join(root, "missing")], { cwd: project, encoding: "utf8" });
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, "");
  assert.match(failed.stderr, /Repository parsing failed/);
});

test("Phase B: imports, re-exports, aliases and directly resolvable calls", async (t) => {
  const root = await checkout(t, {
    "tsconfig.json": JSON.stringify({ compilerOptions: { module: "esnext", moduleResolution: "bundler", baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
    "src/functions.ts": `export function direct() { return 1; }\nexport default function main() { return direct(); }\nexport const arrow = () => direct();\nexport function overloaded(x: string): string;\nexport function overloaded(x: string) { return x; }\nexport interface Shape { x: number }`,
    "src/barrel.ts": `export { direct as renamed, default, arrow, overloaded } from './functions';\nexport type { Shape } from './functions';`,
    "consumer.ts": `import main, { renamed as imported, arrow, overloaded, type Shape } from '@/barrel';\nimport * as functions from './src/functions';\nimport 'external-package';\nexport function run() { imported(); main(); arrow(); overloaded('x'); functions.direct(); }\nrun();\nimport('./src/functions');\nrequire('./src/functions');`,
  });
  const result = await parseRepository({ rootPath: root });
  const targets = new Map(result.declarations.map((d) => [d.id, d]));
  for (const [callee, name] of [["imported", "direct"], ["main", "main"], ["arrow", "arrow"], ["overloaded", "overloaded"], ["functions.direct", "direct"], ["run", "run"]]) {
    const call = result.calls.find((c) => c.fileId === "consumer.ts" && c.callee === callee);
    assert.equal(call.resolution, "resolved", `${callee}: ${call.unresolvedReason}`);
    assert.equal(targets.get(call.targetDeclarationId).name, name);
  }
  assert.equal(result.calls.find((c) => c.callee === "run").callerDeclarationId, undefined);
  assert.equal(targets.get(result.calls.find((c) => c.callee === "imported").callerDeclarationId).name, "run");
  const alias = result.modules.find((m) => m.specifier === "@/barrel");
  assert.equal(alias.targetFileId, "src/barrel.ts");
  assert.equal(alias.bindings.find((b) => b.name === "Shape").typeOnly, true);
  assert.equal(result.modules.find((m) => m.specifier === "external-package").resolution, "external");
  assert.equal(result.modules.find((m) => m.kind === "dynamic-import").targetFileId, "src/functions.ts");
  assert.equal(result.modules.find((m) => m.kind === "require").targetFileId, "src/functions.ts");
  assert.ok(result.modules.some((m) => m.kind === "export" && m.typeOnly));
  assert.deepEqual(result, await parseRepository({ rootPath: root }));
});

test("Phase B: concrete methods and shadowed symbols resolve; dynamic and competing targets stay unresolved", async (t) => {
  const root = await checkout(t, {
    "calls.ts": `function direct() {}\nfunction duplicate() {}\nfunction duplicate() {}\nclass C {\n static method() {}\n method() {}\n call() { this.method(); }\n}\nclass D { method() {} }\nconst c = new C();\nconst obj = { method() {}, arrow: () => direct() };\nC.method(); c.method(); obj.method(); obj.arrow(); new C().method();\nfunction outer() { function direct() {} direct(); }\nfunction callback(fn: () => void) { fn(); }\ninterface I { method(): void }\nfunction unknown(x: I) { x.method(); }\nfunction union(x: C | D) { x.method(); }\nfunction computed(key: string) { obj[key](); }\nfunction higher() { return direct; }\nhigher()();\nfunction returned() { return c; }\nreturned().method();\nduplicate();\nmissing();`,
  });
  const result = await parseRepository({ rootPath: root });
  const calls = result.calls;
  const declarations = new Map(result.declarations.map((d) => [d.id, d]));
  for (const callee of ["C.method", "c.method", "obj.method", "obj.arrow", "new C().method", "this.method"]) {
    const call = calls.find((c) => c.callee === callee);
    assert.equal(call.resolution, "resolved", `${callee}: ${call.unresolvedReason}`);
  }
  const nested = calls.find((c) => c.callee === "direct" && declarations.get(c.callerDeclarationId)?.name === "outer");
  assert.equal(declarations.get(nested.targetDeclarationId).qualifiedName, "outer.direct");
  for (const callee of ["fn", "x.method", "obj[key]", "higher()", "returned().method", "duplicate", "missing"]) {
    const matches = calls.filter((c) => c.callee === callee);
    assert.ok(matches.length, callee);
    assert.ok(matches.every((c) => c.resolution === "unresolved" && c.unresolvedReason), callee);
  }
  assert.notEqual(calls.find((c) => c.callee === "C.method").targetDeclarationId, calls.find((c) => c.callee === "c.method").targetDeclarationId);
});

test("Phase B: unresolved references, config inheritance, nearest jsconfig and unindexed source", async (t) => {
  const root = await checkout(t, {
    "base.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
    "tsconfig.json": JSON.stringify({ extends: "./base.json" }),
    "src/target.ts": "export function target() {}",
    "main.ts": "import { target } from '@/target'; import { missing } from './absent'; import { built } from './dist/built'; target(); missing(); built();",
    "dist/built.ts": "export function built() {}",
    "nested/jsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "local/*": ["./*"] } } }),
    "nested/local.js": "export function local() {}",
    "nested/consumer.js": "import { local } from 'local/local'; local();",
  });
  const result = await parseRepository({ rootPath: root });
  assert.equal(result.modules.find((m) => m.specifier === "@/target").resolution, "local");
  assert.equal(result.modules.find((m) => m.specifier === "local/local").targetFileId, "nested/local.js");
  assert.equal(result.calls.find((c) => c.callee === "local").resolution, "resolved");
  for (const specifier of ["./absent", "./dist/built"]) assert.equal(result.modules.find((m) => m.specifier === specifier).resolution, "unresolved");
  assert.equal(result.calls.find((c) => c.callee === "built").resolution, "unresolved");
  assert.equal(result.diagnostics.filter((d) => d.code === "module-unresolved").length, 2);
});

test("Phase B: signature-only calls stay unresolved, all call sites have ranges, and shadowed require is ordinary code", async (t) => {
  const root = await checkout(t, {
    "types.d.ts": "export declare function onlySignature(): void;",
    "main.ts": "import { onlySignature } from './types'; onlySignature(); function require(x: string) { return x; } require('./missing');",
  });
  const result = await parseRepository({ rootPath: root });
  assert.equal(result.calls.find((c) => c.callee === "onlySignature").resolution, "unresolved");
  assert.equal(result.calls.find((c) => c.callee === "require").resolution, "resolved");
  assert.ok(!result.modules.some((m) => m.kind === "require"));
  for (const call of result.calls) {
    const file = result.files.find((f) => f.id === call.fileId);
    assert.ok(file.content.slice(call.range.start, call.range.end).includes(call.callee));
  }
});

test("Phase A: ordinary object fields and disjoint loop scopes do not create false duplicate declarations", async (t) => {
  const root = await checkout(t, { "data.ts": `const records = [{ id: 'one', name: 'One', method() {} }, { id: 'two', name: 'Two', method() {} }];\nfunction loops() { for (const value of [1]) { value; } for (const value of [2]) { value; } }\nconst nested = { inner: { method() {} }, other: { method() {} } };` });
  const result = await parseRepository({ rootPath: root });
  assert.ok(!result.declarations.some((d) => d.name === "id" || d.name === "name"));
  assert.ok(!result.diagnostics.some((d) => d.code === "duplicate-declaration"));
  const methods = result.declarations.filter((d) => d.name === "method");
  assert.equal(new Set(methods.map((d) => d.id)).size, 4);
});

test("Phase B: default exported arrow functions and function references retain callable targets", async (t) => {
  const root = await checkout(t, {
    "arrow.ts": "export default () => 1;",
    "reference.ts": "function actual() { return 1; } export default actual;",
    "consumer.ts": "import arrow from './arrow'; import reference from './reference'; arrow(); reference();",
  });
  const result = await parseRepository({ rootPath: root });
  for (const callee of ["arrow", "reference"]) {
    const call = result.calls.find((c) => c.callee === callee);
    assert.equal(call.resolution, "resolved", `${callee}: ${call.unresolvedReason}`);
  }
});

test("Phase B: invalid JSON/config inheritance and symlink imports stay explicit without escaping the checkout", async (t) => {
  const root = await checkout(t, {
    "tsconfig.json": '{ "extends": "../outside.json", "compilerOptions": { "target": "invalid" } }',
    "main.ts": "import { outside } from './linked'; outside();",
  });
  const outside = await mkdtemp(path.join(tmpdir(), "texo-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "outside.ts"), "export function outside() {};");
  await symlink(path.join(outside, "outside.ts"), path.join(root, "linked.ts"));
  const result = await parseRepository({ rootPath: root });
  assert.deepEqual(result.files.map((f) => f.path), ["main.ts"]);
  assert.ok(result.diagnostics.some((d) => d.code === "config-error"));
  assert.equal(result.calls[0].resolution, "unresolved");
  assert.equal(result.modules[0].resolution, "unresolved");
});

test("Phase A: declaration ranges preserve CRLF, Unicode and namespace lexical identities", async (t) => {
  const content = '// 🙂\r\nnamespace A { export function same() { return "🙂"; } }\r\nnamespace B { export function same() {} }\r\n';
  const root = await checkout(t, { "ranges.ts": content });
  const result = await parseRepository({ rootPath: root });
  const functions = result.declarations.filter((d) => d.name === "same");
  assert.equal(functions.length, 2);
  assert.deepEqual(functions.map((d) => d.qualifiedName), ["A.same", "B.same"]);
  assert.equal(functions[0].range.startLine, 2);
  assert.equal(content.slice(functions[0].range.start, functions[0].range.end), 'export function same() { return "🙂"; }');
  assert.deepEqual(result.diagnostics, []);
});

test("CLI: completed partial scans succeed, non-Git roots and extra arguments fail", async (t) => {
  const root = await checkout(t, { "broken.ts": "function recovered() {} const broken = ;" });
  const entry = fileURLToPath(new URL("../../scripts/repo-parse.mts", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { encoding: "utf8" });
  const partial = run(root);
  assert.equal(partial.status, 0);
  assert.equal(JSON.parse(partial.stdout).files[0].status, "partial");
  assert.match(partial.stderr, /syntax-error/);
  const extra = run(root, root);
  assert.equal(extra.status, 1);
  assert.equal(extra.stdout, "");
  const ordinary = await mkdtemp(path.join(tmpdir(), "texo-non-git-"));
  t.after(() => rm(ordinary, { recursive: true, force: true }));
  const nonGit = run(ordinary);
  assert.equal(nonGit.status, 1);
  assert.equal(nonGit.stdout, "");
  await mkdir(path.join(root, "subdirectory"));
  assert.equal(run(path.join(root, "subdirectory")).status, 1);
  assert.equal(spawnSync(process.execPath, [entry], { cwd: root, encoding: "utf8" }).status, 0);
});

test("Phase A/B: destructured declarations and their exported names are indexed individually", async (t) => {
  const root = await checkout(t, { "bindings.ts": "export const { x, y: renamed, nested: { z } } = value; export const [first, , ...rest] = list;" });
  const result = await parseRepository({ rootPath: root });
  assert.deepEqual(result.declarations.map((d) => d.name).sort(), ["first", "renamed", "rest", "x", "z"]);
  assert.deepEqual(result.modules.flatMap((m) => m.bindings.map((b) => b.name)).sort(), ["first", "renamed", "rest", "x", "z"]);
});
