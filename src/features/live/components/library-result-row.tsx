import { ListPlus, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface LibraryResultRowProps {
  title: string;
  subtitle?: string | undefined;
  /** Sin proyecto activo las altas quedan deshabilitadas. */
  disabled: boolean;
  busy: boolean;
  onAdd(): void;
  onGoLive(): void;
}

/**
 * Fila de resultado de la biblioteca operativa: las dos acciones posibles son
 * siempre explícitas y nunca se disparan por seleccionar el resultado.
 */
export function LibraryResultRow({
  title,
  subtitle,
  disabled,
  busy,
  onAdd,
  onGoLive,
}: LibraryResultRowProps) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{title}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={onAdd}
        title="Agregar al final del rundown y guardarlo en el proyecto"
      >
        <ListPlus />
        <span className="hidden sm:inline">Rundown</span>
      </Button>
      <Button
        size="sm"
        disabled={disabled || busy}
        onClick={onGoLive}
        title="Agregar al rundown y enviarlo al aire ahora"
      >
        <Radio />
        <span className="hidden sm:inline">Al aire</span>
      </Button>
    </li>
  );
}
