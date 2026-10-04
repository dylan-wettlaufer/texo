import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { Diagram } from "@/lib/architecture/types";
import { diagramSize, edgeGeometry } from "@/lib/architecture/geometry";
import { ArchitectureNode } from "./architecture-node";

export function DiagramCanvas({ diagram, selectedId, scale, fitRevision, onSelect, onResize }: { diagram: Diagram; selectedId: string | null; scale: number; fitRevision: number; onSelect: (id: string | null) => void; onResize: (size: { width: number; height: number }) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markerId = useId().replaceAll(":", "");
  const size = diagramSize(diagram.nodes);

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, [fitRevision]);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => onResize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize]);

  return (
    <div ref={viewportRef} className="canvas-viewport" aria-label={`${diagram.name} diagram canvas`} onKeyDown={(event) => { if (event.key === "Escape") onSelect(null); }}>
      <div ref={scrollRef} className="canvas-scroll" tabIndex={0} aria-label="Scrollable diagram. Use arrow keys to scroll." onClick={(event) => { if (!(event.target as Element).closest("button")) onSelect(null); }}>
        <div className="canvas-scaled-area" style={{ width: size.width * scale + 48, height: size.height * scale + 80 }}>
          <div className="diagram-surface" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
            <svg className="diagram-edges" width={size.width} height={size.height} role="img" aria-label={diagram.edges.map((edge) => `${diagram.nodes.find((node) => node.id === edge.source)?.name} to ${diagram.nodes.find((node) => node.id === edge.target)?.name}: ${edge.label}`).join(". ")}>
              <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
              {diagram.edges.map((edge) => {
                const source = diagram.nodes.find((node) => node.id === edge.source);
                const target = diagram.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const { path, label } = edgeGeometry(source, target);
                const active = selectedId === edge.source || selectedId === edge.target;
                const width = edge.label.length * 6.5 + 20;
                return <g key={edge.id} className={active ? "edge active" : "edge"}><path d={path} fill="none" markerEnd={`url(#${markerId})`} /><rect x={label.x - width / 2} y={label.y - 11} width={width} height={22} rx={5} /><text x={label.x} y={label.y + 4} textAnchor="middle">{edge.label}</text></g>;
              })}
            </svg>
            {diagram.nodes.map((node) => <ArchitectureNode key={node.id} node={node} selected={selectedId === node.id} onSelect={onSelect} />)}
          </div>
        </div>
      </div>
      <span className="canvas-hint">Select a node to explore · Esc to clear</span>
    </div>
  );
}
