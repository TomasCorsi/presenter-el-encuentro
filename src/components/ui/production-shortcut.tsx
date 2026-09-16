import { Link } from "@tanstack/react-router";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import type { AppRoute } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export interface ProductionShortcutProps {
  readonly title: string;
  readonly description: string;
  readonly to: AppRoute;
  readonly icon: LucideIcon;
  readonly variant?: "primary" | "secondary" | "tertiary";
  readonly className?: string;
}

/** Acceso visual sin estado ni lógica de producto para el centro de producción. */
export function ProductionShortcut({
  title,
  description,
  to,
  icon: Icon,
  variant = "secondary",
  className,
}: ProductionShortcutProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex min-w-0 items-center border border-border bg-card text-left transition-colors",
        "hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "primary" && "min-h-28 rounded-md p-5 sm:min-h-32 sm:p-6",
        variant === "secondary" && "min-h-18 rounded-md p-3.5",
        variant === "tertiary" && "min-h-12 rounded-md bg-transparent px-3 py-2.5",
        className,
      )}
    >
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground transition-colors group-hover:text-primary",
          variant === "primary" ? "size-11" : "size-9",
        )}
      >
        <Icon className={variant === "primary" ? "size-5" : "size-4"} aria-hidden="true" />
      </div>
      <div className={cn("min-w-0", variant === "primary" ? "ml-4" : "ml-3")}>
        <p
          className={cn(
            "truncate font-semibold text-foreground",
            variant === "primary" ? "text-base sm:text-lg" : "text-sm",
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowUpRight
        className="ml-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}