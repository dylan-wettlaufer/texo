import type { FileSummary } from "../repository/query-types.mts";

export type SourceTreeNode =
  | { kind: "file"; name: string; path: string; file: FileSummary }
  | { kind: "directory"; name: string; path: string; children: SourceTreeNode[]; fileCount: number };

/** Build folder ancestry from indexed paths; no source contents or filesystem reads. */
export function buildSourceTree(files: FileSummary[]): SourceTreeNode[] {
  const roots: SourceTreeNode[] = [];
  const directories = new Map<string, Extract<SourceTreeNode, { kind: "directory" }>>();
  for (const file of files) {
    const parts = file.path.split("/");
    let children = roots;
    for (let index = 0; index < parts.length - 1; index++) {
      const folderPath = parts.slice(0, index + 1).join("/");
      let directory = directories.get(folderPath);
      if (!directory) {
        directory = { kind: "directory", name: parts[index], path: folderPath, children: [], fileCount: 0 };
        directories.set(folderPath, directory);
        children.push(directory);
      }
      directory.fileCount++;
      children = directory.children;
    }
    children.push({ kind: "file", name: parts[parts.length - 1], path: file.path, file });
  }
  const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  function sort(nodes: SourceTreeNode[]) {
    nodes.sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || compareText(a.name.toLowerCase(), b.name.toLowerCase()) || compareText(a.name, b.name));
    for (const node of nodes) if (node.kind === "directory") sort(node.children);
  }
  sort(roots);
  return roots;
}
