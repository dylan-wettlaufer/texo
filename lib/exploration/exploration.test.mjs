import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { commerceExploration } from "./demo.ts";
import { prepareExploration } from "./prepare.ts";
import { functionSelection, matchesInteraction, moveHistory, pushSelection, resolveSource, selectionContext } from "./navigation.ts";
import { clampSplit, preserveViewportCenter } from "./viewport.ts";
import { diagrams, getProjectDiagrams } from "../architecture/data.ts";
import { projectNodeCatalogue } from "../architecture/node-details.ts";

const catalogue = projectNodeCatalogue(getProjectDiagrams("atlas"));
const model = prepareExploration(commerceExploration, catalogue.map((node) => node.id));

test("all demo source, functions, annotations, and architecture references resolve", () => {
  assert.deepEqual(model.issues, []);
  for (const fn of model.functions) {
    assert.ok(fn.range);
    const file = model.files.find((candidate) => candidate.id === fn.fileId);
    assert.match(file.lines[fn.range.startLine - 1].tokens.map((token) => token.text).join(""), new RegExp(`function ${fn.name}`));
    for (const field of ["purpose", "behavior", "inputs", "outputs", "sideEffects", "interactions"]) assert.ok(fn[field].length);
  }
  for (const annotation of model.annotations) {
    const fn = model.functions.find((candidate) => candidate.id === annotation.functionId);
    assert.ok(annotation.range.startLine >= fn.range.startLine);
    assert.ok(annotation.range.endLine <= fn.range.endLine);
  }
  for (const id of ["api", "payments"]) {
    for (const reference of catalogue.find((node) => node.id === id).sourceFiles) {
      const selection = resolveSource(reference, model);
      if (selection.directory) assert.ok(model.files.some((file) => file.path.startsWith(selection.path)));
      else assert.ok(selectionContext(selection, model).fn?.range);
    }
  }
});

test("token presentation preserves every source character including markup and multiline comments", () => {
  const input = { ...commerceExploration, files: [{ id: "special", path: "special.ts", content: '/* first\nsecond */\nconst html = "<script>& hi";\n', description: "Special characters" }], functions: [], annotations: [], flows: [] };
  for (const file of [...model.files, ...prepareExploration(input, []).files]) {
    assert.equal(file.lines.map((line) => line.tokens.map((token) => token.text).join("")).join("\n"), file.content);
  }
  const allTokens = model.files.flatMap((file) => file.lines.flatMap((line) => line.tokens));
  for (const kind of ["keyword", "string", "number", "comment"]) assert.ok(allTokens.some((token) => token.kind === kind));
});

test("broken references and invalid source ranges stay explicitly unavailable", () => {
  const broken = structuredClone(commerceExploration);
  broken.functions[0].fileId = "missing";
  broken.functions[1].name = "missingDeclaration";
  broken.functions[2].calleeIds.push("missingCallee");
  broken.functions[2].interactions.push({ source: "missingComponent", target: "api", description: "Broken" });
  broken.annotations[3].code = "not in the source";
  broken.annotations[4].code = 'import type { PaymentRequest, PaymentTransport } from "@/src/contracts";';
  broken.flows[0].steps[0].annotationId = "missingAnnotation";
  broken.flows[0].steps[1].functionId = "missingStepFunction";
  const result = prepareExploration(broken, catalogue.map((node) => node.id));
  assert.ok(result.issues.length >= 8);
  assert.equal(result.functions[0].range, undefined);
  assert.match(result.functions[0].unavailableReason, /source file unavailable/);
  assert.equal(result.functions[1].range, undefined);
  assert.equal(result.annotations[3].range, undefined);
  assert.equal(result.annotations[4].range, undefined);
  assert.ok(result.annotations[3].unavailableReason);
  assert.equal(resolveSource({ path: "missing.ts", description: "Missing" }, result).fileId, undefined);
});

test("ambiguous function declarations and duplicate IDs are reported", () => {
  const data = structuredClone(commerceExploration);
  data.files[0].content += '\nexport function createOrder() {}\n';
  data.functions.push({ ...data.functions[0] });
  const prepared = prepareExploration(data, catalogue.map((node) => node.id));
  assert.equal(prepared.functions[0].range, undefined);
  assert.ok(prepared.issues.some((issue) => issue.includes("IDs must be unique")));
});

test("function/range navigation and overview restoration survive back and forward", () => {
  const selected = functionSelection("authorize-payment", model);
  const annotated = functionSelection("authorize-payment", model, "provider-request");
  let history = pushSelection(null, selected);
  history = pushSelection(history, annotated);
  history = pushSelection(history, selected);
  assert.equal(selectionContext(history.entries[history.index], model).annotation, undefined);
  history = moveHistory(history, -1);
  assert.equal(selectionContext(history.entries[history.index], model).annotation.id, "provider-request");
  history = moveHistory(history, -1);
  assert.equal(selectionContext(history.entries[history.index], model).fn.name, "authorizePayment");
  history = moveHistory(history, 1);
  assert.deepEqual(selectionContext(history.entries[history.index], model).range, model.annotations.find((annotation) => annotation.id === "provider-request").range);
  history = pushSelection(history, functionSelection("coordinate-payment", model));
  assert.equal(history.entries.length, 3);
  assert.equal(history.index, 2);
  assert.equal(moveHistory(history, 100).index, 2);
  assert.equal(moveHistory(history, -100).index, 0);
  assert.equal(pushSelection(history, history.entries[2]), history);
});

