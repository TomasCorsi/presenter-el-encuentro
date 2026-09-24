import type { PresentationItem, PresentationState } from "@/domain/presentation/presentation";
import { getPreviewItem, getProgramItem } from "@/domain/presentation/presentation-selectors";

function eligible(item: PresentationItem | null): item is PresentationItem {
  return item?.type === "song" || item?.type === "bible";
}

/** Preview elegible tiene prioridad; Program es el fallback operativo. */
export function getQuickBackgroundTarget(state: PresentationState): PresentationItem | null {
  const preview = getPreviewItem(state);
  if (eligible(preview)) return preview;
  const program = getProgramItem(state);
  return eligible(program) ? program : null;
}
