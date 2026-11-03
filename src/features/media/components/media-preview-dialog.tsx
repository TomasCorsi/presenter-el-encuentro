import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaAsset } from "@/domain/media/media";
import { MediaPreviewPlayer } from "@/features/media/components/media-preview-player";

export interface MediaPreviewDialogProps {
  asset: MediaAsset | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

/** Preview local: nunca consulta ni modifica el Presentation Store. */
export function MediaPreviewDialog({ asset, open, onOpenChange }: MediaPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{asset?.name ?? "Preview"}</DialogTitle>
          <DialogDescription>
            Vista previa local independiente de Preview y Program.
          </DialogDescription>
        </DialogHeader>

        <MediaPreviewPlayer asset={asset} active={open} />
      </DialogContent>
    </Dialog>
  );
}
