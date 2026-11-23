import { describe, expect, it } from "vitest";

import type { Accreditation } from "../../schema";
import {
  countByStatus,
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

  it("cherche aussi dans le contact", () => {
    const items = [fiche({ id: "a", contactEmail: "presse@salle.fr" })];
    expect(filterAccreditations(items, "all", "salle").map((entry) => entry.id)).toEqual(["a"]);
  });

  it("garde une date inconnue lisible", () => {
    expect(formatConcertDate("Date inconnue")).toBe("Date inconnue");
  });
});
