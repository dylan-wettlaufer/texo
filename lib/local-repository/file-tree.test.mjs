import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceTree } from "./file-tree.mts";

const file = (path, status = "parsed") => ({ id: path, path, hash: "fixture", status, declarationFile: false });

test("source tree groups shared ancestors, keeps route segments intact, and sorts folders before files", () => {
  const tree = buildSourceTree([file("root.ts"), file("app/page.tsx"), file("app/(app)/projects/[id]/page.tsx"), file("app/(app)/layout.tsx"), file("lib/utils.ts")]);
  assert.deepEqual(tree.map((node) => node.name), ["app", "lib", "root.ts"]);
  assert.equal(tree[0].fileCount, 3);
  assert.deepEqual(tree[0].children.map((node) => node.name), ["(app)", "page.tsx"]);
  const group = tree[0].children[0];
  assert.equal(group.path, "app/(app)");
  assert.equal(group.children[0].name, "projects");
  assert.equal(group.children[0].children[0].name, "[id]");
  assert.equal(group.children[0].children[0].children[0].file.id, "app/(app)/projects/[id]/page.tsx");
});

test("source tree preserves duplicate basenames, filtered ancestry, file status and input ordering", () => {
  const files = [file("lib/b/index.ts", "partial"), file("lib/a/index.ts")];
  const original = structuredClone(files);
  const tree = buildSourceTree(files);
  assert.deepEqual(files, original);
  assert.deepEqual(tree, buildSourceTree([...files].reverse()));
  assert.deepEqual(tree[0].children.map((node) => node.name), ["a", "b"]);
  assert.equal(tree[0].children[1].children[0].file.status, "partial");
  const filtered = buildSourceTree([files[0]]);
  assert.equal(filtered[0].fileCount, 1);
  assert.deepEqual(filtered[0].children.map((node) => node.name), ["b"]);
  assert.deepEqual(buildSourceTree([]), []);
});
