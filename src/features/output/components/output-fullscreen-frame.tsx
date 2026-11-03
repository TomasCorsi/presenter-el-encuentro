import { useCallback, useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { OutputOverlay } from "./output-overlay";
import { useFullscreen } from "../use-fullscreen";
import { useIdleUi } from "../use-idle-ui";

export function OutputFullscreenFrame({ children }: { children: ReactNode }) {
  const { idle } = useIdleUi();
  const { fullscreen, enter } = useFullscreen();

  const enterFullscreen = useCallback(() => {
    void enter();
  }, [enter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      void enter();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enter]);

  return (
    <div
      className={cn("h-dvh w-full overflow-hidden", (idle || fullscreen) && "cursor-none")}
      onDoubleClick={enterFullscreen}
    >
      {children}
      <OutputOverlay
        visible={!idle && !fullscreen}
        onEnterFullscreen={enterFullscreen}
        hint="F o doble clic"
      />
    </div>
  );
}
