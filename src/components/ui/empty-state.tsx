import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends ComponentProps<"div"> {
  /** Icono representativo de la sección. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Acciones opcionales (botones). */
  actions?: ReactNode;
}

/**
 * Estado vacío reutilizable: sección sin contenido todavía.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center rounded-lg",
        "border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-4 grid size-11 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
