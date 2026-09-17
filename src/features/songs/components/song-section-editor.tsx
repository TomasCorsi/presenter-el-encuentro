import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";

import type { SongSection, SongSectionType } from "@/domain/songs/song";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const SECTION_TYPE_OPTIONS: Array<{ value: SongSectionType; label: string }> = [
  { value: "verse", label: "Verso" },
  { value: "chorus", label: "Coro" },
  { value: "prechorus", label: "Pre-coro" },
  { value: "bridge", label: "Puente" },
  { value: "intro", label: "Intro" },
  { value: "outro", label: "Outro" },
  { value: "custom", label: "Personalizada" },
];

export interface SongSectionEditorProps {
  section: SongSection;
  isFirst: boolean;
  isLast: boolean;
  onChange(input: { type?: SongSectionType; label?: string; content?: string }): void;
  onBlurFlush(): void;
  onMove(direction: "up" | "down"): void;
  onRemove(): void;
}

export function SongSectionEditor({ section, isFirst, isLast, onChange, onBlurFlush, onMove, onRemove }: SongSectionEditorProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const baseId = `section-${section.id}`;

  return (
    <section aria-label={`Sección ${section.label}`} className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Select value={section.type} onValueChange={(value) => onChange({ type: value as SongSectionType })}>
          <SelectTrigger className="h-8 w-36" aria-label="Tipo de sección">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor={`${baseId}-label`} className="sr-only">Nombre de la sección</Label>
        <Input
          id={`${baseId}-label`}
          value={section.label}
          onChange={(event) => onChange({ label: event.target.value })}
          onBlur={onBlurFlush}
          maxLength={60}
          className="h-8 w-40"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" disabled={isFirst}
            aria-label={`Subir ${section.label}`} onClick={() => onMove("up")}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={isLast}
            aria-label={`Bajar ${section.label}`} onClick={() => onMove("down")}>
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
            aria-label={`Eliminar ${section.label}`} onClick={() => setRemoveOpen(true)}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <Label htmlFor={`${baseId}-content`} className="sr-only">Contenido de {section.label}</Label>
        <Textarea
          id={`${baseId}-content`}
          value={section.content}
          onChange={(event) => onChange({ content: event.target.value })}
          onBlur={onBlurFlush}
          placeholder="Letra de la sección…"
          rows={4}
          className="min-h-24 resize-y font-mono text-sm leading-6"
        />
      </div>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar sección</AlertDialogTitle>
            <AlertDialogDescription>
              “{section.label}” se eliminará de la canción. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setRemoveOpen(false); onRemove(); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
