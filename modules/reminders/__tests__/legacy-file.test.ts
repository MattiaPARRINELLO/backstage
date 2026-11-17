import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Le moteur resout `data/` a partir de `process.cwd()` a son import : le
// changement de repertoire doit donc precede l'import du store. Ce fichier est
// isole du reste de la suite par Vitest.
const root = mkdtempSync(path.join(tmpdir(), "backstage-reminders-"));
const previousCwd = process.cwd();

beforeAll(() => {
  process.chdir(root);
  mkdirSync(path.join(root, "data"), { recursive: true });
  writeFileSync(
    path.join(root, "data", "reminders.json"),
    JSON.stringify({
      reminders: [
        {
          id: "legacy-1",
          title: "Rappel historique",
          dueAt: "2026-11-20T10:00:00.000Z",
          status: "pending",
          createdAt: "2026-11-17T10:00:00.000Z",
        },
      ],
    })
  );
});

afterAll(() => {
  process.chdir(previousCwd);
  rmSync(root, { recursive: true, force: true });
});

describe("store des rappels sur le fichier historique", () => {
  it("lit data/reminders.json sans le deplacer", async () => {
    const { remindersStore } = await import("@/modules/reminders/store");
    expect(remindersStore.path).toBe("reminders.json");

    const data = await remindersStore.read();
    expect(data.reminders).toHaveLength(1);
    expect(data.reminders[0]?.title).toBe("Rappel historique");
    expect(existsSync(path.join(root, "data", "reminders", "reminders.json"))).toBe(false);
  });

  it("ecrit dans le meme fichier, sans creer de dossier de module", async () => {
    const { remindersStore } = await import("@/modules/reminders/store");

    await remindersStore.mutate((data) => {
      data.reminders.push({
        id: "legacy-2",
        title: "Ajoute par le module",
        dueAt: "2026-11-21T10:00:00.000Z",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    });

    const onDisk = JSON.parse(
      readFileSync(path.join(root, "data", "reminders.json"), "utf-8")
    ) as { reminders: { id: string }[] };
    expect(onDisk.reminders.map((r) => r.id)).toEqual(["legacy-1", "legacy-2"]);
    expect(existsSync(path.join(root, "data", "reminders"))).toBe(false);
  });
});
