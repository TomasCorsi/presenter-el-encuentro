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

    expect(store.getState().currentSlideId).toBeNull();
  });

  it("notifica a los suscriptores cuando el estado cambia", () => {
    const store = createPresentationStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.load([item("a", 2)]);
    store.next();

    expect(notifications).toBe(2);
    expect(store.getState().currentSlideId).toBe("a:s1");
  });

  it("no notifica cuando un comando no cambia nada", () => {
    const store = createPresentationStore();
    store.load([item("a", 1)]);

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

    store.load([item("a", 2)]);
    unsubscribe();
    store.next();

    expect(notifications).toBe(1);
  });

  it("expone los comandos de navegación", () => {
    const store = createPresentationStore();
    store.load([item("a", 2), item("b", 1)]);

    store.goToLast();
    expect(store.getState().currentSlideId).toBe("b:s0");

    store.previous();
    expect(store.getState().currentSlideId).toBe("a:s1");

    store.selectItem("b");
    expect(store.getState().currentItemId).toBe("b");

    store.goToFirst();
    expect(store.getState().currentSlideId).toBe("a:s0");

    store.reset();
    expect(store.getState().currentItemId).toBeNull();
  });
});
