import { describe, expect, it } from "bun:test";

import type { PresentationItem } from "@/domain/presentation/presentation";
import { createPresentationStore } from "@/stores/presentation-store";

function item(id: string, slideCount: number): PresentationItem {
  return {
    id,
    type: "song",
    title: `Item ${id}`,
    order: 0,
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `${id}:s${index}`,
      itemId: id,
      order: index,
      content: { kind: "text" as const, lines: [`línea ${index}`] },
    })),
  };
}

describe("createPresentationStore", () => {
  it("arranca vacío", () => {
    const store = createPresentationStore();

    expect(store.getState().previewSlideId).toBeNull();
  });

  it("notifica a los suscriptores cuando el estado cambia", () => {
    const store = createPresentationStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.loadPresentation([item("a", 2)]);
    store.next();

    expect(notifications).toBe(2);
    expect(store.getState().previewSlideId).toBe("a:s1");
  });

  it("no notifica cuando un comando no cambia nada", () => {
    const store = createPresentationStore();
    store.loadPresentation([item("a", 1)]);

    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    const before = store.getState();
    store.next();
    store.selectSlide("inexistente");

    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
  });

  it("deja de notificar tras cancelar la suscripción", () => {
    const store = createPresentationStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    store.loadPresentation([item("a", 2)]);
    unsubscribe();
    store.next();

    expect(notifications).toBe(1);
  });

  it("expone los comandos de navegación", () => {
    const store = createPresentationStore();
    store.loadPresentation([item("a", 2), item("b", 1)]);

    store.goToLast();
    expect(store.getState().previewSlideId).toBe("b:s0");

    store.previous();
    expect(store.getState().previewSlideId).toBe("a:s1");

    store.selectItem("b");
    expect(store.getState().previewItemId).toBe("b");

    store.goToFirst();
    expect(store.getState().previewSlideId).toBe("a:s0");

    store.reset();
    expect(store.getState().previewItemId).toBeNull();
  });

  it("expone TAKE y los modos de salida sin perder el contenido de Program", () => {
    const store = createPresentationStore();
    store.loadPresentation([item("a", 2)]);

    store.take();
    expect(store.getState().programSlideId).toBe("a:s0");

    store.toggleProgramMode("black");
    expect(store.getState().programMode).toBe("black");
    expect(store.getState().programSlideId).toBe("a:s0");

    store.toggleProgramMode("black");
    expect(store.getState().programMode).toBe("content");

    store.loadPresentation([item("a", 2)]);
    expect(store.getState().programSlideId).toBeNull();
  });

  it("auto-avanza Program dentro del item al aire y se detiene al cruzar de item", () => {
    const store = createPresentationStore();
    store.loadPresentation([item("a", 2), item("b", 1)]);

    store.take();
    store.next();
    expect(store.getState().previewSlideId).toBe("a:s1");
    expect(store.getState().programSlideId).toBe("a:s1");

    store.next();
    expect(store.getState().previewSlideId).toBe("b:s0");
    expect(store.getState().programSlideId).toBe("a:s1");
  });
});