test("function focus resolves the directed payment interaction across all diagrams", () => {
  const interactions = model.functions.find((fn) => fn.id === "authorize-payment").interactions;
  for (const diagram of diagrams) {
    const matches = diagram.edges.filter((edge) => matchesInteraction(edge, interactions));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].source, "api");
    assert.equal(matches[0].target, "payments");
  }
  assert.equal(matchesInteraction({ source: "payments", target: "api" }, interactions), false);
  const webhook = model.annotations.find((annotation) => annotation.id === "verify-webhook");
  assert.ok(diagrams.every((diagram) => !diagram.edges.some((edge) => matchesInteraction(edge, webhook.interactions))));
});

test("pane resizing preserves graph center and zoom, including orientation changes", () => {
  const old = { width: 1000, height: 800 };
  const next = { width: 450, height: 300 };
  const viewport = { x: -200, y: 80, zoom: 0.7 };
  const resized = preserveViewportCenter(viewport, old, next);
  assert.equal(resized.zoom, viewport.zoom);
  assert.equal((old.width / 2 - viewport.x) / viewport.zoom, (next.width / 2 - resized.x) / resized.zoom);
  assert.equal((old.height / 2 - viewport.y) / viewport.zoom, (next.height / 2 - resized.y) / resized.zoom);
  assert.deepEqual(preserveViewportCenter(resized, next, old), viewport);
  assert.equal(clampSplit(0), 35);
  assert.equal(clampSplit(100), 75);
  assert.equal(clampSplit(60), 60);
});

// Run the authored sample modules only inside tests, with injected fake adapters.
function sampleModule(fileId, cache = new Map()) {
  if (cache.has(fileId)) return cache.get(fileId);
  const file = commerceExploration.files.find((candidate) => candidate.id === fileId);
  const output = ts.transpileModule(file.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.deepEqual(output.diagnostics ?? [], []);
  const exports = {};
  cache.set(fileId, exports);
  const load = (path) => {
    const dependency = commerceExploration.files.find((candidate) => candidate.path.replace(/^\//, "").replace(/\.ts$/, "") === path.replace(/^@\//, ""));
    assert.ok(dependency, `Unresolved sample import: ${path}`);
    return sampleModule(dependency.id, cache);
  };
  new Function("require", "exports", output.outputText)(load, exports);
  return exports;
}
function checkoutAdapters(status = "approved") {
  let stored;
  const state = { requests: [], jobs: [], writes: [], failQueue: false };
  const deps = {
    provider: { postAuthorization: async (input, options) => { state.requests.push({ input, options }); return { id: "payment-1", status }; } },
    queue: { add: async (...args) => { if (state.failQueue) throw new Error("Queue offline"); state.jobs.push(args); } },
    orders: {
      withCheckoutLock: async (_key, work) => work(),
      findByKey: async () => stored,
      readCart: async (id) => ({ id, total: 2000, currency: "CAD" }),
      createPending: async (cart, key) => (stored = { id: "order-1", cartId: cart.id, amount: cart.total, currency: cart.currency, checkoutKey: key, status: "pending" }),
      saveAuthorization: async (_id, authorization) => { stored = { ...stored, status: authorization.approved ? "authorized" : "rejected" }; state.writes.push(stored); return stored; },
    },
  };
  return { state, deps };
}
test("checkout retry after queue failure does not authorize payment twice", async () => {
  const { createOrder } = sampleModule("orders");
  const { state, deps } = checkoutAdapters();
  const input = { cartId: "cart-1", idempotencyKey: "checkout-1" };
  state.failQueue = true;
  await assert.rejects(() => createOrder(input, deps), /Queue offline/);
  assert.equal(state.writes[0].status, "authorized");
  state.failQueue = false;
  assert.deepEqual(await createOrder(input, deps), { orderId: "order-1", status: "authorized" });
  assert.equal(state.requests.length, 1);
  assert.equal(state.requests[0].options.idempotencyKey, input.idempotencyKey);
  assert.equal(state.jobs[0][2].jobId, "order-1");
  await assert.rejects(() => createOrder({ ...input, cartId: "different-cart" }, deps), /different cart/);
});

test("declined or unresolved payments cannot publish fulfillment", async () => {
  const { createOrder } = sampleModule("orders");
  for (const status of ["declined", "pending"]) {
    const { state, deps } = checkoutAdapters(status);
    await assert.rejects(() => createOrder({ cartId: "cart-1", idempotencyKey: "checkout-1" }, deps), status === "declined" ? /declined/ : /unresolved/);
    assert.equal(state.jobs.length, 0);
    assert.equal(state.writes.length, status === "declined" ? 1 : 0);
  }
});

test("webhook validation precedes mutation and duplicate delivery is acknowledged", async () => {
  const { handlePaymentWebhook } = sampleModule("payment-webhook");
  let writes = 0;
  let valid = false;
  const deps = {
    provider: { verifySignature: () => valid, parseEvent: () => ({ id: "event-1" }) },
    orders: { applyProviderEventOnce: async () => ++writes === 1 },
  };
  await assert.rejects(() => handlePaymentWebhook("{}", "signature", deps), /Invalid webhook/);
  assert.equal(writes, 0);
  valid = true;
  assert.deepEqual(await handlePaymentWebhook("{}", "signature", deps), { received: true, applied: true });
  assert.deepEqual(await handlePaymentWebhook("{}", "signature", deps), { received: true, applied: false });
});
