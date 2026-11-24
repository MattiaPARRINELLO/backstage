import { assertToolOk, withTempDataDir } from "@backstage/module-kit/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Accreditation } from "../schema";

const google = { fetchGmailMessages: vi.fn() };
vi.mock("@/lib/google-actions", () => google);

const { scanAccreditationsTool } = await import("../tools");
const { accreditationsStore } = await import("../store");

const ai = {
  json: vi.fn(),
  complete: vi.fn(),
  log: () => {},
  emit: () => {},
};
const ctx = { moduleId: "accreditations", log: () => {}, emit: () => {}, ai };

function extraction(input: Record<string, unknown>): string {
  return JSON.stringify({
    artist: "",
    venue: "",
    concertDate: "",
    status: "pending",
    contactEmail: "",
    uncertainFields: [],
    ...input,
  });
}

function fiche(partial: Partial<Accreditation> & { id: string }): Accreditation {
  return {
    artist: "Monsieur Nov",
    venue: "Inconnu",
    concertDate: "Date inconnue",
    status: "pending",
    needsReview: false,
    createdAt: "2026-11-12T09:00:00.000Z",
    updatedAt: "2026-11-12T09:00:00.000Z",
    ...partial,
  };
}

describe("revue humaine des extractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    google.fetchGmailMessages.mockResolvedValue([
      {
        id: "m-review",
        from: "Presse Salle <presse@salle.fr>",
        subject: "Demande d'accreditation",
        snippet: "Demande pour un concert",
      },
    ]);
  });

  it("marque une creation incomplete sans changer son statut", async () => {
    ai.json.mockResolvedValue(extraction({ artist: "Monsieur Nov" }));

    await withTempDataDir(async () => {
      const result = await scanAccreditationsTool.run({}, ctx);

      assertToolOk(result);
      const data = await accreditationsStore.read();
      expect(data.accreditations[0]).toMatchObject({
        artist: "Monsieur Nov",
        venue: "Inconnu",
        concertDate: "Date inconnue",
        status: "pending",
        needsReview: true,
      });
    });
  });

  it("marque un libelle artiste declare douteux meme si les champs sont complets", async () => {
    ai.json.mockResolvedValue(
      extraction({
        artist: "Musee Imaginaire d'Oli",
        venue: "Grand Palais",
        concertDate: "2026-12-02",
        status: "accepted",
        uncertainFields: ["artist"],
      })
    );

    await withTempDataDir(async () => {
      const result = await scanAccreditationsTool.run({}, ctx);

      assertToolOk(result);
      const data = await accreditationsStore.read();
      expect(data.accreditations[0]).toMatchObject({
        artist: "Musee Imaginaire d'Oli",
        status: "accepted",
        needsReview: true,
      });
    });
  });

  it("marque une fiche fiable quand la nouvelle extraction est incertaine", async () => {
    ai.json.mockResolvedValue(extraction({ artist: "Monsieur Nov", venue: "La Salle" }));

    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(
          fiche({ id: "a1", venue: "La Salle", concertDate: "2026-12-05" })
        );
      });

      const result = await scanAccreditationsTool.run({}, ctx);

      assertToolOk(result);
      const data = await accreditationsStore.read();
      expect(data.accreditations[0]).toMatchObject({ status: "pending", needsReview: true });
    });
  });

  it("conserve une fiche deja marquee et signale une extraction incertaine ignoree", async () => {
    ai.json.mockResolvedValue(
      extraction({
        artist: "Monsieur Nov",
        venue: "Nouvelle Salle",
        status: "accepted",
        uncertainFields: ["venue", "concertDate"],
      })
    );

    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(
          fiche({ id: "a1", status: "refused", needsReview: true })
        );
      });

      const result = await scanAccreditationsTool.run({}, ctx);

      assertToolOk(result);
      expect(result.text).toContain("1 non remplacee(s) car a verifier");
      const data = await accreditationsStore.read();
      expect(data.accreditations).toEqual([
        fiche({ id: "a1", status: "refused", needsReview: true }),
      ]);
    });
  });

  it("complete et leve la marque quand la nouvelle extraction est sure", async () => {
    ai.json.mockResolvedValue(
      extraction({
        artist: "Monsieur Nov",
        venue: "La Salle",
        concertDate: "2026-12-05",
        status: "sent",
      })
    );

    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(fiche({ id: "a1", needsReview: true }));
      });

      const result = await scanAccreditationsTool.run({}, ctx);

      assertToolOk(result);
      const data = await accreditationsStore.read();
      expect(data.accreditations[0]).toMatchObject({
        venue: "La Salle",
        concertDate: "2026-12-05",
        status: "sent",
        needsReview: false,
      });
    });
  });
});
