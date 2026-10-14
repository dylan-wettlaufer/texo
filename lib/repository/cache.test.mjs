import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, rename, stat, utimes, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepositoryCache, parseRepository } from "./index.mts";
import { createLocalRepositoryStore } from "../local-repository/store.mts";

async function fixture(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), "texo-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  const put = async (name, content) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  };
  for (const [name, content] of Object.entries(files)) await put(name, content);
  return { root, put, cache: createRepositoryCache({ rootPath: root }) };
}

test("cache: unchanged bytes reuse analysis, timestamps are irrelevant, callers cannot mutate entries", async (t) => {
  const { root, put, cache } = await fixture(t, { "a.ts": "export const value = 1;" });
  const first = await cache.read();
  assert.deepEqual(first, await parseRepository({ rootPath: root }));
  assert.deepEqual(await cache.read(), first);
  assert.deepEqual(cache.getStats(), { hits: 1, misses: 1, analyses: 1, entries: 1 });
  const originalStat = await stat(path.join(root, "a.ts"));
  await utimes(path.join(root, "a.ts"), new Date(), new Date(Date.now() + 20000));
  assert.deepEqual(await cache.read(), first);
  first.files[0].content = "poisoned";
  first.declarations[0].name = "poisoned";
  assert.equal((await cache.read()).files[0].content, "export const value = 1;");
  await put("a.ts", "export const value = 2;");
  await utimes(path.join(root, "a.ts"), originalStat.atime, originalStat.mtime);
  const edited = await cache.read();
  assert.equal(edited.files[0].content, "export const value = 2;");
  assert.notEqual(edited.repository.contentHash, first.repository.contentHash);
  assert.equal(cache.getStats().analyses, 2);
});

test("cache: discovery additions, deletions, renames and symlinks invalidate; ignored files do not", async (t) => {
  const { root, put, cache } = await fixture(t, { ".gitignore": "ignored.ts\n", "a.ts": "export function one() {}" });
  await cache.read();
  await put("b.ts", "import { one } from './a'; one();");
  assert.equal((await cache.read()).files.length, 2);
  await rename(path.join(root, "a.ts"), path.join(root, "c.ts"));
  const renamed = await cache.read();
  assert.deepEqual(renamed.files.map((file) => file.path), ["b.ts", "c.ts"]);
  assert.equal(renamed.modules.find((reference) => reference.specifier === "./a").resolution, "unresolved");
  await rm(path.join(root, "b.ts"));
  await cache.read();
  assert.equal(cache.getStats().analyses, 4);
  await put("ignored.ts", "const ignored = 1;");
  await put("unrelated.json", '{"changed":true}');
  await cache.read();
  assert.equal(cache.getStats().analyses, 4);
  await rm(path.join(root, "c.ts"));
  await symlink(path.join(root, "ignored.ts"), path.join(root, "c.ts"));
  const linked = await cache.read();
  assert.equal(linked.files.length, 0);
  assert.ok(linked.diagnostics.some((diagnostic) => diagnostic.code === "symlink-skipped"));
  assert.equal(cache.getStats().analyses, 5);
});

test("cache: inherited aliases and newly created nearer configs invalidate without source changes", async (t) => {
  const config = (target) => JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { alias: [target] } } });
  const { root, put, cache } = await fixture(t, {
    "tsconfig.json": JSON.stringify({ extends: "./base.json" }), "base.json": config("a.ts"),
    "a.ts": "export function value() {}", "b.ts": "export function value() {}",
    "src/use.ts": "import { value } from 'alias'; value();",
  });
  const first = await cache.read();
  assert.equal(first.modules.find((reference) => reference.specifier === "alias").targetFileId, "a.ts");
  await put("base.json", config("b.ts"));
  const changed = await cache.read();
  assert.equal(changed.repository.contentHash, first.repository.contentHash);
  assert.equal(changed.modules.find((reference) => reference.specifier === "alias").targetFileId, "b.ts");
  assert.ok(changed.calls.find((call) => call.callee === "value").targetDeclarationId.startsWith("b.ts#"));
  await put("src/jsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: "..", paths: { alias: ["a.ts"] } } }));
  assert.equal((await cache.read()).modules.find((reference) => reference.specifier === "alias").targetFileId, "a.ts");
  await rm(path.join(root, "src/jsconfig.json"));
  assert.equal((await cache.read()).modules.find((reference) => reference.specifier === "alias").targetFileId, "b.ts");
  assert.equal(cache.getStats().analyses, 4);
  await cache.read();
  assert.equal(cache.getStats().analyses, 4);
});

