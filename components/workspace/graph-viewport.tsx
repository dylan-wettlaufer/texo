import { useEffect, useRef } from "react";
import { useNodesInitialized, useReactFlow, useStore } from "@xyflow/react";
import { preserveViewportCenter, type GraphViewport, type PaneSize } from "@/lib/exploration/viewport";

// Pane dimensions come from React Flow's observer, after CSS has been measured.
export function GraphViewportManager({ exploring }: { exploring: boolean }) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const domNode = useStore((state) => state.domNode);
  const initialized = useNodesInitialized();
  const { fitView, getViewport, setViewport } = useReactFlow();
  const previous = useRef<(PaneSize & { exploring: boolean }) | null>(null);
  const saved = useRef<(PaneSize & { viewport: GraphViewport }) | null>(null);
  useEffect(() => {
    if (!initialized || !width || !height) return;
    const current = { width, height, exploring };
    const old = previous.current;
    // Save before the resize adjustment; the viewport still describes the old pane.
    if (old && !old.exploring && exploring && !saved.current) saved.current = { width: old.width, height: old.height, viewport: getViewport() };
    // A mode change can render before the ResizeObserver publishes the new size.
    if (domNode && (domNode.offsetWidth !== width || domNode.offsetHeight !== height)) return;
    const frame = requestAnimationFrame(() => {
      if (!old || (!old.exploring && exploring)) {
        void fitView({ padding: 0.18, maxZoom: 1 });
      } else if (old.exploring && !exploring && saved.current) {
        void setViewport(preserveViewportCenter(saved.current.viewport, saved.current, current));
        saved.current = null;
      } else if (width !== old.width || height !== old.height) {
        void setViewport(preserveViewportCenter(getViewport(), old, current));
      }
      previous.current = current;
    });
    return () => cancelAnimationFrame(frame);
  }, [width, height, exploring, initialized, domNode, fitView, getViewport, setViewport]);
  return null;
}
