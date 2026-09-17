import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { ProjectsProvider, useProjects } = await import("@/features/projects/projects-context");
const { SongsProvider, useSongs } = await import("@/features/songs/songs-context");

const PROJECTS_KEY = "broadcast-control.projects.v2";
const SONGS_KEY = "broadcast-control.songs.v1";

/** Contabiliza cuántas veces cada provider lee su almacén. */
function instrumentStorage() {
  window.localStorage.clear();
  window.localStorage.setItem(
    PROJECTS_KEY,
    JSON.stringify({ version: 2, projects: [], activeProjectId: null }),
  );
  window.localStorage.setItem(SONGS_KEY, JSON.stringify({ version: 1, songs: [] }));

  const reads = { projects: 0, songs: 0 };
  const proto = Object.getPrototypeOf(window.localStorage) as Storage;
  const original = proto.getItem;
  proto.getItem = function patched(this: Storage, key: string) {
    if (key === PROJECTS_KEY) reads.projects += 1;
    if (key === SONGS_KEY) reads.songs += 1;
    return original.call(this, key);
  };
  return { reads, restore: () => { proto.getItem = original; } };
}

/** Deja correr efectos y promesas pendientes del provider. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
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

    root.render(React.createElement(Shell, { route: "/projects" }));
    await flush();

    // Una única carga inicial por provider (ProjectService lee lista + activo).
    const initialProjectReads = reads.projects;
    const initialSongReads = reads.songs;
    expect(initialProjectReads).toBeGreaterThan(0);
    expect(initialSongReads).toBe(1);
    expect(songsMounts).toBe(1);

    // Navegación simulada: solo cambia el contenido de la ruta.
    for (const route of ["/songs", "/live", "/projects"]) {
      root.render(React.createElement(Shell, { route }));
      await flush();
    }

    expect(container.textContent).toContain("/projects");
    expect(container.textContent).toContain("true:true");
    expect(songsMounts).toBe(1);
    expect(reads.songs).toBe(initialSongReads);
    expect(reads.projects).toBe(initialProjectReads);

    root.unmount();
    await flush();
    container.remove();
    restore();
  });
});
