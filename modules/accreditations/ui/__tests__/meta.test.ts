import { describe, expect, it } from "vitest";

import type { Accreditation } from "../../schema";
import {
  countByStatus,
  describeActionError,
  filterAccreditations,
  formatConcertDate,
  sortAccreditations,
} from "../meta";

function fiche(partial: Partial<Accreditation> & { id: string }): Accreditation {
  return {
    artist: "Muse",
    venue: "Zénith",
    concertDate: "2026-12-05",
    status: "pending",
    needsReview: false,
    createdAt: "2026-11-12T09:00:00.000Z",
    updatedAt: "2026-11-12T09:00:00.000Z",
    ...partial,
  };
}

describe("tri et filtres des accréditations", () => {
  it("trie par date de concert décroissante", () => {
    const sorted = sortAccreditations([
      fiche({ id: "a", concertDate: "2026-11-01" }),
      fiche({ id: "b", concertDate: "2027-01-15" }),
      fiche({ id: "c", concertDate: "2026-12-05" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });

  it("place les dates inconnues en dernier", () => {
    const sorted = sortAccreditations([
      fiche({ id: "inconnue", concertDate: "Date inconnue" }),
      fiche({ id: "connue", concertDate: "2026-12-05" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["connue", "inconnue"]);
  });

  it("compte chaque statut et le total", () => {
    const counts = countByStatus([
      fiche({ id: "a", status: "pending" }),
      fiche({ id: "b", status: "sent" }),
      fiche({ id: "c", status: "sent" }),
      fiche({ id: "d", status: "accepted" }),
    ]);

    expect(counts).toMatchObject({ all: 4, pending: 1, sent: 2, accepted: 1, refused: 0 });
  });

  it("filtre par statut puis par recherche", () => {
    const items = [
      fiche({ id: "a", artist: "Damso", status: "accepted" }),
      fiche({ id: "b", artist: "Muse", status: "sent" }),
    ];

    expect(filterAccreditations(items, "sent", "").map((entry) => entry.id)).toEqual(["b"]);
    expect(filterAccreditations(items, "all", "dam").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterAccreditations(items, "accepted", "muse")).toEqual([]);
  });

  it("compte et filtre la revue independamment du statut", () => {
    const items = [
      fiche({ id: "a", artist: "Muse", status: "pending", needsReview: true }),
      fiche({ id: "b", artist: "Muse Live", status: "sent", needsReview: true }),
      fiche({ id: "c", artist: "Damso", status: "sent" }),
    ];

    expect(countByStatus(items)).toMatchObject({ all: 3, review: 2, pending: 1, sent: 2 });
    expect(filterAccreditations(items, "review", "").map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);
    expect(filterAccreditations(items, "review", "live").map((entry) => entry.id)).toEqual([
      "b",
    ]);
  });

  it("cherche aussi dans le contact", () => {
    const items = [fiche({ id: "a", contactEmail: "presse@salle.fr" })];
    expect(filterAccreditations(items, "all", "salle").map((entry) => entry.id)).toEqual(["a"]);
  });

  it("garde une date inconnue lisible", () => {
    expect(formatConcertDate("Date inconnue")).toBe("Date inconnue");
  });
});

describe("describeActionError", () => {
  it("rend le message d'une Error", () => {
    expect(describeActionError(new Error("Session expirée"), "Echec")).toBe("Session expirée");
  });

  it("rend une chaine non vide telle quelle", () => {
    expect(describeActionError("Validation refusee", "Echec")).toBe("Validation refusee");
  });

  it("retombe sur le repli pour un objet inconnu", () => {
    expect(describeActionError({ code: 500 }, "Echec")).toBe("Echec");
    expect(describeActionError(null, "Echec")).toBe("Echec");
    expect(describeActionError(undefined, "Echec")).toBe("Echec");
    expect(describeActionError(42, "Echec")).toBe("Echec");
  });

  it("retombe sur le repli quand le message est vide", () => {
    expect(describeActionError(new Error("   "), "Echec")).toBe("Echec");
    expect(describeActionError("", "Echec")).toBe("Echec");
  });
});
