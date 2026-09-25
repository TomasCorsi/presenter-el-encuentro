import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
  libraryDockHeightFromDrag,
  type LibraryDockBounds,
} from "@/features/live/library-dock-height";
import { cn } from "@/lib/utils";

export interface LibraryDockResizeHandleProps {
  height: number;
  bounds: LibraryDockBounds;
  onHeightChange(height: number): void;
  onHeightCommit(height: number): void;
  onHeightCancel(): void;
  onReset(): void;
}

interface ActiveDrag {
  pointerId: number;
  startClientY: number;
  startHeight: number;
  currentHeight: number;
  target: HTMLDivElement;
  previousUserSelect: string;
  previousCursor: string;
}

/** Handle fino que administra pointer capture y listeners sólo durante el drag. */
export function LibraryDockResizeHandle({
  height,
  bounds,
  onHeightChange,
  onHeightCommit,
  onHeightCancel,
  onReset,
}: LibraryDockResizeHandleProps) {
  const dragRef = useRef<ActiveDrag | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
  );

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    cleanupRef.current?.();

    const target = event.currentTarget;
    const active: ActiveDrag = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startHeight: height,
      currentHeight: height,
      target,
      previousUserSelect: document.body.style.userSelect,
      previousCursor: document.body.style.cursor,
    };
    dragRef.current = active;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture es una mejora; los listeners de window mantienen el drag.
    }

    const move = (pointerEvent: PointerEvent) => {
      const current = dragRef.current;
      if (!current || pointerEvent.pointerId !== current.pointerId) return;
      pointerEvent.preventDefault();
      const next = libraryDockHeightFromDrag(
        current.startHeight,
        current.startClientY,
        pointerEvent.clientY,
        bounds,
      );
      current.currentHeight = next;
      onHeightChange(next);
    };

    const cleanup = () => {
      const current = dragRef.current;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      if (current) {
        try {
          if (current.target.hasPointerCapture?.(current.pointerId)) {
            current.target.releasePointerCapture(current.pointerId);
          }
        } catch {
          // El navegador puede haber liberado el capture al terminar el pointer.
        }
        document.body.style.userSelect = current.previousUserSelect;
        document.body.style.cursor = current.previousCursor;
      }
      dragRef.current = null;
      cleanupRef.current = null;
    };

    const finish = (pointerEvent: PointerEvent, commit: boolean) => {
      const current = dragRef.current;
      if (!current || pointerEvent.pointerId !== current.pointerId) return;
      const finalHeight = current.currentHeight;
      cleanup();
      if (commit) onHeightCommit(finalHeight);
      else onHeightCancel();
    };
    const end = (pointerEvent: PointerEvent) => finish(pointerEvent, true);
    const cancel = (pointerEvent: PointerEvent) => finish(pointerEvent, false);

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
  }

  return (
    <div
      role="separator"
      aria-label="Redimensionar biblioteca"
      aria-orientation="horizontal"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={height}
      title={`Arrastrar para cambiar altura. Doble click restaura ${bounds.defaultHeight}px.`}
      className={cn(
        "group relative h-2 shrink-0 cursor-ns-resize touch-none",
        "hover:bg-primary/5",
      )}
      onPointerDown={beginDrag}
      onDoubleClick={onReset}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/60"
      />
    </div>
  );
}
