import type { BackgroundTransition } from "@/domain/output/output-snapshot";

export const BACKGROUND_PREFERENCES_KEY = "broadcast-control.live.backgrounds.v1";

export interface BackgroundPreferences {
  transition: BackgroundTransition;
}

export const DEFAULT_BACKGROUND_PREFERENCES: BackgroundPreferences = {
  transition: "cut",
};

export function parseBackgroundPreferences(raw: string | null): BackgroundPreferences {
  if (!raw) return { ...DEFAULT_BACKGROUND_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      transition: value["transition"] === "fade" ? "fade" : "cut",
    };
  } catch {
    return { ...DEFAULT_BACKGROUND_PREFERENCES };
  }
}
