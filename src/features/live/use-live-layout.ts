import { useMemo, useSyncExternalStore } from "react";

import { getLiveLayoutProfile, type LiveLayoutProfile } from "./live-layout";

const SERVER_VIEWPORT = "1920x1080";

function viewportSnapshot(): string {
  if (typeof window === "undefined") return SERVER_VIEWPORT;
  return `${window.innerWidth}x${window.innerHeight}`;
}

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    document.removeEventListener("fullscreenchange", onStoreChange);
  };
}

/** Perfil reactivo de Live sin convertir el layout visual en estado persistido. */
export function useLiveLayout(): LiveLayoutProfile {
  const snapshot = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => SERVER_VIEWPORT);
  return useMemo(() => {
    const [width = 1920, height = 1080] = snapshot.split("x").map(Number);
    return getLiveLayoutProfile(width, height);
  }, [snapshot]);
}
