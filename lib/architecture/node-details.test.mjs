import assert from "node:assert/strict";
import test from "node:test";
import { getProjectDiagrams } from "./data.ts";
import { projectNodeCatalogue, nodeRelationships } from "./node-details.ts";

const diagrams = getProjectDiagrams("atlas");
const catalogue = projectNodeCatalogue(diagrams);
const node = (id) => catalogue.find((candidate) => candidate.id === id);

test("project catalogue deduplicates nodes and preserves details across diagrams", () => {
  assert.equal(catalogue.length, 6);
  assert.deepEqual(projectNodeCatalogue([]), []);
  for (const diagram of diagrams) {
    for (const candidate of diagram.nodes) {
      const details = { ...candidate };
      const canonicalDetails = { ...node(candidate.id) };
      delete details.position;
      delete canonicalDetails.position;
      assert.deepEqual(details, canonicalDetails);
    }
  }
});

test("explicit relationships do not mistake job flow for a dependency", () => {
  const queue = nodeRelationships(node("queue"), catalogue);
  assert.deepEqual(queue.dependencies, []);
  assert.deepEqual(queue.consumers.map((candidate) => candidate.id), ["api", "worker"]);
  const worker = nodeRelationships(node("worker"), catalogue);
  assert.deepEqual(worker.dependencies.map(({ node }) => node.id), ["queue", "db"]);
  assert.deepEqual(worker.consumers, []);
});

test("relationships include nodes absent from the current diagram", () => {
  const dependencyDiagram = diagrams.find((diagram) => diagram.id === "dependencies");
  assert.ok(!dependencyDiagram.nodes.some((candidate) => candidate.id === "web"));
  assert.deepEqual(nodeRelationships(node("api"), catalogue).consumers.map((candidate) => candidate.id), ["web"]);
});

test("undocumented and explicitly empty relationships stay distinct", () => {
  const undocumented = { ...node("web"), dependencyIds: undefined };
  assert.equal(nodeRelationships(undocumented, [undocumented]).dependencies, undefined);
  assert.equal(nodeRelationships(undocumented, [undocumented]).consumers, undefined);
  const documented = { ...undocumented, dependencyIds: [] };
  assert.deepEqual(nodeRelationships(documented, [documented]), { dependencies: [], consumers: [] });
  assert.equal(nodeRelationships(node("db"), [...catalogue, { ...undocumented, id: "unknown" }]).consumers, undefined);
});

test("unresolved dependency references remain visible instead of silently disappearing", () => {
  assert.deepEqual(nodeRelationships({ ...node("web"), dependencyIds: ["missing"] }, catalogue).dependencies, [{ id: "missing", node: undefined }]);
});

test("all demo dependencies resolve and richer details are populated", () => {
  for (const candidate of catalogue) {
    assert.ok(candidate.dependencyIds.every((id) => id !== candidate.id && node(id)));
    assert.equal(new Set(candidate.dependencyIds).size, candidate.dependencyIds.length);
    for (const field of ["interfaces", "technologies", "architectureDecisions", "codeReferences"]) {
      assert.ok(candidate[field].length > 0);
      assert.ok(candidate[field].every((value) => typeof value === "string" && value.length > 0));
    }
    assert.ok(candidate.notes);
    assert.ok(Object.values(candidate.metadata).every((value) => typeof value === "string"));
  }
});

