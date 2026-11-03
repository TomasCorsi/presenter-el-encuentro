import { describe, expect, it } from "bun:test";

describe("Stage route contract", () => {
  it("es observador: consume Output y no importa comandos de Presentation", async () => {
    const source = await Bun.file("src/routes/output.stage.tsx").text();
    expect(source).toContain("useStageOutputState");
    expect(source).not.toContain("usePresentationStore");
    expect(source).not.toContain("take(");
    expect(source).not.toContain("goLive(");
    expect(source).not.toContain("setProgramMode");
    expect(source).not.toContain("BroadcastChannel");
  });
});