test("cache: package creation and package metadata changes invalidate cached external references", async (t) => {
  const { put, cache } = await fixture(t, {
    "a.ts": "export function value() {}", "b.ts": "export function value() {}",
    "use.ts": "import { value } from 'pkg'; value();",
  });
  const first = await cache.read();
  assert.equal(first.modules.find((reference) => reference.specifier === "pkg").resolution, "external");
  await put("node_modules/pkg/package.json", JSON.stringify({ name: "pkg", types: "../../a.ts" }));
  const installed = await cache.read();
  assert.equal(installed.modules.find((reference) => reference.specifier === "pkg").targetFileId, "a.ts");
  await put("node_modules/pkg/package.json", JSON.stringify({ name: "pkg", types: "../../b.ts" }));
  const changed = await cache.read();
  assert.equal(changed.modules.find((reference) => reference.specifier === "pkg").targetFileId, "b.ts");
  assert.equal(changed.repository.contentHash, first.repository.contentHash);
  assert.equal(cache.getStats().analyses, 3);
});

test("cache: missing inherited config creation and syntax recovery are detected", async (t) => {
  const { put, cache } = await fixture(t, { "tsconfig.json": '{"extends":"./missing.json"}', "a.ts": "export const broken = ;" });
  const first = await cache.read();
  assert.ok(first.diagnostics.some((diagnostic) => diagnostic.code === "config-error"));
  assert.equal(first.files[0].status, "partial");
  await cache.read();
  assert.equal(cache.getStats().analyses, 1);
  await put("missing.json", '{"compilerOptions":{"strict":true}}');
  assert.ok(!(await cache.read()).diagnostics.some((diagnostic) => diagnostic.code === "config-error"));
  assert.equal(cache.getStats().analyses, 2);
  await put("a.ts", "export const broken = 1;");
  assert.equal((await cache.read()).files[0].status, "parsed");
  assert.equal(cache.getStats().analyses, 3);
});

test("cache: bounded LRU reuse and eviction, root isolation and concurrent read deduplication", async (t) => {
  const { root, put } = await fixture(t, { "a.ts": "export const value = 1;" });
  let discoveries = 0;
  const cache = createRepositoryCache({ rootPath: root, discovery: { async discover() { discoveries++; return { metadata: { kind: "fixture", head: null }, paths: ["a.ts"] }; } } });
  const [first, second] = await Promise.all([cache.read(), cache.read()]);
  assert.equal(discoveries, 1);
  assert.deepEqual(first, second);
  first.files[0].content = "mutated";
  assert.notEqual(first.files[0].content, second.files[0].content);
  await put("a.ts", "export const value = 2;"); await cache.read();
  await put("a.ts", "export const value = 1;"); await cache.read();
  assert.equal(cache.getStats().hits, 1);
  await put("a.ts", "export const value = 3;"); await cache.read();
  assert.equal(cache.getStats().entries, 2);
  await put("a.ts", "export const value = 2;"); await cache.read();
  assert.equal(cache.getStats().analyses, 4);
  const other = await fixture(t, { "a.ts": "export const value = 99;" });
  assert.equal((await other.cache.read()).files[0].content, "export const value = 99;");
  assert.equal((await cache.read()).files[0].content, "export const value = 2;");
  assert.throws(() => createRepositoryCache({ rootPath: root }, { maxEntries: 0 }), /maxEntries/);
});

test("cache: failed scans are retriable without discarding successful entries", async (t) => {
  const { root } = await fixture(t, { "a.ts": "function a() {}" });
  let fail = false;
  const cache = createRepositoryCache({ rootPath: root, discovery: { async discover() {
    if (fail) throw new Error("discovery failed");
    return { metadata: { kind: "fixture", head: null }, paths: ["a.ts"] };
  } } });
  const original = await cache.read();
  fail = true;
  await assert.rejects(cache.read(), /discovery failed/);
  fail = false;
  assert.deepEqual(await cache.read(), original);
  assert.equal(cache.getStats().hits, 1);
  assert.equal(cache.getStats().analyses, 1);
});

test("backend cache: unchanged refresh retains revision; source and config changes invalidate it", async (t) => {
  const { put, cache } = await fixture(t, {
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { alias: ["a.ts"] } } }),
    "a.ts": "export function value() {}", "b.ts": "export function value() {}", "use.ts": "import { value } from 'alias'; value();",
  });
  const store = createLocalRepositoryStore(() => cache.read(), () => true);
  const first = await store.read(new URLSearchParams());
  assert.equal((await store.refresh()).revision, first.revision);
  assert.equal(cache.getStats().analyses, 1);
  await put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { alias: ["b.ts"] } } }));
  const configChange = await store.refresh();
  assert.notEqual(configChange.revision, first.revision);
  assert.equal(configChange.data.repository.contentHash, first.data.repository.contentHash);
  const params = new URLSearchParams({ operation: "files", revision: first.revision });
  await assert.rejects(store.read(params), (error) => error.code === "stale-revision");
  await put("b.ts", "export function value() { return 1; }");
  const sourceChange = await store.refresh();
  assert.notEqual(sourceChange.revision, configChange.revision);
  assert.equal((await store.refresh()).revision, sourceChange.revision);
});
