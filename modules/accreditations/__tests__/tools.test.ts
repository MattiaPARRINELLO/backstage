import { assertToolError, assertToolOk } from "@backstage/module-kit/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Accreditation } from "../schema";

const google = { fetchGmailMessages: vi.fn() };
const service = {
  getAccreditations: vi.fn(),
  addAccreditation: vi.fn(),
  updateAccreditation: vi.fn(),
};

vi.mock("@/lib/google-actions", () => google);
vi.mock("../service", () => service);

const { scanAccreditationsTool } = await import("../tools");

const ai = {
  json: vi.fn(),
  complete: vi.fn(),
  log: () => {},
  emit: () => {},
};
const ctx = { moduleId: "accreditations", log: () => {}, emit: () => {}, ai };

function email(id: string, subject: string, snippet: string) {
  return { id, from: "Presse Salle <presse@salle.fr>", subject, snippet };
}

function extraction(input: Partial<Record<string, string>>) {
  return JSON.stringify({
    artist: "",
    venue: "",
    concertDate: "",
    status: "pending",
    contactEmail: "",
    ...input,
  });
}

function fiche(input: {
  id: string;
  artist: string;
  venue: string;
  status: Accreditation["status"];
}): Accreditation {
  return {
    id: input.id,
    artist: input.artist,
    venue: input.venue,
    concertDate: "2026-11-20",
    status: input.status,
    contactEmail: "presse@salle.fr",
    createdAt: "2026-11-12T09:00:00.000Z",
    updatedAt: "2026-11-12T09:00:00.000Z",
  };
}

let rows: Accreditation[] = [];

describe("outil scan des accreditations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [];
    service.getAccreditations.mockImplementation(async () => ({
      accreditations: [...rows],
    }));
    service.addAccreditation.mockImplementation(
      async (input: { artist: string; venue: string; contactEmail?: string }) => {
        const created = fiche({
          id: `a${rows.length + 1}`,
          artist: input.artist,
          venue: input.venue,
          status: "pending",
        });
        rows.unshift(created);
        return created;
      }
    );
    service.updateAccreditation.mockImplementation(
      async (id: string, updates: Partial<Accreditation>) => {
        const index = rows.findIndex((entry) => entry.id === id);
        const current = rows[index];
        if (!current) return null;
        const next = { ...current, ...updates };
        rows[index] = next;
        return next;
      }
    );
  });

  it("rend un resultat vide sans email", async () => {
    google.fetchGmailMessages.mockResolvedValue([]);
    const result = await scanAccreditationsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("extrait artiste, lieu, date et statut par IA", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      email("m1", "Accreditation pour Muse", "Concert de Muse au Zenith le 20 novembre 2026, accepté"),
    ]);
    ai.json.mockResolvedValue(
      extraction({
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-11-20",
        status: "accepted",
        contactEmail: "presse@salle.fr",
      })
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(service.addAccreditation).toHaveBeenCalledWith(
      expect.objectContaining({ artist: "Muse", venue: "Zénith", concertDate: "2026-11-20" })
    );
    expect(rows[0]).toMatchObject({ artist: "Muse", status: "accepted" });
    expect(rows[0]?.notes).toBe("Email: m1");
  });

  it("ne retrograde jamais une fiche acceptee", async () => {
    rows = [fiche({ id: "a1", artist: "Muse", venue: "Zénith", status: "accepted" })];
    google.fetchGmailMessages.mockResolvedValue([
      email("m2", "Accreditation pour Muse", "Votre demande est en cours"),
    ]);
    ai.json.mockResolvedValue(extraction({ artist: "Muse", venue: "Zénith", status: "sent" }));

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(rows[0]?.status).toBe("accepted");
    expect(service.updateAccreditation).not.toHaveBeenCalled();
  });

  it("complete une fiche dont le lieu et la date sont inconnus", async () => {
    rows = [
      {
        ...fiche({ id: "a1", artist: "Muse", venue: "Inconnu", status: "pending" }),
        concertDate: "Date inconnue",
        contactEmail: undefined,
      },
    ];
    google.fetchGmailMessages.mockResolvedValue([
      email("m3", "Accreditation pour Muse", "Concert de Muse au Zenith le 20 novembre 2026"),
    ]);
    ai.json.mockResolvedValue(
      extraction({
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-11-20",
        contactEmail: "presse@salle.fr",
      })
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(service.updateAccreditation).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({
        venue: "Zénith",
        concertDate: "2026-11-20",
        contactEmail: "presse@salle.fr",
      })
    );
  });

  it("signale une reponse IA illisible sans rien ecrire", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      email("m4", "Accreditation", "Texte quelconque"),
    ]);
    ai.json.mockResolvedValue("desole, je ne peux pas");

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolError(result, /Scan interrompu/);
    expect(service.addAccreditation).not.toHaveBeenCalled();
  });

  it("refuse de scanner sans IA configuree", async () => {
    const result = await scanAccreditationsTool.run(
      {},
      { moduleId: "accreditations", log: () => {}, emit: () => {} }
    );
    assertToolError(result, /IA indisponible/);
  });

  it("signale une ecriture non confirmee au lieu d'annoncer un succes", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      email("m5", "Accreditation pour Muse", "Concert de Muse au Zenith"),
    ]);
    ai.json.mockResolvedValue(extraction({ artist: "Muse", venue: "Zénith" }));
    service.addAccreditation.mockImplementation(async () =>
      fiche({ id: "fantome", artist: "Muse", venue: "Zénith", status: "pending" })
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolError(result, /ecriture non confirmee/);
  });

  it("signale une erreur de lecture Gmail", async () => {
    google.fetchGmailMessages.mockRejectedValue(new Error("Gmail indisponible"));
    const result = await scanAccreditationsTool.run({}, ctx);
    assertToolError(result, /Gmail indisponible/);
  });
});
