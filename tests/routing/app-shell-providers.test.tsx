import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ProjectsProvider, useProjects } = await import("@/features/projects/projects-context");
const { SongsProvider, useSongs } = await import("@/features/songs/songs-context");

const PROJECTS_KEY = "broadcast-control.projects.v2";
const SONGS_KEY = "broadcast-control.songs.v1";

/** Contabiliza cuántas veces cada provider lee su almacén. */
function instrumentStorage() {
  const storage = window.localStorage;
  storage.clear();
  storage.setItem(
    PROJECTS_KEY,
    JSON.stringify({ version: 2, projects: [], activeProjectId: null }),
  );
  storage.setItem(SONGS_KEY, JSON.stringify({ version: 1, songs: [] }));

  const reads = { projects: 0, songs: 0 };
  const originalDescriptor = Object.getOwnPropertyDescriptor(storage, "getItem");
  const original = storage.getItem.bind(storage);
  Object.defineProperty(storage, "getItem", {
    configurable: true,
    writable: true,
    value(key: string) {
      if (key === PROJECTS_KEY) reads.projects += 1;
      if (key === SONGS_KEY) reads.songs += 1;
      return original(key);
    },
  });
  return {
    reads,
    restore: () => {
      if (originalDescriptor) Object.defineProperty(storage, "getItem", originalDescriptor);
      else storage.getItem = original;
    },
  };
}

/** Espera una condición observable sin asumir cuántos turnos necesita React. */
async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 2_000,
  describeState: () => string = () => "",
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out waiting for App Shell providers: ${describeState()}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

let songsMounts = 0;

function SongsProbe() {
  const { hasLoaded } = useSongs();
  const { hasLoaded: projectsLoaded } = useProjects();
  React.useEffect(() => {
    songsMounts += 1;
  }, []);
  return React.createElement(
    "span",
    { "data-testid": "probe" },
    `${String(projectsLoaded)}:${String(hasLoaded)}`,
  );
}

/** Réplica mínima del App Shell: providers estables por encima del contenido de ruta. */
function Shell({ route }: { route: string }) {
  return React.createElement(
    ProjectsProvider,
    null,
    React.createElement(
      SongsProvider,
      null,
      React.createElement(
        "main",
        null,
        React.createElement("p", null, route),
        React.createElement(SongsProbe, { key: "probe" }),
      ),
    ),
  );
}

describe("App Shell: providers estables entre rutas", () => {
  it("monta SongsProvider una sola vez y no relee al navegar", async () => {
    const { reads, restore } = instrumentStorage();
    songsMounts = 0;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(React.createElement(Shell, { route: "/projects" }));
      });
      await waitUntil(
        () =>
          reads.projects > 0 &&
          reads.songs > 0 &&
          container.textContent?.includes("true:true") === true,
        2_000,
        () =>
          JSON.stringify({
            projectReads: reads.projects,
            songReads: reads.songs,
            mounts: songsMounts,
            text: container.textContent,
          }),
      );

      // Una única carga inicial por provider (ProjectService lee lista + activo).
      const initialProjectReads = reads.projects;
      const initialSongReads = reads.songs;
      expect(initialProjectReads).toBeGreaterThan(0);
      expect(initialSongReads).toBe(1);
      expect(songsMounts).toBe(1);

      // Navegación simulada: solo cambia el contenido de la ruta.
      for (const route of ["/songs", "/live", "/projects"]) {
        await act(async () => {
          root.render(React.createElement(Shell, { route }));
        });
        await waitUntil(() => container.textContent?.includes(route) === true);
      }

      expect(container.textContent).toContain("/projects");
      expect(container.textContent).toContain("true:true");
      expect(songsMounts).toBe(1);
      expect(reads.songs).toBe(initialSongReads);
      expect(reads.projects).toBe(initialProjectReads);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      restore();
    }
  });
});
