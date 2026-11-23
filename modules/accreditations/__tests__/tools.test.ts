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

const ctx = { moduleId: "accreditations", log: () => {}, emit: () => {} };

function email(id: string, subject: string, snippet: string) {
  return { id, from: "presse@salle.fr", subject, snippet };
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
    concertDate: "2026-12-05",
    status: input.status,
    contactEmail: "presse@salle.fr",
    notes: undefined,
    createdAt: "2026-11-12T09:00:00.000Z",
    updatedAt: "2026-11-12T09:00:00.000Z",
  };
}

/** Faux store en mémoire : les relectures de `verifyWrite` voient les écritures. */
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

  it("cree une fiche a partir d'un email", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      email("m1", "Accreditation pour Muse", "Concert de Muse au Zenith le 20 novembre 2026, accepté"),
    ]);

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(result.text).toContain("1 nouvelle(s)");
    expect(service.addAccreditation).toHaveBeenCalledWith(
      expect.objectContaining({ artist: "muse concert de", contactEmail: "presse@salle.fr" })
    );
    expect(rows[0]?.status).toBe("accepted");
    expect(rows[0]?.notes).toBe("Email: m1");
  });

  it("met a jour le statut d'une fiche existante", async () => {
    rows = [fiche({ id: "a1", artist: "muse concert de", venue: "zenith", status: "pending" })];
    google.fetchGmailMessages.mockResolvedValue([
      email("m2", "Accreditation pour Muse", "Concert de Muse au Zenith, accepté"),
    ]);

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(service.addAccreditation).not.toHaveBeenCalled();
    expect(service.updateAccreditation).toHaveBeenCalledWith("a1", { status: "accepted" });
    expect(rows[0]?.status).toBe("accepted");
  });

  it("signale une erreur de lecture Gmail", async () => {
    google.fetchGmailMessages.mockRejectedValue(new Error("Gmail indisponible"));
    const result = await scanAccreditationsTool.run({}, ctx);
    assertToolError(result, /Gmail indisponible/);
  });

  it("signale une ecriture non confirmee au lieu d'annoncer un succes", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      email("m3", "Accreditation pour Muse", "Concert de Muse au Zenith"),
    ]);
    service.addAccreditation.mockImplementation(async () =>
      fiche({ id: "fantome", artist: "muse", venue: "zenith", status: "pending" })
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolError(result, /ecriture non confirmee/);
  });
});
