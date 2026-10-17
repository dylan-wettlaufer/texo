"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourceViewer } from "./source-viewer";
import { RepositoryFileTree } from "./repository-file-tree";
import { callSelection, createRequestGate, moveRepositoryHistory, pushRepositorySelection, selectionRange } from "@/lib/local-repository/navigation.mts";
import type { LocalFileDetail, LocalSummary, RepositoryHistory, RepositorySelection, SnapshotResult } from "@/lib/local-repository/types.mts";
import type { CallQueryResult, DeclarationDetail, DeclarationSummary, FileSummary, QueryPage } from "@/lib/repository/query-types.mts";

class BrowserRequestError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
async function request<T>(params?: Record<string, string>, refresh = false): Promise<SnapshotResult<T>> {
  const response = await fetch(`/api/local-repository${params ? `?${new URLSearchParams(params)}` : ""}`, { method: refresh ? "POST" : "GET", cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new BrowserRequestError(body.error?.code ?? "request-failed", body.error?.message ?? "Repository request failed");
  return body as SnapshotResult<T>;
}
function message(error: unknown) { return error instanceof Error ? error.message : "Repository request failed"; }
function Pagination({ page, onOffset, label }: { page: QueryPage<unknown>; onOffset: (offset: number) => void; label: string }) {
  return <div className="repository-pagination" aria-label={`${label} pagination`}>
    <span>{page.total ? `${page.offset + 1}–${Math.min(page.offset + page.items.length, page.total)} of ${page.total}` : "No results"}</span>
    <Button variant="outline" size="icon-sm" aria-label={`Previous ${label}`} disabled={!page.offset} onClick={() => onOffset(Math.max(0, page.offset - page.limit))}><ArrowLeft aria-hidden="true" /></Button>
    <Button variant="outline" size="icon-sm" aria-label={`Next ${label}`} disabled={page.offset + page.limit >= page.total} onClick={() => onOffset(page.offset + page.limit)}><ArrowRight aria-hidden="true" /></Button>
  </div>;
}
function BrowserList({ revision, selectedFileId, onSelect, onStale }: { revision: string; selectedFileId?: string; onSelect: (selection: RepositorySelection) => void; onStale: () => void }) {
  const [mode, setMode] = useState<"files" | "search">("files");
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ key: string; page?: QueryPage<FileSummary | DeclarationSummary>; error?: string }>();
  const key = JSON.stringify([revision, mode, term, offset]);
  const gate = useRef(createRequestGate());
  useEffect(() => {
    const ticket = gate.current.next();
    const active = gate.current;
    async function load() {
      if (mode === "search" && !term) return;
      try {
        if (mode === "files") {
          const files: FileSummary[] = [];
          // Keep folders complete across API pages; only metadata is loaded here.
          for (let fileOffset = 0; ; ) {
            const { data } = await request<QueryPage<FileSummary>>({ operation: "files", revision, offset: String(fileOffset), limit: "200", pathContains: term });
            if (!active.current(ticket)) return;
            files.push(...data.items);
            fileOffset += data.items.length;
            if (fileOffset >= data.total || !data.items.length) break;
          }
          setResult({ key, page: { items: files, total: files.length, offset: 0, limit: files.length } });
        } else {
          const { data } = await request<QueryPage<DeclarationSummary>>({ operation: "search", revision, offset: String(offset), limit: "25", text: term });
          if (active.current(ticket)) setResult({ key, page: data });
        }
      } catch (error) {
        if (!active.current(ticket)) return;
        if (error instanceof BrowserRequestError && error.code === "stale-revision") onStale();
        setResult({ key, error: message(error) });
      }
    }
    void load();
    return () => active.cancel();
  }, [revision, mode, term, offset, key, onStale]);
  return <aside className="repository-browser" aria-label="Repository browser">
    <form onSubmit={(event) => { event.preventDefault(); if (mode === "search" && !input.trim()) return; setTerm(input.trim()); setOffset(0); }}>
      <label>Browse<select aria-label="Browse repository" value={mode} onChange={(event) => { const next = event.target.value as "files" | "search"; setMode(next); setTerm(""); setInput(""); setOffset(0); }}><option value="files">Files</option><option value="search">Functions</option></select></label>
      <label>{mode === "files" ? "Filter file paths" : "Search functions"}<input aria-label={mode === "files" ? "Filter file paths" : "Search functions"} value={input} onChange={(event) => setInput(event.target.value)} /></label>
      <Button variant="outline" type="submit"><Search aria-hidden="true" />{mode === "files" ? "Filter" : "Search"}</Button>
    </form>
    {mode === "search" && !term ? <p>Enter a function name and select Search.</p> : result?.key !== key ? <p role="status">Loading {mode === "files" ? "files" : "functions"}…</p> : result.error ? <p role="alert">{result.error}</p> : result.page && <>
      {mode === "files" ? <RepositoryFileTree key={`${revision}:${term}`} files={result.page.items.filter((item): item is FileSummary => !("fileId" in item))} selectedFileId={selectedFileId} filtered={Boolean(term)} onFile={(fileId) => onSelect({ fileId })} /> : <ul className="repository-results">{result.page.items.map((item) => "fileId" in item && <li key={item.id}><Button variant="ghost" onClick={() => onSelect({ fileId: item.fileId, declarationId: item.id })}>
        <span>{item.qualifiedName}<small>{item.fileId}:{item.range.startLine}{item.duplicate ? " · duplicate declaration" : ""}</small></span>
      </Button></li>)}</ul>}
      {!result.page.total && <p role="status">No matching {mode === "files" ? "files" : "functions"}.</p>}
      {mode === "search" ? <Pagination page={result.page} onOffset={setOffset} label={mode} /> : <p className="source-tree-total">{result.page.total} {term ? "matching " : ""}{result.page.total === 1 ? "file" : "files"}</p>}
    </>}
  </aside>;
}
function CallList({ title, page, direction, onOffset, onSelect, revision }: { title: string; page: QueryPage<CallQueryResult>; direction: "callers" | "callees"; onOffset: (offset: number) => void; onSelect: (selection: RepositorySelection) => void; revision: string }) {
  return <section className="explanation-section"><h3>{title}</h3><ul className="repository-calls">{page.items.map((call) => {
    const selection = callSelection(call, direction);
    return <li key={call.id}>{selection ? <Button variant="ghost" onClick={() => onSelect({ ...selection, revision })}>{direction === "callers" ? call.caller?.qualifiedName ?? "Top-level call" : call.target?.qualifiedName ?? call.callee}</Button> : <strong>{call.callee}</strong>}
      <small>{call.fileId}:{call.range.startLine}</small>
      {call.resolution === "unresolved" && <p>Unresolved: {call.unresolvedReason}</p>}
    </li>;
  })}</ul>{!page.total && <p>No {direction === "callers" ? "resolved callers" : "direct calls"} in this scan.</p>}<Pagination page={page} onOffset={onOffset} label={direction} /></section>;
}
function SelectionPane({ selection, revision, onSelect, onStale }: { selection: RepositorySelection; revision: string; onSelect: (selection: RepositorySelection) => void; onStale: () => void }) {
  const [callersOffset, setCallersOffset] = useState(0);
  const [calleesOffset, setCalleesOffset] = useState(0);
  const [result, setResult] = useState<{ key: string; file?: LocalFileDetail; declaration?: DeclarationDetail; callers?: QueryPage<CallQueryResult>; callees?: QueryPage<CallQueryResult>; error?: string }>();
  const sourceRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gate = useRef(createRequestGate());
  const key = JSON.stringify([selection, revision, callersOffset, calleesOffset]);
  useEffect(() => {
    const active = gate.current;
    const ticket = active.next();
    async function load() {
      const base = { revision, id: selection.declarationId ?? "" };
      const responses = await Promise.allSettled([
        request<LocalFileDetail>({ operation: "file", revision, id: selection.fileId }),
        ...(selection.declarationId ? [request<DeclarationDetail>({ ...base, operation: "declaration" }), request<QueryPage<CallQueryResult>>({ ...base, operation: "callers", offset: String(callersOffset), limit: "10" }), request<QueryPage<CallQueryResult>>({ ...base, operation: "callees", offset: String(calleesOffset), limit: "10" })] : []),
      ]);
      if (!active.current(ticket)) return;
      const failure = responses.find((response) => response.status === "rejected");
      if (failure?.status === "rejected" && failure.reason instanceof BrowserRequestError && failure.reason.code === "stale-revision") onStale();
      const value = <T,>(index: number): T | undefined => { const response = responses[index]; return response?.status === "fulfilled" ? response.value.data as T : undefined; };
      setResult({ key, file: value<LocalFileDetail>(0), declaration: value<DeclarationDetail>(1), callers: value<QueryPage<CallQueryResult>>(2), callees: value<QueryPage<CallQueryResult>>(3), ...(failure?.status === "rejected" ? { error: message(failure.reason) } : {}) });
    }
    void load();
    return () => active.cancel();
  }, [selection, revision, callersOffset, calleesOffset, key, onStale]);
  useEffect(() => { if (result?.key === key) headingRef.current?.focus({ preventScroll: true }); }, [result?.key, key]);
  if (result?.key !== key) return <p className="repository-placeholder" role="status">Loading source and relationships…</p>;
  const file = result.file;
  const declaration = result.declaration;
  const rawRange = selectionRange(selection, revision, declaration);
  const range = rawRange ? { startLine: rawRange.startLine, endLine: rawRange.endLine - (rawRange.endColumn === 1 && rawRange.endLine > rawRange.startLine ? 1 : 0) } : undefined;
  const callables = file?.declarations.filter((candidate) => candidate.callable) ?? [];
  return <div className="repository-selection">
    <header className="explorer-header"><h2 ref={headingRef} tabIndex={-1}>{file?.path ?? selection.fileId}</h2>
      {result.error && <p className="source-unavailable" role="alert">{result.error} Choose another file or function, or refresh the scan.</p>}
      {file?.status === "partial" && <p role="status">This file has syntax errors; recovered source and declarations are shown.</p>}
      {file && <label className="repository-function-picker">Function<select aria-label="Select repository function" value={declaration?.id ?? ""} onChange={(event) => onSelect({ fileId: file.id, ...(event.target.value ? { declarationId: event.target.value } : {}) })}><option value="">{callables.length ? "Select a function" : "No functions in this file"}</option>{callables.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.qualifiedName} · line {candidate.range.startLine}</option>)}</select></label>}
    </header>
    <div className="explorer-panes">
      <div ref={sourceRef} className="code-scroll" role="region" tabIndex={0} aria-label="Repository source code">{file && <SourceViewer lines={file.lines} declarations={callables.map((candidate) => ({ ...candidate, name: candidate.qualifiedName }))} range={range} scrollKey={`${key}:${file.id}`} scrollRef={sourceRef} onDeclaration={(id) => onSelect({ fileId: file.id, declarationId: id })} />}</div>
      <div className="explorer-context exploration-explanation" role="region" tabIndex={0} aria-label="Function details">
        {declaration ? <><h2>{declaration.qualifiedName}</h2><p>{declaration.kind} · Lines {declaration.sourceRange.startLine}–{declaration.sourceRange.endLine - (declaration.sourceRange.endColumn === 1 && declaration.sourceRange.endLine > declaration.sourceRange.startLine ? 1 : 0)}</p>{declaration.duplicate && <p>Duplicate declaration. Ambiguous calls are not linked.</p>}{!declaration.implementationRange && <p>No implementation is available; this is a signature-only declaration.</p>}
          <p className="inspector-empty">Static references describe directly identifiable calls. Dynamic and external calls may remain unresolved. No explanation has been authored for this function.</p>
          {result.callers && <CallList title="Callers" direction="callers" page={result.callers} onOffset={setCallersOffset} onSelect={onSelect} revision={revision} />}
          {result.callees && <CallList title="Calls" direction="callees" page={result.callees} onOffset={setCalleesOffset} onSelect={onSelect} revision={revision} />}
        </> : <p>Select a function to inspect its callers and calls.</p>}
      </div>
    </div>
  </div>;
}
export function RepositoryWorkspace() {
  const [snapshot, setSnapshot] = useState<SnapshotResult<LocalSummary>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [stale, setStale] = useState(false);
  const [history, setHistory] = useState<RepositoryHistory>({ entries: [], index: 0 });
  const gate = useRef(createRequestGate());
  const bootstrap = useCallback((refresh = false) => {
    const ticket = gate.current.next();
    return request<LocalSummary>(refresh ? undefined : { operation: "summary" }, refresh).then((result) => {
      if (!gate.current.current(ticket)) return;
      setSnapshot(result);
      setStale(false);
    }).catch((failure: unknown) => { if (gate.current.current(ticket)) setError(message(failure)); })
      .finally(() => { if (gate.current.current(ticket)) setBusy(false); });
  }, []);
  useEffect(() => { void bootstrap(); const active = gate.current; return () => active.cancel(); }, [bootstrap]);
  const onStale = useCallback(() => setStale(true), []);
  const navigate = useCallback((selection: RepositorySelection) => setHistory((previous) => pushRepositorySelection(previous, selection)), []);
  const selection = history.entries[history.index];
  return <section className="repository-workspace" aria-label="Local repository Code Explorer">
    <header className="repository-header"><div><span className="eyebrow">LOCAL CHECKOUT</span><h1>Texo · Code Explorer</h1><p>{snapshot ? `${snapshot.data.files} files · ${snapshot.data.declarations} declarations · ${snapshot.data.diagnostics.total} scan diagnostics` : "Browse source and direct call relationships."}</p></div>
      <Button variant="outline" disabled={busy} onClick={() => { setBusy(true); setError(undefined); void bootstrap(true); }}><RefreshCw aria-hidden="true" />{busy ? "Scanning…" : "Refresh"}</Button>
      <div className="explorer-history"><Button variant="outline" size="icon-sm" aria-label="Repository exploration back" disabled={!history.index} onClick={() => setHistory((previous) => moveRepositoryHistory(previous, -1))}><ArrowLeft aria-hidden="true" /></Button><Button variant="outline" size="icon-sm" aria-label="Repository exploration forward" disabled={history.index >= history.entries.length - 1} onClick={() => setHistory((previous) => moveRepositoryHistory(previous, 1))}><ArrowRight aria-hidden="true" /></Button></div>
    </header>
    {error && <p role="alert" className="source-unavailable">{error}{snapshot && " Showing the previous scan."}<Button variant="outline" size="sm" onClick={() => { setBusy(true); setError(undefined); void bootstrap(true); }}>Retry</Button></p>}
    {stale && <p role="status" className="source-unavailable">The repository scan changed. <Button variant="outline" size="sm" onClick={() => { setBusy(true); setError(undefined); void bootstrap(); }}>Reload current scan</Button></p>}
    {!snapshot ? <p className="repository-placeholder" role="status">{busy ? "Scanning the local checkout…" : "Local source is unavailable. Retry the scan."}</p> : <div className="repository-body">
      <BrowserList revision={snapshot.revision} selectedFileId={selection?.fileId} onSelect={navigate} onStale={onStale} />
      <div className="repository-content">{selection ? <SelectionPane key={`${selection.fileId}:${selection.declarationId ?? ""}`} selection={selection} revision={snapshot.revision} onSelect={navigate} onStale={onStale} /> : <p className="repository-placeholder">Choose a file or search for a function to explore its source.</p>}</div>
    </div>}
  </section>;
}
