import { assertToolOk, withTempDataDir } from "@backstage/module-kit/testing";
import type { GmailThread } from "@backstage/module-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Accreditation } from "../schema";

const mail = { listThreads: vi.fn(), getThread: vi.fn(), getMessage: vi.fn() };

const { scanAccreditationsTool } = await import("../tools");
const { accreditationsStore } = await import("../store");

const ai = {
  json: vi.fn(),
  complete: vi.fn(),
  log: () => {},
  emit: () => {},
};
const ctx = {
  moduleId: "accreditations",
  log: () => {},
  emit: () => {},
  ai,
  mail,
};

const THREAD: GmailThread = {
  id: "t-review",
  messages: [
    {
      id: "m-review",
      threadId: "t-review",
      from: "Presse Salle <presse@salle.fr>",
      to: "Rapstar <contact@rapstar.fr>",
      subject: "Demande d'accreditation",
      date: "Tue, 10 Nov 2026 12:00:00 +0000",
      snippet: "Demande pour un concert",
      body: "Demande pour un concert",
      unread: false,
      fromMe: false,
    },
  ],
};

/** Reponse de lot attendue par extractThreads pour le fil de test. */
function batch(input: Record<string, unknown>): string {
  return JSON.stringify({
    results: [
      {
        id: THREAD.id,
        artist: "",
        venue: "",
        concertDate: "",
        status: "pending",
        contactEmail: "",
        uncertainFields: [],
        ...input,
      },
    ],
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
    mail.listThreads.mockResolvedValue([THREAD]);
  });

  it("marque une creation incomplete sans changer son statut", async () => {
    ai.json.mockResolvedValue(batch({ artist: "Monsieur Nov" }));

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
      batch({
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
    ai.json.mockResolvedValue(batch({ artist: "Monsieur Nov", venue: "La Salle" }));

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
      batch({
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
      batch({
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
