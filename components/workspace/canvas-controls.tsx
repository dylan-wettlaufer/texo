export function CanvasControls({ scale, onZoom, onFit }: { scale: number; onZoom: (direction: number) => void; onFit: () => void }) {
  return (
    <div className="canvas-controls" role="group" aria-label="Canvas controls">
      <button aria-label="Zoom out" disabled={scale <= 0.1} onClick={() => onZoom(-1)}>−</button>
      <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
      <button aria-label="Zoom in" disabled={scale >= 1.8} onClick={() => onZoom(1)}>+</button>
      <span className="control-divider" />
      <button className="fit-button" onClick={onFit}>Fit to view</button>
    </div>
  );
}
