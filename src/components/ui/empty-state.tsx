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
        "flex max-w-2xl items-start gap-4 rounded-md border border-border bg-card px-5 py-5 text-left sm:px-6 sm:py-6",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="grid size-10 shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground">
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      ) : null}
      <div className="min-w-0 pt-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
