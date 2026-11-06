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
import type { SyncConflict, SyncLink, SyncLinkAssessment, SyncStatus } from "@/domain/sync/sync";
import { useCloud, useCloudSyncClient } from "@/features/cloud/cloud-context";
import { useLocalData } from "@/features/local-data/local-data-context";
import { createSupabaseSyncGateway } from "@/services/sync/sync-cloud-gateway";
import { SyncEngine } from "@/services/sync/sync-engine";
import { maintenanceLeaseIsActive } from "@/services/backup/local-maintenance-coordinator";

export interface SyncRuntimeValue {
  status: SyncStatus;
  link: SyncLink | null;
  assessment: SyncLinkAssessment | null;
  conflicts: SyncConflict[];
  pendingCount: number;
  conflictsCount: number;
  errorCount: number;
  error: string | null;
  maintenance: boolean;
  beginMaintenance(): Promise<() => void>;
  assessLink(): Promise<void>;
  confirmLink(): Promise<void>;
  syncNow(): Promise<void>;
  retryErrors(): Promise<void>;
  unlink(): Promise<void>;
  resolve(
    conflict: SyncConflict,
    resolution: "keep-local" | "use-cloud" | "duplicate-local",
  ): Promise<void>;
}

const SyncContext = createContext<SyncRuntimeValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const client = useCloudSyncClient();
  const localData = useLocalData();
  const local = localData.sync;
  const gateway = useMemo(() => (client ? createSupabaseSyncGateway(client) : null), [client]);
  const engine = useMemo(
    () => (local && gateway ? new SyncEngine(local, gateway) : null),
    [gateway, local],
  );
  const [link, setLink] = useState<SyncLink | null>(null);
  const [assessment, setAssessment] = useState<SyncLinkAssessment | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const maintenanceRef = useRef(false);
  const runningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const previousAuth = useRef(cloud.auth);

  const refresh = useCallback(async () => {
    if (!local) return;
    const nextLink = await local.getActiveLink();
    if (!mounted.current) return;
    setLink(nextLink);
    if (!nextLink) {
      setPendingCount(0);
      setErrorCount(0);
      setConflicts([]);
      return;
    }
    const [counts, nextConflicts] = await Promise.all([
      local.counts(nextLink.linkKey),
      local.listConflicts(nextLink.linkKey),
    ]);
    if (!mounted.current) return;
    setPendingCount(counts.pending);
    setErrorCount(counts.errors);
    setConflicts(nextConflicts.filter((item) => !item.archivedAt));
  }, [local]);

  const syncNow = useCallback(async () => {
    if (!engine || !local || maintenanceRef.current || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    try {
      await engine.run();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo sincronizar.");
    } finally {
      setRunning(false);
      runningRef.current = false;
      await refresh();
    }
  }, [engine, local, refresh]);

  useEffect(() => {
    const refreshMaintenance = () => {
      const active = maintenanceLeaseIsActive(window.localStorage);
      maintenanceRef.current = active;
      setMaintenance(active);
    };
    refreshMaintenance();
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("presenter-maintenance-v1");
    window.addEventListener("storage", refreshMaintenance);
    channel?.addEventListener("message", refreshMaintenance);
    return () => {
      window.removeEventListener("storage", refreshMaintenance);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!engine || cloud.auth !== "authenticated" || !cloud.identity || !link) return;
    if (link.userId !== cloud.user?.id || link.cloudWorkspaceId !== cloud.identity.workspace.id) {
      setError("identity-mismatch: el vínculo pertenece a otra identidad o workspace.");
      return;
    }
    void syncNow();
  }, [cloud.auth, cloud.identity, cloud.user?.id, engine, link?.linkKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const was = previousAuth.current;
    previousAuth.current = cloud.auth;
    if (
      was === "authenticated" ||
      cloud.auth !== "authenticated" ||
      !local ||
      link?.state !== "paused" ||
      link.userId !== cloud.user?.id ||
      link.cloudWorkspaceId !== cloud.identity?.workspace.id
    )
      return;
    void local.resumeLink(link).then(refresh).then(syncNow);
  }, [cloud.auth, cloud.identity?.workspace.id, cloud.user?.id, link, local, refresh, syncNow]);

  useEffect(() => {
    if (!engine) return;
    const trigger = () => void syncNow();
    const visible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    window.addEventListener("online", trigger);
    window.addEventListener("pageshow", trigger);
    document.addEventListener("visibilitychange", visible);
    const unsubscribe = localData.changes?.subscribe((change) => {
      if (change.origin === "local") trigger();
    });
    return () => {
      window.removeEventListener("online", trigger);
      window.removeEventListener("pageshow", trigger);
      document.removeEventListener("visibilitychange", visible);
      unsubscribe?.();
    };
  }, [engine, localData.changes, syncNow]);

  useEffect(() => {
    if (!local || !link || running || pendingCount === 0) return;
    let timeoutId: number | undefined;
    let active = true;
    void local.nextRetryAt(link.linkKey).then((due) => {
      if (!active || !due) return;
      timeoutId = window.setTimeout(
        () => void syncNow(),
        Math.max(0, Date.parse(due) - Date.now()),
      );
    });
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [link, local, pendingCount, running, syncNow]);

  const status: SyncStatus = !link
    ? "disabled"
    : running
      ? "syncing"
      : !navigator.onLine
        ? "offline"
        : conflicts.length > 0
          ? "conflict"
          : error || errorCount > 0 || link.state === "paused"
            ? "error"
            : "idle";

  const value = useMemo<SyncRuntimeValue>(
    () => ({
      status,
      link,
      assessment,
      conflicts,
      pendingCount,
      conflictsCount: conflicts.length,
      errorCount,
      error,
      maintenance,
      beginMaintenance: async () => {
        maintenanceRef.current = true;
        setMaintenance(true);
        while (runningRef.current) {
          await new Promise((resolve) => window.setTimeout(resolve, 25));
        }
        return () => {
          maintenanceRef.current = false;
          setMaintenance(false);
        };
      },
      assessLink: async () => {
        if (!local || !gateway || !cloud.user || !cloud.identity)
          throw new Error("Iniciá sesión y conectá Supabase antes de vincular.");
        setError(null);
        try {
          const [project, song, preset] = await Promise.all([
            local.listLocal("project"),
            local.listLocal("song"),
            local.listLocal("preset"),
          ]);
          setAssessment(
            await gateway.assess({
              userId: cloud.user.id,
              cloudWorkspaceId: cloud.identity.workspace.id,
              local: { project, song, preset },
            }),
          );
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "No se pudo evaluar el vínculo.");
        }
      },
      confirmLink: async () => {
        if (!local || !gateway || !assessment) return;
        setError(null);
        try {
          const token = await gateway.assessmentToken(assessment.cloudWorkspaceId);
          if (token !== assessment.token) {
            setAssessment(null);
            throw new Error("Cloud cambió desde la evaluación. Volvé a evaluar antes de vincular.");
          }
          await local.confirmLink(assessment);
          setAssessment(null);
          await refresh();
          await syncNow();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "No se pudo confirmar el vínculo.");
        }
      },
      syncNow,
      retryErrors: async () => {
        if (local && link) {
          if (link.state === "paused") await local.resumeLink(link);
          await local.retryErrors(link.linkKey);
          await syncNow();
        }
      },
      unlink: async () => {
        if (local) {
          await local.archiveActiveLink();
          setAssessment(null);
          await refresh();
        }
      },
      resolve: async (conflict, resolution) => {
        if (!local) return;
        await local.resolveConflict(conflict, resolution);
        await refresh();
        await syncNow();
      },
    }),
    [
      assessment,
      cloud.identity,
      cloud.user,
      conflicts,
      error,
      errorCount,
      gateway,
      link,
      local,
      maintenance,
      pendingCount,
      refresh,
      status,
      syncNow,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncRuntimeValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync debe utilizarse dentro de SyncProvider.");
  return value;
}
