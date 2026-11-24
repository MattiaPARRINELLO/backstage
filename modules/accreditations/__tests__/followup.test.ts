import { withTempDataDir } from "@backstage/module-kit/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Accreditation } from "../schema";

const push = { sendPushToAll: vi.fn() };
vi.mock("@/lib/push-dispatch", () => push);

const {
  buildFollowUpDraft,
  computeFollowUpAt,
  countAwaitingFollowUp,
  dueAccreditations,
  followUpPromptLines,
  isFollowUpDue,
} = await import("../followup");
const { runAccreditationFollowUpCheck } = await import("../followup-job");
const { accreditationsStore } = await import("../store");
const { updateAccreditation } = await import("../service");

const CREATED = "2026-11-12T10:00:00.000Z";

function fiche(partial: Partial<Accreditation> & { id: string }): Accreditation {
  return {
    artist: "Damso",
    venue: "Défense Arena",
    concertDate: "2026-12-05",
    status: "sent",
    needsReview: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...partial,
  };
}

describe("calcul de la relance J+7", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T09:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("part de la date de création, pas de la dernière modification", () => {
    const due = computeFollowUpAt(CREATED, "2026-12-05");
    expect(due).toBe("2026-11-19T10:00:00.000Z");
  });

  it("ramène l'échéance à J-2 quand le concert est proche", () => {
    const due = computeFollowUpAt(CREATED, "2026-11-16");
    expect(due).toBe("2026-11-14T00:00:00.000Z");
  });

  it("garde J+7 quand la date du concert est inconnue", () => {
    const due = computeFollowUpAt(CREATED, "Date inconnue");
    expect(due).toBe("2026-11-19T10:00:00.000Z");
  });

  it("rend undefined sans date de création exploitable", () => {
    expect(computeFollowUpAt("pas une date", "2026-12-05")).toBeUndefined();
  });
});

describe("sélection des relances dues", () => {
  const now = Date.parse("2026-11-20T09:00:00.000Z");

  it("exige le statut envoyée, une échéance atteinte et aucune notification", () => {
    expect(isFollowUpDue(fiche({ id: "a", followUpAt: "2026-11-19T10:00:00.000Z" }), now)).toBe(true);
    expect(
      isFollowUpDue(
        fiche({ id: "b", followUpAt: "2026-11-19T10:00:00.000Z", followUpNotifiedAt: "2026-11-19T11:00:00.000Z" }),
        now
      )
    ).toBe(false);
    expect(
      isFollowUpDue(fiche({ id: "c", status: "pending", followUpAt: "2026-11-19T10:00:00.000Z" }), now)
    ).toBe(false);
    expect(
      isFollowUpDue(fiche({ id: "d", followUpAt: "2026-12-19T10:00:00.000Z" }), now)
    ).toBe(false);
  });

  it("compte les fiches déjà notifiées et les échues", () => {
    const entries = [
      fiche({ id: "a", status: "follow-up", followUpAt: "2026-11-19T10:00:00.000Z" }),
      fiche({ id: "b", followUpAt: "2026-11-19T10:00:00.000Z" }),
      fiche({ id: "c", followUpAt: "2026-12-19T10:00:00.000Z" }),
    ];
    expect(dueAccreditations(entries, now).map((entry) => entry.id)).toEqual(["b"]);
    expect(countAwaitingFollowUp(entries, now)).toBe(2);
  });

  it("borne le bloc de prompt à trois lignes", () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      fiche({ id: `a${index}`, status: "follow-up", followUpAt: "2026-11-19T10:00:00.000Z" })
    );
    const lines = followUpPromptLines(entries, now).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Accréditations à relancer :");
  });
});

describe("texte de relance", () => {
  it("nomme l'artiste, le lieu et la date du concert", () => {
    const draft = buildFollowUpDraft(fiche({ id: "a" }));
    expect(draft).toContain("Damso");
    expect(draft).toContain("Défense Arena");
    expect(draft).toContain("5 décembre 2026");
    expect(draft).toContain("Mattia");
  });
});

describe("job de relance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T09:00:00.000Z"));
    vi.clearAllMocks();
    push.sendPushToAll.mockResolvedValue({ sent: true, devices: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifie une fois, passe la fiche en follow-up et pose le texte", async () => {
    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(
          fiche({ id: "a", followUpAt: "2026-11-19T10:00:00.000Z" }),
          fiche({ id: "b", followUpAt: "2026-12-19T10:00:00.000Z" })
        );
      });

      const notified = await runAccreditationFollowUpCheck();

      expect(notified).toBe(1);
      expect(push.sendPushToAll).toHaveBeenCalledTimes(1);
      const after = await accreditationsStore.read();
      expect(after.accreditations[0]).toMatchObject({
        id: "a",
        status: "follow-up",
        followUpNotifiedAt: "2026-11-20T09:00:00.000Z",
      });
      expect(after.accreditations[0]?.followUpDraft).toContain("Damso");
      expect(after.accreditations[1]?.status).toBe("sent");

      const again = await runAccreditationFollowUpCheck();
      expect(again).toBe(0);
      expect(push.sendPushToAll).toHaveBeenCalledTimes(1);
    });
  });

  it("ne marque rien quand l'envoi push échoue", async () => {
    push.sendPushToAll.mockResolvedValue({ sent: false, devices: 0 });
    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(fiche({ id: "a", followUpAt: "2026-11-19T10:00:00.000Z" }));
      });

      const notified = await runAccreditationFollowUpCheck();

      expect(notified).toBe(0);
      const after = await accreditationsStore.read();
      expect(after.accreditations[0]?.status).toBe("sent");
      expect(after.accreditations[0]?.followUpNotifiedAt).toBeUndefined();
    });
  });

  it("programme la relance quand une demande passe en envoyée", async () => {
    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(fiche({ id: "a", status: "pending" }));
      });

      const updated = await updateAccreditation("a", { status: "sent" });

      expect(updated?.followUpAt).toBe("2026-11-19T10:00:00.000Z");
    });
  });

  it("annule la relance quand la demande est acceptée", async () => {
    await withTempDataDir(async () => {
      await accreditationsStore.mutate((data) => {
        data.accreditations.push(
          fiche({ id: "a", followUpAt: "2026-11-19T10:00:00.000Z" })
        );
      });

      const updated = await updateAccreditation("a", { status: "accepted" });

      expect(updated?.followUpAt).toBeUndefined();
    });
  });
});
