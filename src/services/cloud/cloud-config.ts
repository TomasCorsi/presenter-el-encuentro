import { z } from "zod";

export interface CloudEnvironment {
  VITE_SUPABASE_URL?: string | undefined;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
}

export type CloudConfiguration =
  | { state: "unconfigured" }
  | { state: "configured"; url: string; publishableKey: string }
  | { state: "invalid"; message: string };

const urlSchema = z.string().url();

export function resolveCloudConfiguration(environment: CloudEnvironment): CloudConfiguration {
  const rawUrl = environment.VITE_SUPABASE_URL?.trim() ?? "";
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!rawUrl && !publishableKey) return { state: "unconfigured" };
  if (!rawUrl || !publishableKey) {
    return { state: "invalid", message: "La URL y la publishable key deben configurarse juntas." };
  }
  if (publishableKey.startsWith("sb_secret_") || /service[_-]?role/i.test(publishableKey)) {
    return { state: "invalid", message: "La aplicación sólo admite una publishable key." };
  }

  const parsed = urlSchema.safeParse(rawUrl);
  if (!parsed.success) return { state: "invalid", message: "La URL de Supabase no es válida." };
  const url = new URL(parsed.data);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    return { state: "invalid", message: "Supabase requiere HTTPS fuera de localhost." };
  }
  return { state: "configured", url: url.href.replace(/\/$/, ""), publishableKey };
}
