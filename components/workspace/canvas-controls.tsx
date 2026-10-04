import { useReactFlow, useViewport } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function CanvasControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="canvas-controls" role="group" aria-label="Canvas controls">
      <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.1} onClick={() => void zoomOut()}>−</Button>
      <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 1.8} onClick={() => void zoomIn()}>+</Button>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <Button variant="ghost" size="sm" onClick={() => void fitView({ padding: 0.2, maxZoom: 1 })}>Fit to view</Button>
    </div>
  );
}
