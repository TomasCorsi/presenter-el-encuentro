import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageWidth = "contained" | "full";

export interface PageProps extends ComponentProps<"div"> {
  /**
   * `contained`: ancho limitado para lectura y formularios.
   * `full`: aprovecha todo el viewport para interfaces de producción.
   */
  width?: PageWidth;
}

/**
 * Contenedor de página. El ancho lo decide cada pantalla, no el App Shell.
 */
export function Page({ width = "full", className, children, ...props }: PageProps) {
  return (
    <div
      className={cn(
        "w-full px-4 py-6 sm:px-6",
        width === "contained" && "mx-auto max-w-3xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps extends ComponentProps<"div"> {
  title: string;
  description?: string;
  /** Acciones alineadas a la derecha. */
  actions?: ReactNode;
  /** Etiqueta breve encima del título. */
  eyebrow?: string;
}

/** Cabecera estándar de página. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
