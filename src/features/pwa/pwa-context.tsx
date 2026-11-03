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

declare const __APP_VERSION__: string;

const APP_VERSION = typeof __APP_VERSION__ === "undefined" ? "Fase 12" : __APP_VERSION__;

export type PwaInstallState = "unavailable" | "available" | "installed";
export type PwaUpdateState = "current" | "available" | "blocked" | "applying" | "error";
export type PwaNetworkState = "online" | "offline";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaRuntimeValue {
  install: PwaInstallState;
  update: PwaUpdateState;
  network: PwaNetworkState;
  version: string;
  blockedPaths: string[];
  installApplication(): Promise<void>;
  applyUpdate(): Promise<void>;
}

const PwaContext = createContext<PwaRuntimeValue | null>(null);

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function sendUpdateRequest(
  worker: ServiceWorker,
  type: "CHECK_UPDATE_SAFETY" | "SKIP_WAITING",
): Promise<{ safe: boolean; blocked: string[] }> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error("El worker no respondió.")), 3_000);
    channel.port1.onmessage = (event: MessageEvent<{ safe: boolean; blocked: string[] }>) => {
      window.clearTimeout(timeout);
      resolve(event.data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [install, setInstall] = useState<PwaInstallState>("unavailable");
  const [update, setUpdate] = useState<PwaUpdateState>("current");
  const [network, setNetwork] = useState<PwaNetworkState>("online");
  const [blockedPaths, setBlockedPaths] = useState<string[]>([]);
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    setNetwork(navigator.onLine ? "online" : "offline");
    if (standalone()) setInstall("installed");

    const onOnline = () => setNetwork("online");
    const onOffline = () => setNetwork("offline");
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as BeforeInstallPromptEvent;
      setInstall("available");
    };
    const onInstalled = () => {
      installPrompt.current = null;
      setInstall("installed");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((next) => {
        registration.current = next;
        if (next.waiting) {
          waitingWorker.current = next.waiting;
          setUpdate("available");
        }
        next.addEventListener("updatefound", () => {
          const installing = next.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker.current = next.waiting ?? installing;
              setUpdate("available");
            }
          });
        });
        void next.update().catch(() => undefined);
      }).catch(() => setUpdate("error"));
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installApplication = useCallback(async () => {
    const prompt = installPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstall("installed");
    installPrompt.current = null;
    if (choice.outcome !== "accepted") setInstall("unavailable");
  }, []);

  const applyUpdate = useCallback(async () => {
    const worker = waitingWorker.current ?? registration.current?.waiting;
    if (!worker) return;
    setBlockedPaths([]);
    const onControllerChange = () => window.location.reload();
    try {
      setUpdate("applying");
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
      const safety = await sendUpdateRequest(worker, "SKIP_WAITING");
      if (!safety.safe) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        setBlockedPaths(safety.blocked);
        setUpdate("blocked");
        return;
      }
    } catch {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      setUpdate("error");
    }
  }, []);

  const value = useMemo<PwaRuntimeValue>(() => ({
    install, update, network, version: APP_VERSION, blockedPaths,
    installApplication, applyUpdate,
  }), [applyUpdate, blockedPaths, install, installApplication, network, update]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaRuntimeValue {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa debe utilizarse dentro de PwaProvider.");
  return value;
}
