import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { withTempDataDir } from "@backstage/module-kit/testing";
import { describe, expect, it } from "vitest";

import { accreditationsStore } from "../store";

/**
 * Fichier historique : une fiche réelle, plus un champ inconnu du schéma. La
 * lecture doit rendre la fiche intacte et l'écriture suivante doit conserver ce
 * champ, sans réécrire le fichier à la première lecture.
 */
const historique = {
  accreditations: [
    {
      id: "acc-damso",
      artist: "Damso",
      venue: "Paris La Défense Arena",
      concertDate: "2026-12-05",
      status: "accepted",
      contactEmail: "presse@example.com",
      notes: "Email: m1",
      createdAt: "2026-11-12T09:00:00.000Z",
      updatedAt: "2026-11-13T09:00:00.000Z",
      champInconnu: "conserve",
    },
  ],
};

describe("store des accréditations", () => {
  it("lit le fichier historique sans perte", async () => {
    await withTempDataDir(async (dir) => {
      await writeFile(
        path.join(dir, "accreditations.json"),
        JSON.stringify(historique)
      );

      const data = await accreditationsStore.read();

      expect(data.accreditations).toHaveLength(1);
      expect(data.accreditations[0]).toMatchObject({
        id: "acc-damso",
        artist: "Damso",
        venue: "Paris La Défense Arena",
        status: "accepted",
        needsReview: false,
        createdAt: "2026-11-12T09:00:00.000Z",
      });
    });
  });

  it("conserve les champs inconnus après une écriture", async () => {
    await withTempDataDir(async (dir) => {
      const file = path.join(dir, "accreditations.json");
      await writeFile(file, JSON.stringify(historique));

      await accreditationsStore.mutate((data) => {
        const entry = data.accreditations[0];
        if (entry) entry.notes = "Relance programmée";
      });

      const raw = JSON.parse(await readFile(file, "utf-8")) as typeof historique;
      expect(raw.accreditations[0]?.champInconnu).toBe("conserve");
      expect(raw.accreditations[0]?.notes).toBe("Relance programmée");
    });
  });

  it("rend une liste vide quand le fichier n'existe pas", async () => {
    await withTempDataDir(async () => {
      const data = await accreditationsStore.read();
      expect(data.accreditations).toEqual([]);
    });
  });
});
