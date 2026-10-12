import { useEffect, useState, type RefObject } from "react";
import { clampSplit } from "@/lib/exploration/viewport";

export function ExplorationDivider({ value, onChange, container }: { value: number; onChange: (value: number) => void; container: RefObject<HTMLElement | null> }) {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const update = () => setStacked(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div className="exploration-divider" role="separator" tabIndex={0} aria-label="Resize code and graph panes" aria-orientation={stacked ? "horizontal" : "vertical"} aria-valuemin={35} aria-valuemax={75} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} percent code pane`} onKeyDown={(event) => {
    const decrease = stacked ? "ArrowUp" : "ArrowLeft";
    const increase = stacked ? "ArrowDown" : "ArrowRight";
    if (![decrease, increase, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    onChange(event.key === "Home" ? 35 : event.key === "End" ? 75 : clampSplit(value + (event.key === increase ? 2 : -2)));
  }} onPointerDown={(event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = container.current?.getBoundingClientRect();
    if (!bounds) return;
    onChange(clampSplit(stacked ? (event.clientY - bounds.top) / bounds.height * 100 : (event.clientX - bounds.left) / bounds.width * 100));
  }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}><span aria-hidden="true" /></div>;
}
