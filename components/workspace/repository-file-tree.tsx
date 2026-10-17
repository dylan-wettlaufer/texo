import { useMemo } from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildSourceTree } from "@/lib/local-repository/file-tree.mts";
import type { SourceTreeNode } from "@/lib/local-repository/file-tree.mts";
import type { FileSummary } from "@/lib/repository/query-types.mts";

export function RepositoryFileTree({ files, selectedFileId, filtered, onFile }: {
  files: FileSummary[];
  selectedFileId?: string;
  filtered: boolean;
  onFile: (fileId: string) => void;
}) {
  const roots = useMemo(() => buildSourceTree(files), [files]);
  function nodes(items: SourceTreeNode[], depth = 0) {
    return <ul>{items.map((node) => <li key={node.path}>
      {node.kind === "directory" ? <Collapsible className="source-tree-folder" defaultOpen={depth === 0 || filtered || Boolean(selectedFileId?.startsWith(`${node.path}/`))}>
        <CollapsibleTrigger asChild><Button variant="ghost" className="source-tree-row source-tree-directory" title={node.path}>
          <ChevronRight className="source-tree-chevron" aria-hidden="true" /><Folder className="source-tree-folder-closed" aria-hidden="true" /><FolderOpen className="source-tree-folder-open" aria-hidden="true" />
          <span className="source-tree-name">{node.name}</span><span className="source-tree-count" aria-label={`${node.fileCount} files`}>{node.fileCount}</span>
        </Button></CollapsibleTrigger>
        <CollapsibleContent>{nodes(node.children, depth + 1)}</CollapsibleContent>
      </Collapsible> : <Button variant="ghost" className="source-tree-row source-tree-file" aria-current={selectedFileId === node.file.id ? "true" : undefined} title={`${node.path}${node.file.status === "partial" ? " · Partial source" : node.file.declarationFile ? " · Declaration file" : ""}`} onClick={() => onFile(node.file.id)}>
        <FileCode2 aria-hidden="true" /><span className="source-tree-name">{node.name}</span>{node.file.status === "partial" && <span className="source-tree-partial" aria-label="Partial source">!</span>}
      </Button>}
    </li>)}</ul>;
  }
  return <nav className="repository-source-tree" aria-label="Source files">{nodes(roots)}</nav>;
}
