import type { SupabaseClient } from "@supabase/supabase-js";

import type { CloudConfiguration } from "./cloud-config";

export type BrowserCloudClient = SupabaseClient;

/** Importa y crea Supabase únicamente después de hidratar en navegador. */
export async function createBrowserCloudClient(
  configuration: Extract<CloudConfiguration, { state: "configured" }>,
): Promise<BrowserCloudClient> {
  if (typeof window === "undefined") throw new Error("El cliente cloud sólo está disponible en navegador.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(configuration.url, configuration.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
