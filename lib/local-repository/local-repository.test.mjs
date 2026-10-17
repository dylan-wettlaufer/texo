import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRepository } from "../repository/index.mts";
import { tokenizeSource } from "../source/tokenize.mts";
import { createLocalRepositoryStore } from "./store.mts";
import { handleRepositoryRequest } from "./http.mts";
import { callSelection, createRequestGate, moveRepositoryHistory, pushRepositorySelection, selectionRange } from "./navigation.mts";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "texo-local-ui-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "code.tsx"), `export function target(x: string): string;\nexport function target(x: string) { return x; }\nexport const arrow = () => <div>🙂</div>;\nfunction outer() { target('one'); function nested() { target('two'); } unknown(); }\ntarget('top');`);
  const discovery = { async discover() { return { metadata: { kind: "fixture", head: null }, paths: ["code.tsx"] }; } };
  return () => parseRepository({ rootPath: root, discovery });
}
const parameters = (operation, revision, extra = {}) => new URLSearchParams({ operation, ...(revision ? { revision } : {}), ...extra });

test("local snapshot: initialization is shared, refresh is atomic, failed refresh retains previous source and retry succeeds", async (t) => {
  const scan = await fixture(t);
  const initial = await scan();
  let nextIndex = initial;
  let scans = 0;
  let release;
  const store = createLocalRepositoryStore(() => { scans++; return new Promise((resolve) => { release = () => resolve(nextIndex); }); }, () => true);
  const a = store.read(parameters("summary"));
  const b = store.read(parameters("summary"));
  assert.equal(scans, 1);
  release();
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first.revision, second.revision);
  const refresh = store.refresh();
  assert.equal(scans, 2);
  assert.equal((await store.read(parameters("summary"))).revision, first.revision);
  release();
  const refreshed = await refresh;
  assert.equal(refreshed.revision, first.revision);
  nextIndex = { ...initial, repository: { ...initial.repository, head: "changed" } };
  const changed = store.refresh();
  release();
  assert.notEqual((await changed).revision, first.revision);
  await assert.rejects(store.read(parameters("files", first.revision)), (error) => error.status === 409);
  let fail = false;
  const resilient = createLocalRepositoryStore(async () => { if (fail) throw new Error("scan failed"); return initial; }, () => true);
  const original = await resilient.read(parameters("summary"));
  fail = true;
  await assert.rejects(resilient.refresh(), /scan failed/);
  assert.equal((await resilient.read(parameters("summary"))).revision, original.revision);
  fail = false;
  assert.equal((await resilient.refresh()).revision, original.revision);
});

test("local queries: targeted source, callable search, overload/arrow ranges and nested-call exclusion", async (t) => {
  const scan = await fixture(t);
  const store = createLocalRepositoryStore(scan, () => true);
  const { revision } = await store.read(parameters("summary"));
  const files = await store.read(parameters("files", revision, { limit: "1" }));
  assert.equal(files.data.items.length, 1);
  assert.ok(!("content" in files.data.items[0]));
  const file = (await store.read(parameters("file", revision, { id: "code.tsx" }))).data;
  assert.equal(file.path, "code.tsx");
  assert.ok(!("content" in file));
  const functions = (await store.read(parameters("search", revision, { text: "".padEnd(1, "a") }))).data;
  assert.ok(functions.items.every((item) => item.callable));
  const target = file.declarations.find((declaration) => declaration.name === "target");
  const detail = (await store.read(parameters("declaration", revision, { id: target.id }))).data;
  assert.equal(detail.signatureRanges.length, 1);
  assert.equal(detail.sourceRange.startLine, 2);
  const outer = file.declarations.find((declaration) => declaration.name === "outer");
  const calls = (await store.read(parameters("callees", revision, { id: outer.id }))).data;
  assert.deepEqual(calls.items.map((call) => call.callee), ["target", "unknown"]);
  const arrow = file.declarations.find((declaration) => declaration.name === "arrow");
  assert.equal((await store.read(parameters("declaration", revision, { id: arrow.id }))).data.sourceRange.startLine, 3);
});

