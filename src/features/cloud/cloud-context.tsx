import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

import type { PersonalWorkspaceBootstrap } from "@/domain/cloud/workspace";
import { createBrowserCloudClient } from "@/services/cloud/cloud-client";
import {
  resolveCloudConfiguration,
  type CloudConfiguration,
  type CloudEnvironment,
} from "@/services/cloud/cloud-config";

export type CloudAuthState = "initializing" | "anonymous" | "authenticated" | "expired" | "error";
export type CloudReachability = "unknown" | "checking" | "reachable" | "unreachable";

const bootstrapSchema = z.object({
  profile: z.object({
    id: z.string().uuid(),
    displayName: z.string().min(1),
    personalWorkspaceId: z.string().uuid(),
  }),
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  membership: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["owner", "operator"]),
    createdAt: z.string(),
  }),
});

export interface CloudRuntimeValue {
  configuration: CloudConfiguration;
  auth: CloudAuthState;
  reachability: CloudReachability;
  user: { id: string; email: string | null } | null;
  identity: PersonalWorkspaceBootstrap | null;
  recovery: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  requestPasswordRecovery(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
}

type CloudClientFactory = (
  configuration: Extract<CloudConfiguration, { state: "configured" }>,
) => Promise<SupabaseClient>;

export interface CloudProviderProps {
  children: ReactNode;
  environment?: CloudEnvironment;
  createClient?: CloudClientFactory;
  timeoutMs?: number;
}

const CloudContext = createContext<CloudRuntimeValue | null>(null);

const DEFAULT_CLOUD_ENVIRONMENT: CloudEnvironment = {
  VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
};

function timeout<T>(promise: PromiseLike<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error("Supabase no respondió a tiempo.")),
      milliseconds,
    );
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (reason: unknown) => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    );
  });
}

export function CloudProvider({
  children,
  environment = DEFAULT_CLOUD_ENVIRONMENT,
  createClient = createBrowserCloudClient,
  timeoutMs = 8_000,
}: CloudProviderProps) {
  const configuration = useMemo(() => resolveCloudConfiguration(environment), [environment]);
  const clientRef = useRef<SupabaseClient | null>(null);
  const operationRef = useRef(0);
  const explicitLogoutRef = useRef(false);
  const [auth, setAuth] = useState<CloudAuthState>(
    configuration.state === "configured" ? "initializing" : "anonymous",
  );
  const [reachability, setReachability] = useState<CloudReachability>("unknown");
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [identity, setIdentity] = useState<PersonalWorkspaceBootstrap | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyAnonymous = useCallback((expired = false) => {
    setAuth(expired ? "expired" : "anonymous");
    setReachability("unknown");
    setUser(null);
    setIdentity(null);
    setRecovery(false);
  }, []);

  const resolveSession = useCallback(async (client: SupabaseClient, session: Session | null) => {
    const operation = ++operationRef.current;
    if (!session) {
      applyAnonymous(false);
      return;
    }
    setAuth("authenticated");
    setUser({ id: session.user.id, email: session.user.email ?? null });
    setReachability(navigator.onLine ? "checking" : "unreachable");
    if (!navigator.onLine) return;
    try {
      const response = await timeout(client.rpc("ensure_personal_workspace"), timeoutMs);
      if (operation !== operationRef.current) return;
      if (response.error) throw response.error;
      setIdentity(bootstrapSchema.parse(response.data));
      setReachability("reachable");
      setError(null);
    } catch (reason) {
      if (operation !== operationRef.current) return;
      const candidate = reason as { status?: unknown; code?: unknown };
      if (candidate?.status === 401 || candidate?.code === "PGRST301") {
        applyAnonymous(true);
      } else {
        setReachability("unreachable");
        setError(reason instanceof Error ? reason.message : "No se pudo resolver el workspace cloud.");
      }
    }
  }, [applyAnonymous, timeoutMs]);

  useEffect(() => {
    if (configuration.state !== "configured") return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void createClient(configuration).then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const subscription = client.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") {
          const expired = !explicitLogoutRef.current;
          explicitLogoutRef.current = false;
          applyAnonymous(expired);
          return;
        }
        if (session) {
          explicitLogoutRef.current = false;
          void resolveSession(client, session);
        }
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (active) await resolveSession(client, data.session);
      } catch (reason) {
        if (!active) return;
        setAuth("error");
        setReachability("unreachable");
        setError(reason instanceof Error ? reason.message : "No se pudo iniciar Supabase.");
      }
    }).catch((reason: unknown) => {
      if (!active) return;
      setAuth("error");
      setReachability("unreachable");
      setError(reason instanceof Error ? reason.message : "No se pudo crear el cliente Supabase.");
    });
    return () => {
      active = false;
      operationRef.current += 1;
      unsubscribe?.();
      clientRef.current = null;
    };
  }, [applyAnonymous, configuration, createClient, resolveSession]);

  useEffect(() => {
    const onOnline = () => {
      const client = clientRef.current;
      if (!client) return;
      void client.auth.getSession().then(({ data }) => resolveSession(client, data.session));
    };
    const onOffline = () => {
      if (auth === "authenticated") setReachability("unreachable");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [auth, resolveSession]);

  const requireClient = () => {
    const client = clientRef.current;
    if (!client) throw new Error("Supabase no está configurado o todavía no inició.");
    return client;
  };

  const run = useCallback(async (action: (client: SupabaseClient) => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(requireClient());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La operación cloud falló.");
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<CloudRuntimeValue>(() => ({
    configuration,
    auth,
    reachability,
    user,
    identity,
    recovery,
    busy,
    error,
    notice,
    signUp: (email, password) => run(async (client) => {
      const { data, error: signUpError } = await client.auth.signUp({ email, password });
      if (signUpError) throw new Error("No se pudo crear la cuenta con esos datos.");
      if (data.session) await resolveSession(client, data.session);
      else setNotice("Revisá tu email para confirmar la cuenta.");
    }),
    signIn: (email, password) => run(async (client) => {
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("No se pudo iniciar sesión. Verificá tus credenciales.");
      await resolveSession(client, data.session);
    }),
    requestPasswordRecovery: (email) => run(async (client) => {
      const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`,
      });
      if (recoveryError) throw recoveryError;
      setNotice("Si la cuenta existe, recibirás instrucciones por email.");
    }),
    updatePassword: (password) => run(async (client) => {
      const { error: passwordError } = await client.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      setRecovery(false);
      setNotice("Contraseña actualizada.");
    }),
    signOut: () => run(async (client) => {
      explicitLogoutRef.current = true;
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) {
        explicitLogoutRef.current = false;
        throw signOutError;
      }
      applyAnonymous(false);
    }),
    retry: () => run(async (client) => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      await resolveSession(client, data.session);
    }),
  }), [
    applyAnonymous, auth, busy, configuration, error, identity, notice, reachability,
    recovery, resolveSession, run, user,
  ]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudRuntimeValue {
  const value = useContext(CloudContext);
  if (!value) throw new Error("useCloud debe utilizarse dentro de CloudProvider.");
  return value;
}
