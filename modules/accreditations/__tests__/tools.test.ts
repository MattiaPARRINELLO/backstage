import { beforeEach, describe, expect, it, vi } from "vitest";

const google = { fetchGmailMessages: vi.fn() };
const storage = {
  getAccreditations: vi.fn(),
  addAccreditation: vi.fn(),
  updateAccreditation: vi.fn(),
};

vi.mock("@/lib/google-actions", () => google);
vi.mock("@/lib/storage", () => storage);

const { scanAccreditationsTool } = await import("@/modules/accreditations/tools");

const ctx = { moduleId: "accreditations", log: () => {}, emit: () => {} };

function email(id: string, subject: string, snippet: string) {
  return { id, from: "presse@salle.fr", subject, snippet };
}

describe("outil scan des accreditations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getAccreditations.mockResolvedValue({ accreditations: [] });
    storage.addAccreditation.mockResolvedValue({ id: "a1" });
    storage.updateAccreditation.mockResolvedValue({ id: "a1" });
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
    expect(result.status).toBe("ok");
    expect(result.text).toContain("1 nouvelle(s)");
    expect(storage.addAccreditation).toHaveBeenCalledWith(
      expect.objectContaining({ artist: "muse concert de", contactEmail: "presse@salle.fr" })
    );
    expect(storage.updateAccreditation).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ status: "accepted" })
    );
  });

  it("met a jour le statut d'une fiche existante", async () => {
    storage.getAccreditations.mockResolvedValue({
      accreditations: [
        { id: "a1", artist: "muse concert de", venue: "zenith", status: "pending" },
      ],
    });
    google.fetchGmailMessages.mockResolvedValue([
      email("m2", "Accreditation pour Muse", "Concert de Muse au Zenith, accepté"),
    ]);

    const result = await scanAccreditationsTool.run({}, ctx);
    expect(result.status).toBe("ok");
    expect(storage.addAccreditation).not.toHaveBeenCalled();
    expect(storage.updateAccreditation).toHaveBeenCalledWith("a1", { status: "accepted" });
  });

  it("signale une erreur de lecture Gmail", async () => {
    google.fetchGmailMessages.mockRejectedValue(new Error("Gmail indisponible"));
    const result = await scanAccreditationsTool.run({}, ctx);
    expect(result.status).toBe("error");
    expect(result.text).toContain("Gmail indisponible");
  });
});
