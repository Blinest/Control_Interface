import { useRef, type PointerEvent } from "react";
import { Maximize2 } from "lucide-react";
import type { CardSize } from "../../softuiTypes";
import { sizeFromDrag } from "./cardResize";
import "./cards.css";

export interface CardResizeHandleProps {
  label: string;
  size: CardSize;
  onResize: (size: CardSize) => void;
}

export function CardResizeHandle({ label, size, onResize }: CardResizeHandleProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const currentSizeRef = useRef(size);
  currentSizeRef.current = size;

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    startRef.current = { x: event.clientX, y: event.clientY };
    currentSizeRef.current = size;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;

    const next = sizeFromDrag(currentSizeRef.current, dx, dy);
    if (next !== currentSizeRef.current) {
      currentSizeRef.current = next;
      onResize(next);
    }
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = () => {
    startRef.current = null;
  };

  const pointerHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerCancel: onPointerUp,
    onPointerUp,
  };

  return (
    <>
      <button
        aria-label={label}
        className="card-resize-handle sr-only"
        type="button"
        {...pointerHandlers}
      >
        <Maximize2 aria-hidden="true" size={14} />
      </button>
      <div
        aria-hidden="true"
        className="card-resize-zone"
        {...pointerHandlers}
      />
    </>
  );
}