test("HTTP: production is gated before scan, invalid inputs are rejected, missing IDs are explicit and errors do not expose paths", async (t) => {
  const scan = await fixture(t);
  let count = 0;
  const store = createLocalRepositoryStore(async () => { count++; return scan(); }, () => true);
  const call = (params, enabled = true) => handleRepositoryRequest(new Request(`http://localhost/api/local-repository?${params}`), store, enabled);
  const production = await call("operation=summary", false);
  assert.equal(production.status, 404);
  assert.equal(count, 0);
  for (const input of ["operation=__proto__", "operation=files", "operation=unknown", "operation=summary&root=/etc", "operation=files&revision=x&limit=201", "operation=files&revision=x&offset=-1", "operation=file&revision=x&id=/etc/passwd", "operation=file&revision=x&id=../outside", "operation=files&operation=summary"]) {
    assert.equal((await call(input)).status, 400, input);
  }
  assert.equal(count, 0);
  const summaryResponse = await call("operation=summary");
  assert.equal(summaryResponse.headers.get("cache-control"), "no-store");
  const { revision } = await summaryResponse.json();
  assert.equal((await call(parameters("file", revision, { id: "missing.ts" }))).status, 404);
  assert.equal((await call(parameters("callers", revision, { id: "missing" }))).status, 404);
  assert.equal((await call(parameters("files", "stale"))).status, 409);
  const failedStore = createLocalRepositoryStore(async () => { throw new Error("/Users/private/project secret Git output"); }, () => true);
  const failed = await handleRepositoryRequest(new Request("http://localhost/api/local-repository"), failedStore, true);
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes("/Users/private"));
  const post = (body, origin) => handleRepositoryRequest(new Request("http://localhost/api/local-repository", { method: "POST", body, headers: origin ? { origin } : {} }), store, true);
  assert.equal((await post('{"root":"/etc"}')).status, 400);
  assert.equal((await post("", "https://other.example")).status, 403);
  assert.equal((await post("", "http://localhost")).status, 200);
});

test("source tokens preserve TS, TSX, JS, JSX, CRLF, templates and Unicode exactly", () => {
  for (const file of ["a.ts", "b.tsx", "c.js", "d.jsx"]) {
    const source = '/* 🙂\r\n comment */\r\nconst x = `hello ${value}`;\r\nconst view = <div title="<>&">text</div>;\r\n';
    const lines = tokenizeSource(source, file);
    assert.equal(lines.map((line) => line.tokens.map((token) => token.text).join("")).join("\n"), source);
    assert.equal(lines[0].number, 1);
  }
});

test("navigation: call sites, history, branching, stale request tickets and revision-scoped ranges", () => {
  const call = { fileId: "a.ts", range: { startLine: 2 }, caller: { id: "a#caller", fileId: "a.ts" }, target: { id: "b#target", fileId: "b.ts" } };
  assert.deepEqual(callSelection(call, "callees"), { fileId: "b.ts", declarationId: "b#target" });
  assert.deepEqual(callSelection(call, "callers"), { fileId: "a.ts", declarationId: "a#caller", callRange: call.range });
  assert.deepEqual(callSelection({ ...call, caller: undefined }, "callers"), { fileId: "a.ts", callRange: call.range });
  assert.equal(callSelection({ ...call, target: undefined }, "callees"), undefined);
  let history = { entries: [], index: 0 };
  history = pushRepositorySelection(history, { fileId: "a.ts" });
  const second = { fileId: "b.ts", declarationId: "b#target" };
  history = pushRepositorySelection(history, second);
  assert.equal(pushRepositorySelection(history, second), history);
  history = moveRepositoryHistory(history, -1);
  history = pushRepositorySelection(history, { fileId: "c.ts" });
  assert.equal(history.entries.length, 2);
  assert.equal(moveRepositoryHistory(history, 100).index, 1);
  const gate = createRequestGate();
  const old = gate.next();
  const latest = gate.next();
  assert.equal(gate.current(old), false);
  assert.equal(gate.current(latest), true);
  gate.cancel();
  assert.equal(gate.current(latest), false);
  const selection = { fileId: "a.ts", callRange: call.range, revision: "old" };
  const declaration = { sourceRange: { startLine: 10 } };
  assert.equal(selectionRange(selection, "old", declaration), call.range);
  assert.equal(selectionRange(selection, "new", declaration), declaration.sourceRange);
  assert.equal(selectionRange(selection, "new"), undefined);
});

test("refresh: deleted selections are unavailable under the new revision, not replaced by guessed declarations", async (t) => {
  const scan = await fixture(t);
  let index = await scan();
  const store = createLocalRepositoryStore(async () => index, () => true);
  const first = await store.read(parameters("summary"));
  const file = await store.read(parameters("file", first.revision, { id: "code.tsx" }));
  const selectedId = file.data.declarations.find((declaration) => declaration.name === "target").id;
  index = { ...index, files: [], declarations: [], calls: [], modules: [] };
  const refreshed = await store.refresh();
  await assert.rejects(store.read(parameters("declaration", refreshed.revision, { id: selectedId })), (error) => error.code === "not-found");
  await assert.rejects(store.read(parameters("file", refreshed.revision, { id: "code.tsx" })), (error) => error.code === "not-found");
  await assert.rejects(store.read(parameters("file", first.revision, { id: "code.tsx" })), (error) => error.code === "stale-revision");
});
