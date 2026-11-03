import { useRef } from "react";

import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import type { OutputConnection } from "@/services/output-sync/output-subscriber";

import { useOutputSnapshot } from "./use-output-snapshot";

export interface StageOutputState {
  connection: OutputConnection;
  /** Último snapshot conocido; se conserva mientras Stage está stale. */
  snapshot: OutputSnapshot | null;
}

export function stageSnapshotForDisplay(
  current: OutputSnapshot | null,
  last: OutputSnapshot | null,
): OutputSnapshot | null {
  return current ?? last;
}

/** Reutiliza el subscriber de Main y solo cambia la política visual al desconectar. */
export function useStageOutputState(): StageOutputState {
  const state = useOutputSnapshot();
  const lastSnapshot = useRef<OutputSnapshot | null>(null);
  if (state.snapshot) lastSnapshot.current = state.snapshot;
  return {
    connection: state.connection,
    snapshot: stageSnapshotForDisplay(state.snapshot, lastSnapshot.current),
  };
}
