import { afterEach, describe, expect, it, vi } from "vitest";

import { clearEventHandlers, emit, on } from "@/lib/kernel/events";

afterEach(() => {
  clearEventHandlers();
  vi.restoreAllMocks();
});

describe("bus d'evenements", () => {
  it("livre un evenement a ses abonnes", async () => {
    const handler = vi.fn();
    on("reminder.created", handler);
    emit("reminder.created", { id: "r1" });
    await Promise.resolve();
    expect(handler).toHaveBeenCalledWith({ id: "r1" });
  });

  it("ne livre pas a un abonne desabonne", () => {
    const handler = vi.fn();
    const off = on("reminder.created", handler);
    off();
    emit("reminder.created", { id: "r1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("un abonne en echec n'empeche pas les autres, et ne remonte pas", async () => {
    const broken = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    on("reminder.created", broken);
    on("reminder.created", healthy);

    expect(() => emit("reminder.created", {})).not.toThrow();
    await Promise.resolve();
    expect(healthy).toHaveBeenCalled();
  });

  it("un evenement sans abonne ne fait rien", () => {
    expect(() => emit("personne", {})).not.toThrow();
  });
});
