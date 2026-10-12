export interface GraphViewport { x: number; y: number; zoom: number }
export interface PaneSize { width: number; height: number }
export function preserveViewportCenter(viewport: GraphViewport, previous: PaneSize, next: PaneSize): GraphViewport {
  return { ...viewport, x: viewport.x + (next.width - previous.width) / 2, y: viewport.y + (next.height - previous.height) / 2 };
}
export function clampSplit(value: number) { return Math.max(35, Math.min(75, value)); }
