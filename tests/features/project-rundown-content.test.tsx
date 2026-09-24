import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MediaAsset } from "@/domain/media/media";
import { DEFAULT_PRESET } from "@/domain/presets/preset";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";
import { RundownList } from "@/features/projects/components/rundown-list";

const song: Song = {
  id: "song-1",
  workspaceId: "local-workspace",
  title: "Santo",
  author: "Autor",
  sections: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const media: MediaAsset[] = [
  {
    id: "image-1",
    workspaceId: "local-media",
    name: "Bienvenida",
    kind: "image",
    mimeType: "image/png",
    sizeBytes: 10,
    storage: "opfs",
    thumbnailDataUrl: "data:image/jpeg;base64,AA==",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "video-1",
    workspaceId: "local-media",
    name: "Cuenta regresiva",
    kind: "video",
    mimeType: "video/webm",
    sizeBytes: 20,
    storage: "opfs",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const items: RundownItem[] = [
  { id: "song-item", type: "song", sourceId: song.id, title: song.title, order: 0 },
  {
    id: "bible-item",
    type: "bible",
    sourceId: "nvi:JHN.3",
    title: "Juan 3:16",
    order: 1,
    payload: {
      kind: "bible",
      passage: {
        versionId: "nvi",
        versionAbbreviation: "NVI",
        bookUsfm: "JHN",
        bookName: "Juan",
        chapter: "3",
        reference: "Juan 3:16",
        verses: [{ number: "16", lines: ["Texto"] }],
      },
    },
  },
  { id: "image-item", type: "media", sourceId: "image-1", title: "Bienvenida", order: 2 },
  { id: "video-item", type: "media", sourceId: "video-1", title: "Cuenta regresiva", order: 3 },
];

describe("Project rundown con contenido mixto", () => {
  it("representa Song, Bible, imagen, video y thumbnail sin falsos faltantes", () => {
    const html = renderToStaticMarkup(
      <RundownList
        items={items}
        songs={[song]}
        media={media}
        presets={[DEFAULT_PRESET]}
        onMove={async () => undefined}
        onRemove={async () => undefined}
        onSetPreset={async () => undefined}
      />,
    );

    expect(html).toContain("Santo");
    expect(html).toContain("Juan 3:16");
    expect(html).toContain("Bienvenida");
    expect(html).toContain("Cuenta regresiva");
    expect(html).toContain("data:image/jpeg;base64,AA==");
    expect(html).not.toContain("Contenido faltante");
  });
});
