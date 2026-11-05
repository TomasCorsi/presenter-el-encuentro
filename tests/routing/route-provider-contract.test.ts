import { describe, expect, it } from "bun:test";

/**
 * Contrato arquitectónico (ADR-031): los providers de datos viven en el App
 * Shell. Ninguna ruta hija puede volver a montarlos, porque eso reintroduce el
 * remontaje y la relectura de almacenamiento en cada navegación.
 */
const SHELL = "src/routes/_app.tsx";
const CHILD_ROUTES = [
  "src/routes/_app.projects.tsx",
  "src/routes/_app.songs.tsx",
  "src/routes/_app.live.tsx",
];

async function read(path: string): Promise<string> {
  return await Bun.file(path).text();
}

describe("contrato de providers en rutas", () => {
  it("el App Shell monta el bootstrap único e inyecta sus repositorios", async () => {
    const shell = await read(SHELL);
    expect(shell).toContain("<LocalDataProvider>");
    expect(shell).toContain("<SyncProvider>");
    expect(shell).toContain(
      "<ProjectsProvider repository={repositories.projects} changes={changes}>",
    );
    expect(shell).toContain("<SongsProvider repository={repositories.songs} changes={changes}>");
    expect(shell).toContain(
      "<PresetsProvider repository={repositories.presets} changes={changes}>",
    );
    expect(shell).toContain("<MediaProvider projectRepository={repositories.projects}>");
  });

  it("ninguna ruta hija vuelve a montar los providers de datos", async () => {
    for (const path of CHILD_ROUTES) {
      const source = await read(path);
      expect(source).not.toContain("<SongsProvider>");
      expect(source).not.toContain("<ProjectsProvider>");
    }
  });

  it("la navegación del sidebar usa Link del router, no anclas", async () => {
    const sidebar = await read("src/components/layout/app-sidebar.tsx");
    expect(sidebar).toContain("<Link to={item.to}>");
    expect(sidebar).not.toContain("<a href");
  });
});
