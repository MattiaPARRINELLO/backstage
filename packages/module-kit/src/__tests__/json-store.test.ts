import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const storage = {
  readOrCreate: vi.fn(),
  writeJsonAtomic: vi.fn(),
  mutateJson: vi.fn(),
};

vi.mock("../storage-core", () => storage);

const { jsonStore, resolveStorePath } = await import(
  "@backstage/module-kit/json-store"
);
const { verifyWrite } = await import("@backstage/module-kit");

const schema = z.object({
  reminders: z.array(z.object({ id: z.string(), title: z.string() })),
});
const fallback = { reminders: [] };

function makeStore(overrides: Record<string, unknown> = {}) {
  return jsonStore({
    moduleId: "reminders",
    file: "reminders.json",
    schema,
    fallback,
    log: () => {},
    ...overrides,
  });
}

describe("resolveStorePath", () => {
  it("namespace le fichier sous le module", () => {
    expect(resolveStorePath("reminders", "reminders.json")).toBe(
      "reminders/reminders.json"
    );
  });

  it("respecte un chemin historique", () => {
    expect(resolveStorePath("reminders", "reminders.json", "reminders.json")).toBe(
      "reminders.json"
    );
  });

  it("accepte un chemin prefixe par data/", () => {
    expect(resolveStorePath("reminders", "reminders.json", "data/reminders.json")).toBe(
      "reminders.json"
    );
  });

  it("refuse de sortir du repertoire de donnees", () => {
    expect(() => resolveStorePath("reminders", "../secrets.json")).toThrow(/interdit/);
    expect(() => resolveStorePath("reminders", "/etc/passwd.json")).toThrow(/interdit/);
  });

  it("refuse un fichier qui n'est pas du JSON", () => {
    expect(() => resolveStorePath("reminders", "reminders.txt")).toThrow(/\.json/);
  });
});

describe("jsonStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose le chemin resolu", () => {
    expect(makeStore().path).toBe("reminders/reminders.json");
    expect(makeStore({ legacyPath: "reminders.json" }).path).toBe("reminders.json");
  });

  it("rend les donnees validees en lecture", async () => {
    storage.readOrCreate.mockResolvedValue({
      reminders: [{ id: "1", title: "Appeler" }],
    });
    const data = await makeStore().read();
    expect(data.reminders).toHaveLength(1);
    expect(storage.readOrCreate).toHaveBeenCalledWith(
      "reminders/reminders.json",
      fallback
    );
  });

  it("rend le defaut quand les donnees sont invalides, sans reecrire", async () => {
    storage.readOrCreate.mockResolvedValue({ reminders: "pas un tableau" });
    const data = await makeStore().read();
    expect(data).toEqual({ reminders: [] });
    expect(storage.writeJsonAtomic).not.toHaveBeenCalled();
  });

  it("refuse d'ecrire des donnees hors schema", async () => {
    await expect(
      makeStore().write({ reminders: [{ id: 3, title: "x" }] } as never)
    ).rejects.toThrow(/Donnees invalides/);
    expect(storage.writeJsonAtomic).not.toHaveBeenCalled();
  });

  it("ecrit des donnees validees", async () => {
    const store = makeStore();
    await store.write({ reminders: [{ id: "1", title: "Appeler" }] });
    expect(storage.writeJsonAtomic).toHaveBeenCalledWith("reminders/reminders.json", {
      reminders: [{ id: "1", title: "Appeler" }],
    });
  });

  it("mute par copie : le mutateur ne touche pas l'objet lu", async () => {
    const current = { reminders: [{ id: "1", title: "Appeler" }] };
    storage.mutateJson.mockImplementation(async (_path, _fallback, mutator) =>
      mutator(current)
    );
    const store = makeStore();
    await store.mutate((draft) => {
      draft.reminders.push({ id: "2", title: "Relancer" });
    });
    expect(current.reminders).toHaveLength(1);
  });

  it("n'ecrit rien quand le mutateur retourne null", async () => {
    storage.mutateJson.mockResolvedValue(null);
    const result = await makeStore().mutate(() => null);
    expect(result).toBeNull();
  });

  it("refuse une mutation qui produit des donnees hors schema", async () => {
    storage.mutateJson.mockImplementation(async (_path, _fallback, mutator) =>
      mutator({ reminders: [] })
    );
    const store = makeStore();
    await expect(
      store.mutate((draft) => {
        // Champ obligatoire retire : le noyau doit refuser, pas ecrire.
        draft.reminders.push({ id: "1" } as never);
      })
    ).rejects.toThrow(/Mutation refusee/);
  });

  it("laisse le mutateur rendre un nouvel objet", async () => {
    storage.mutateJson.mockImplementation(async (_path, _fallback, mutator) =>
      mutator({ reminders: [] })
    );
    const store = makeStore();
    const result = await store.mutate(() => ({ reminders: [{ id: "9", title: "Neuf" }] }));
    expect(result).toEqual({ reminders: [{ id: "9", title: "Neuf" }] });
  });
});

describe("verifyWrite", () => {
  it("ne signale rien quand la relecture trouve l'ecriture", async () => {
    await expect(verifyWrite("le rappel", async () => true)).resolves.toBeNull();
  });

  it("signale une ecriture introuvable", async () => {
    const message = await verifyWrite("le rappel", async () => false);
    expect(message).toContain("ecriture non confirmee");
    expect(message).toContain("le rappel");
  });

  it("signale une relecture impossible", async () => {
    const message = await verifyWrite("le rappel", async () => {
      throw new Error("disque absent");
    });
    expect(message).toContain("verification impossible");
    expect(message).toContain("disque absent");
  });
});
