import { useEffect, type RefObject } from "react";
import type { SourceRange, SourceToken } from "@/lib/exploration/types";

export function SourceViewer({ lines, declarations, range, scrollKey, scrollRef, visible = true, onDeclaration, annotationAtLine }: {
  lines: { number: number; tokens: SourceToken[] }[];
  declarations: { id: string; name: string; range?: SourceRange }[];
  range?: SourceRange;
  scrollKey: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  visible?: boolean;
  onDeclaration: (id: string) => void;
  annotationAtLine?: (line: number) => { label: string; active: boolean; marker: boolean; activate: () => void } | undefined;
}) {
  useEffect(() => {
    if (!range?.startLine || !visible) return;
    const frame = requestAnimationFrame(() => {
      const row = scrollRef.current?.querySelector<HTMLElement>(`[data-line="${range.startLine}"]`);
      if (row && scrollRef.current) scrollRef.current.scrollTo({ top: Math.max(0, row.offsetTop - 24), behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [range?.startLine, range?.endLine, scrollKey, scrollRef, visible]);
  return <div className="source-lines">{lines.map((line) => {
    const declaration = declarations.find((candidate) => candidate.range?.startLine === line.number);
    const annotation = annotationAtLine?.(line.number);
    const highlighted = range && line.number >= range.startLine && line.number <= range.endLine;
    const tokens = line.tokens.map((token, index) => <span key={index} className={`syntax-${token.kind}`}>{token.text}</span>);
    return <div key={line.number} data-line={line.number} className={`source-line${highlighted ? " is-highlighted" : ""}`}>
      <span className="line-number" aria-hidden="true">{line.number}</span>
      <span className="code-markers" aria-hidden="true">{annotation?.marker && <span>●</span>}</span>
      <code>{annotation ? <button className="code-step" type="button" aria-label={annotation.label} aria-pressed={annotation.active} onClick={annotation.activate}>{tokens.length ? tokens : " "}</button>
        : declaration ? <button className="code-declaration" type="button" aria-label={`Explore ${declaration.name}`} onClick={() => onDeclaration(declaration.id)}>{tokens}</button> : tokens}</code>
    </div>;
  })}</div>;
}
