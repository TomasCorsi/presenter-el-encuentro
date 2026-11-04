import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { CloudProvider, useCloud } = await import("@/features/cloud/cloud-context");
type CloudRuntimeValue = ReturnType<typeof useCloud>;

const environment = {
  VITE_SUPABASE_URL: "https://church.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000010";
const session = {
  user: { id: userId, email: "operator@example.test" },
} as Session;
const identity = {
  profile: { id: userId, displayName: "operator", personalWorkspaceId: workspaceId },
  workspace: { id: workspaceId, name: "Workspace de operator", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  membership: { workspaceId, userId, role: "owner", createdAt: "2026-01-01T00:00:00Z" },
};

function mockClient() {
  let authListener: ((event: string, session: Session | null) => void) | null = null;
  let currentSession: Session | null = null;
  const calls: string[] = [];
  const client = {
    auth: {
      onAuthStateChange(callback: typeof authListener) {
        authListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() { return { data: { session: currentSession }, error: null }; },
      async signUp() { calls.push("signup"); return { data: { session: null }, error: null }; },
      async signInWithPassword() { calls.push("login"); currentSession = session; return { data: { session }, error: null }; },
      async resetPasswordForEmail() { calls.push("recovery"); return { data: {}, error: null }; },
      async updateUser() { calls.push("password"); return { data: {}, error: null }; },
      async signOut() { calls.push("logout"); currentSession = null; return { error: null }; },
    },
    async rpc(name: string) {
      calls.push(`rpc:${name}`);
      return { data: identity, error: null };
    },
  } as unknown as SupabaseClient;
  return {
    client,
    calls,
    emit(event: string, nextSession: Session | null) { authListener?.(event, nextSession); },
    setSession(next: Session | null) { currentSession = next; },
  };
}

describe("CloudProvider", () => {
  it("es SSR-safe y deja renderizar con cloud ausente", () => {
    expect(renderToString(
      <CloudProvider environment={{}}><span>Local disponible</span></CloudProvider>,
    )).toContain("Local disponible");
  });

  it("no bloquea children aunque el cliente cloud sea lento", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CloudProvider environment={environment} createClient={() => new Promise(() => undefined)}>
          <span>IndexedDB listo</span>
        </CloudProvider>,
      );
    });
    expect(container.textContent).toContain("IndexedDB listo");
    await act(async () => root.unmount());
  });

  it("implementa Auth/workspace sin tocar datos locales", async () => {
    const mock = mockClient();
    let runtime: CloudRuntimeValue | null = null;
    function Probe() { runtime = useCloud(); return null; }
    localStorage.setItem("broadcast-control.projects.guard", "preserve");
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CloudProvider environment={environment} createClient={async () => mock.client} timeoutMs={100}>
          <Probe />
        </CloudProvider>,
      );
    });
    await act(async () => { await Promise.resolve(); });
    expect(runtime).not.toBeNull();
    expect((runtime as CloudRuntimeValue).auth).toBe("anonymous");

    await act(async () => (runtime as CloudRuntimeValue).signUp("operator@example.test", "password"));
    await act(async () => (runtime as CloudRuntimeValue).requestPasswordRecovery("operator@example.test"));
    await act(async () => (runtime as CloudRuntimeValue).signIn("operator@example.test", "password"));
    expect((runtime as CloudRuntimeValue).auth).toBe("authenticated");
    expect((runtime as CloudRuntimeValue).identity?.workspace.id).toBe(workspaceId);
    expect(mock.calls).toContain("rpc:ensure_personal_workspace");

    await act(async () => (runtime as CloudRuntimeValue).signOut());
    expect((runtime as CloudRuntimeValue).auth).toBe("anonymous");
    expect(localStorage.getItem("broadcast-control.projects.guard")).toBe("preserve");

    mock.setSession(session);
    await act(async () => { mock.emit("SIGNED_IN", session); });
    await act(async () => { mock.emit("SIGNED_OUT", null); });
    expect((runtime as CloudRuntimeValue).auth).toBe("expired");
    await act(async () => root.unmount());
  });
});
