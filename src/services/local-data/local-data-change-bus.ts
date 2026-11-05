import type { SyncEntityType } from "@/domain/sync/sync";

export type LocalDataChangeOrigin = "local" | "remote";
export interface LocalDataChange { entityType: SyncEntityType; entityId: string; origin: LocalDataChangeOrigin }
type Listener = (change: LocalDataChange) => void;

export class LocalDataChangeBus {
  readonly #listeners = new Set<Listener>();
  readonly #channel: BroadcastChannel | null;
  constructor(channelFactory?: (name: string) => BroadcastChannel) {
    let channel: BroadcastChannel | null = null;
    try {
      channel = channelFactory?.("broadcast-control.local-data") ??
        (typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("broadcast-control.local-data"));
      if (channel) channel.onmessage = (event: MessageEvent<LocalDataChange>) => this.#emit(event.data, false);
    } catch { channel = null; }
    this.#channel = channel;
  }
  subscribe(listener: Listener): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  publish(change: LocalDataChange): void { this.#emit(change, true); }
  close(): void { this.#channel?.close(); this.#listeners.clear(); }
  #emit(change: LocalDataChange, broadcast: boolean): void {
    for (const listener of this.#listeners) listener(change);
    if (broadcast) { try { this.#channel?.postMessage(change); } catch { /* best effort */ } }
  }
}
