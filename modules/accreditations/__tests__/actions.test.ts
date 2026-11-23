import { createTestContext, withTempDataDir } from "@backstage/module-kit/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as actions from "../actions";

const ctx = createTestContext({ moduleId: "accreditations" });

/** Valide puis exécute une action comme le fait `kernelAction`. */
async function runAction(name: keyof typeof actions, input: unknown): Promise<unknown> {
  const action = actions[name];
  const parsed = action.input.parse(input);
  const run = action.run as unknown as (value: unknown, context: unknown) => Promise<unknown>;
  return run(parsed, ctx);
}

describe("actions des accréditations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée une fiche et journalise l'activité", async () => {
    await withTempDataDir(async () => {
      const created = (await runAction("createAccreditationAction", {
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-12-05",
      })) as { id: string; status: string; artist: string };

      expect(created.artist).toBe("Muse");
      expect(created.status).toBe("pending");
      expect(ctx.activityEntries).toContainEqual(
        expect.objectContaining({ type: "accreditation_created" })
      );

      const loaded = (await runAction("loadAccreditationsAction", {})) as {
        accreditations: unknown[];
      };
      expect(loaded.accreditations).toHaveLength(1);
    });
  });

  it("change le statut d'une fiche", async () => {
    await withTempDataDir(async () => {
      const created = (await runAction("createAccreditationAction", {
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-12-05",
      })) as { id: string };

      const updated = (await runAction("updateAccreditationStatusAction", {
        id: created.id,
        status: "accepted",
      })) as { status: string };

      expect(updated.status).toBe("accepted");
    });
  });

  it("refuse un statut inconnu avant toute écriture", async () => {
    await withTempDataDir(async () => {
      const created = (await runAction("createAccreditationAction", {
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-12-05",
      })) as { id: string };

      expect(() =>
        actions.updateAccreditationStatusAction.input.parse({
          id: created.id,
          status: "peut-etre",
        })
      ).toThrow();
    });
  });

  it("modifie l'artiste, le lieu, la date et les notes", async () => {
    await withTempDataDir(async () => {
      const created = (await runAction("createAccreditationAction", {
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-12-05",
      })) as { id: string };

      const edited = (await runAction("editAccreditationAction", {
        id: created.id,
        artist: "Muse (UK)",
        venue: "Accor Arena",
        concertDate: "2026-12-06",
        notes: "Contact presse à relancer",
      })) as { artist: string; venue: string; concertDate: string; notes: string };

      expect(edited).toMatchObject({
        artist: "Muse (UK)",
        venue: "Accor Arena",
        concertDate: "2026-12-06",
        notes: "Contact presse à relancer",
      });
    });
  });

  it("supprime une fiche", async () => {
    await withTempDataDir(async () => {
      const created = (await runAction("createAccreditationAction", {
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-12-05",
      })) as { id: string };

      const deleted = await runAction("removeAccreditationAction", { id: created.id });
      expect(deleted).toBe(true);

      const loaded = (await runAction("loadAccreditationsAction", {})) as {
        accreditations: unknown[];
      };
      expect(loaded.accreditations).toEqual([]);
    });
  });
});
