import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder, RemindersData } from "../schema";

const store = {
  path: "reminders.json",
  read: vi.fn<() => Promise<RemindersData>>(),
  write: vi.fn(),
  mutate: vi.fn(),
};

vi.mock("../store", () => ({ remindersStore: store }));

const { addReminderTool, listRemindersTool, updateReminderTool } = await import(
  "@/modules/reminders/tools"
);

const ctx = { moduleId: "reminders", log: () => {}, emit: () => {} };

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "r1",
    title: "Appeler la salle",
    dueAt: "2026-11-20T10:00:00.000Z",
    status: "pending",
    createdAt: "2026-11-17T10:00:00.000Z",
    ...overrides,
  };
}

function data(reminders: Reminder[]): RemindersData {
  return { reminders };
}

describe("module reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declare ses trois outils avec leur effet", async () => {
    const { default: module } = await import("@/modules/reminders/module");
    expect(module.id).toBe("reminders");
    expect(module.tools?.map((tool) => tool.name)).toEqual(["add", "list", "update"]);
    expect(addReminderTool.sideEffect).toBe("write");
    expect(listRemindersTool.sideEffect).toBe("read");
    expect(updateReminderTool.sideEffect).toBe("write");
  });

  it("lit le fichier historique des rappels", async () => {
    const { remindersStore } = await import("@/modules/reminders/store");
    expect(remindersStore).toBeDefined();
  });

  describe("add", () => {
    it("ecrit puis relit avant d'annoncer le succes", async () => {
      const created: Reminder[] = [];
      store.mutate.mockImplementation(async (mutator: (value: RemindersData) => void) => {
        const value = data([]);
        mutator(value);
        created.push(...value.reminders);
        return value;
      });
      store.read.mockResolvedValue(data([]));

      const result = await addReminderTool.run(
        { title: "Relancer la prod", due_at: "2026-12-01T09:00:00.000Z" },
        ctx
      );

      expect(result.status).toBe("error");
      expect(result.text).toContain("ecriture non confirmee");
      expect(created).toHaveLength(1);
    });

    it("refuse une echeance invalide sans rien ecrire", async () => {
      const result = await addReminderTool.run(
        { title: "X", due_at: "pas une date" },
        ctx
      );
      expect(result.status).toBe("error");
      expect(result.text).toContain("date ISO 8601");
      expect(store.mutate).not.toHaveBeenCalled();
    });

    it("reussit quand la relecture confirme l'ecriture", async () => {
      store.mutate.mockImplementation(async (mutator: (value: RemindersData) => void) => {
        const value = data([]);
        mutator(value);
        return value;
      });
      store.read.mockImplementation(async () => {
        const value = data([]);
        // La relecture voit le rappel ecrit par le mutate precedent.
        store.mutate.mock.calls.at(-1)?.[0](value);
        return value;
      });

      const result = await addReminderTool.run(
        { title: "Relancer la prod", due_at: "2026-12-01T09:00:00.000Z" },
        ctx
      );
      expect(result.status).toBe("ok");
      expect(result.text).toContain("Rappel cree");
    });
  });

  describe("list", () => {
    it("rend les identifiants, sans quoi le modele ne peut pas modifier", async () => {
      store.read.mockResolvedValue(data([reminder()]));
      const result = await listRemindersTool.run({}, ctx);
      expect(result.status).toBe("ok");
      expect(result.text).toContain("[r1]");
      expect(result.text).toContain("Appeler la salle");
    });

    it("filtre par statut", async () => {
      store.read.mockResolvedValue(
        data([reminder(), reminder({ id: "r2", title: "Fait", status: "done" })])
      );
      const result = await listRemindersTool.run({ status: "done" }, ctx);
      expect(result.text).toContain("Fait");
      expect(result.text).not.toContain("Appeler la salle");
    });

    it("dit qu'il n'y a rien plutot que d'inventer", async () => {
      store.read.mockResolvedValue(data([]));
      const result = await listRemindersTool.run({}, ctx);
      expect(result.text).toContain("Aucun rappel");
    });
  });

  describe("update", () => {
    it("modifie le rappel et relit", async () => {
      store.mutate.mockImplementation(async (mutator: (value: RemindersData) => void) => {
        const value = data([reminder()]);
        mutator(value);
        return value;
      });
      store.read.mockResolvedValue(data([reminder({ status: "done" })]));

      const result = await updateReminderTool.run({ id: "r1", status: "done" }, ctx);
      expect(result.status).toBe("ok");
      expect(result.text).toContain("Rappel modifie");
    });

    it("signale un identifiant inconnu", async () => {
      store.mutate.mockResolvedValue(null);
      const result = await updateReminderTool.run({ id: "absent", title: "X" }, ctx);
      expect(result.status).toBe("error");
      expect(result.text).toContain("introuvable");
    });
  });
});
