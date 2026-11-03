import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  bootstrapLocalData,
  type LocalDataBootstrapResult,
} from "@/services/local-data/local-data-bootstrap";

type LocalDataContextValue = LocalDataBootstrapResult;

const LocalDataContext = createContext<LocalDataContextValue | null>(null);

export interface LocalDataProviderProps {
  children: ReactNode;
  bootstrap?: typeof bootstrapLocalData;
  factory?: IDBFactory;
  storage?: Storage;
}

export function LocalDataProvider({
  children,
  bootstrap = bootstrapLocalData,
  factory,
  storage,
}: LocalDataProviderProps) {
  const [result, setResult] = useState<LocalDataBootstrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolvedFactory = factory ?? (typeof indexedDB === "undefined" ? null : indexedDB);
    const resolvedStorage = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    if (!resolvedFactory || !resolvedStorage) {
      setError("El almacenamiento local no está disponible en este navegador.");
      return;
    }
    let active = true;
    void bootstrap({ factory: resolvedFactory, storage: resolvedStorage })
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo iniciar el almacenamiento local.");
      });
    return () => { active = false; };
  }, [bootstrap, factory, storage]);

  const value = useMemo(() => result, [result]);
  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
        {error ?? "Preparando almacenamiento local…"}
      </div>
    );
  }
  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData(): LocalDataContextValue {
  const value = useContext(LocalDataContext);
  if (!value) throw new Error("useLocalData debe utilizarse dentro de LocalDataProvider.");
  return value;
}
