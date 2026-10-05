import { useReactFlow, useViewport } from "@xyflow/react";
import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CanvasControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="canvas-controls" role="group" aria-label="Canvas controls">
      <Button variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 0.1} onClick={() => void zoomOut()}><Minus aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 1.8} onClick={() => void zoomIn()}><Plus aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Fit to view" title="Fit to view" onClick={() => void fitView({ padding: 0.1, maxZoom: 1.4 })}><Maximize aria-hidden="true" /></Button>
    </div>
  );
}
