import assert from "node:assert/strict";
import test from "node:test";
import { diagrams, projects, getDiagram, getProject, getProjectDiagrams } from "./data.ts";
import { diagramSize, edgeGeometry, fitScale, NODE_HEIGHT, NODE_WIDTH } from "./geometry.ts";

test("project and diagram links resolve only within their owning project", () => {
  assert.equal(new Set(projects.map((project) => project.id)).size, projects.length);
  for (const diagram of diagrams) {
    assert.ok(getProject(diagram.projectId));
    assert.equal(getDiagram(diagram.projectId, diagram.id), diagram);
    assert.equal(getDiagram("beacon", diagram.id), undefined);
  }
  assert.equal(getProject("missing"), undefined);
  assert.equal(getDiagram("atlas", "missing"), undefined);
  assert.deepEqual(getProjectDiagrams("beacon"), []);
  assert.equal(getProjectDiagrams("atlas").length, 3);
});

test("each graph has unique IDs, complete node context, and valid directed connections", () => {
  for (const diagram of diagrams) {
    const nodeIds = new Set(diagram.nodes.map((node) => node.id));
    assert.equal(nodeIds.size, diagram.nodes.length);
    assert.equal(new Set(diagram.edges.map((edge) => edge.id)).size, diagram.edges.length);
    for (const node of diagram.nodes) {
      assert.ok(node.name && node.description && node.technology);
      assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
    }
    for (const edge of diagram.edges) {
      assert.ok(nodeIds.has(edge.source), `Missing source for ${edge.id}`);
      assert.ok(nodeIds.has(edge.target), `Missing target for ${edge.id}`);
      assert.notEqual(edge.source, edge.target);
      assert.ok(edge.label);
      const geometry = edgeGeometry(diagram.nodes.find((node) => node.id === edge.source), diagram.nodes.find((node) => node.id === edge.target));
      assert.ok(!/NaN|undefined|Infinity/.test(geometry.path));
    }
  }
});

test("fit-to-view contains every node on desktop and mobile viewports", () => {
  for (const diagram of diagrams) {
    const bounds = diagramSize(diagram.nodes);
    for (const node of diagram.nodes) {
      assert.ok(node.position.x + NODE_WIDTH <= bounds.width);
      assert.ok(node.position.y + NODE_HEIGHT <= bounds.height);
    }
    for (const viewport of [{ width: 900, height: 600 }, { width: 320, height: 440 }]) {
      const scale = fitScale(viewport, bounds);
      assert.ok(scale > 0 && scale <= 1);
      assert.ok(bounds.width * scale <= viewport.width - 48);
      assert.ok(bounds.height * scale <= viewport.height - 100);
    }
  }
});
