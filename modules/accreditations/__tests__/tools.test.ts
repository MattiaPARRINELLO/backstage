import { assertToolError, assertToolOk } from "@backstage/module-kit/testing";
import type { GmailThread } from "@backstage/module-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Accreditation } from "../schema";

const mail = { listThreads: vi.fn(), getThread: vi.fn(), getMessage: vi.fn() };
const service = {
  getAccreditations: vi.fn(),
  addAccreditation: vi.fn(),
  updateAccreditation: vi.fn(),
};

vi.mock("../service", () => service);

const { scanAccreditationsTool } = await import("../tools");

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

let messageCounter = 0;

/** Un fil d'un message, tel que le rend `mail.listThreads`. */
function thread(id: string, subject: string, body: string): GmailThread {
  messageCounter++;
  return {
    id: `t-${id}`,
    messages: [
      {
        id: `${id}-m${messageCounter}`,
        threadId: `t-${id}`,
        from: "Presse Salle <presse@salle.fr>",
        to: "Rapstar <contact@rapstar.fr>",
        subject,
        date: "Tue, 10 Nov 2026 12:00:00 +0000",
        snippet: body,
        body,
        unread: false,
      },
    ],
  };
}

/** Un fil dont la demande est de l'utilisateur et la reponse de la salle. */
function threadWithReply(
  id: string,
  subject: string,
  request: string,
  reply: string
): GmailThread {
  const base = thread(id, subject, request);
  const oldest = base.messages[0]!;
  return {
    id: base.id,
    messages: [
      {
        ...oldest,
        id: `${id}-reponse`,
        from: "Presse Salle <presse@salle.fr>",
        date: "Wed, 11 Nov 2026 09:00:00 +0000",
        snippet: reply,
        body: reply,
        fromMe: false,
      },
      { ...oldest, from: "Rapstar <contact@rapstar.fr>", fromMe: true },
    ],
  };
}

function batch(results: Array<Record<string, unknown>>) {
  return JSON.stringify({
    results: results.map((item) => ({
      artist: "",
      venue: "",
      concertDate: "",
      status: "pending",
      contactEmail: "",
      uncertainFields: [],
      ...item,
    })),
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
    needsReview: false,
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

  it("rend un resultat vide sans fil", async () => {
    mail.listThreads.mockResolvedValue([]);
    const result = await scanAccreditationsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("interroge les termes precis, les envois recents et les termes larges", async () => {
    mail.listThreads.mockResolvedValue([]);

    await scanAccreditationsTool.run({}, ctx);

    const queries = mail.listThreads.mock.calls.map((call: unknown[]) => call[0]);
    expect(queries).toHaveLength(3);
    expect(queries[0]).toMatch(/accréditation/);
    expect(queries[0]).toMatch(/photo pass/);
    expect(queries[1]).toBe("in:sent newer_than:12m");
    expect(queries[2]).toMatch(/photographe/);
  });

  it("extrait artiste, lieu, date et statut par IA", async () => {
    const demande = thread(
      "m1",
      "Accreditation pour Muse",
      "Concert de Muse au Zenith le 20 novembre 2026, accepté"
    );
    mail.listThreads.mockResolvedValue([demande]);
    ai.json.mockResolvedValue(
      batch([
        {
          id: demande.id,
          artist: "Muse",
          venue: "Zénith",
          concertDate: "2026-11-20",
          status: "accepted",
          contactEmail: "presse@salle.fr",
        },
      ])
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(service.addAccreditation).toHaveBeenCalledWith(
      expect.objectContaining({
        artist: "Muse",
        venue: "Zénith",
        concertDate: "2026-11-20",
        needsReview: false,
      })
    );
    expect(rows[0]).toMatchObject({ artist: "Muse", status: "accepted" });
    expect(rows[0]?.emailThreadId).toBe(demande.id);
  });

  it("lit la reponse d'un fil meme sans mot-cle, et garde le contact de la salle", async () => {
    const fil = threadWithReply(
      "m2",
      "Demande de photos",
      "Bonjour, je souhaite couvrir le concert de Muse au Zenith.",
      "C'est ok pour vendredi, accreditations au nom du media."
    );
    mail.listThreads.mockResolvedValue([fil]);
    ai.json.mockResolvedValue(
      batch([{ id: fil.id, artist: "Muse", venue: "Zénith", status: "accepted" }])
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(service.addAccreditation).toHaveBeenCalledWith(
      expect.objectContaining({
        artist: "Muse",
        contactEmail: "presse@salle.fr",
      })
    );
    const prompt = ai.json.mock.calls[0]?.[0]?.prompt ?? "";
    expect(prompt).toContain("(vous)");
    expect(prompt).toContain("C'est ok pour vendredi");
  });

  it("ne retrograde jamais une fiche acceptee", async () => {
    rows = [fiche({ id: "a1", artist: "Muse", venue: "Zénith", status: "accepted" })];
    const fil = thread("m3", "Accreditation pour Muse", "Votre demande est en cours");
    mail.listThreads.mockResolvedValue([fil]);
    ai.json.mockResolvedValue(
      batch([
        {
          id: fil.id,
          artist: "Muse",
          venue: "Zénith",
          concertDate: "2026-11-20",
          status: "sent",
        },
      ])
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(rows[0]?.status).toBe("accepted");
    expect(service.updateAccreditation).not.toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ status: expect.anything() })
    );
  });

  it("complete une fiche dont le lieu et la date sont inconnus", async () => {
    rows = [
      {
        ...fiche({ id: "a1", artist: "Muse", venue: "Inconnu", status: "pending" }),
        concertDate: "Date inconnue",
        contactEmail: undefined,
      },
    ];
    const fil = thread(
      "m4",
      "Accreditation pour Muse",
      "Concert de Muse au Zenith le 20 novembre 2026"
    );
    mail.listThreads.mockResolvedValue([fil]);
    ai.json.mockResolvedValue(
      batch([
        {
          id: fil.id,
          artist: "Muse",
          venue: "Zénith",
          concertDate: "2026-11-20",
          contactEmail: "presse@salle.fr",
        },
      ])
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
    mail.listThreads.mockResolvedValue([
      thread("m5", "Accreditation", "Texte quelconque"),
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

  it("refuse de scanner quand l'hote ne fournit pas de mail", async () => {
    const result = await scanAccreditationsTool.run(
      {},
      { moduleId: "accreditations", log: () => {}, emit: () => {}, ai }
    );
    assertToolError(result, /Acces mail indisponible/);
  });

  it("signale une ecriture non confirmee au lieu d'annoncer un succes", async () => {
    const fil = thread("m6", "Accreditation pour Muse", "Concert de Muse au Zenith");
    mail.listThreads.mockResolvedValue([fil]);
    ai.json.mockResolvedValue(
      batch([{ id: fil.id, artist: "Muse", venue: "Zénith" }])
    );
    service.addAccreditation.mockImplementation(async () =>
      fiche({ id: "fantome", artist: "Muse", venue: "Zénith", status: "pending" })
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolError(result, /ecriture non confirmee/);
  });

  it("refuse de faire de Rapstar, le media, un artiste", async () => {
    const fil = thread(
      "m7",
      "Demande d'accreditation",
      "Rapstar souhaite couvrir le concert"
    );
    mail.listThreads.mockResolvedValue([fil]);
    ai.json.mockResolvedValue(
      batch([{ id: fil.id, artist: "Rapstar", venue: "Musée Imaginaire d'Oli" }])
    );

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(result.text).toContain("1 ignoree(s)");
    expect(service.addAccreditation).not.toHaveBeenCalled();
  });

  it("signale une erreur de lecture Gmail", async () => {
    mail.listThreads.mockRejectedValue(new Error("Gmail indisponible"));
    const result = await scanAccreditationsTool.run({}, ctx);
    assertToolError(result, /Gmail indisponible/);
  });

  it("annonce le plafond quand il y a plus de fils candidats que le scan n'en traite", async () => {
    const makeThreads = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) =>
        thread(`${prefix}${index}`, "Accreditation", "Demande de photos")
      );
    const precise = makeThreads("precis", 150);
    const sent = makeThreads("envoi", 80);
    const broad = makeThreads("large", 60);
    mail.listThreads.mockImplementation(async (query: string, max: number) => {
      if (query === "in:sent newer_than:12m") return sent.slice(0, max);
      if (query.includes("photographe")) return broad.slice(0, max);
      return precise.slice(0, max);
    });
    ai.json.mockResolvedValue(JSON.stringify({ results: [] }));

    const result = await scanAccreditationsTool.run({}, ctx);

    assertToolOk(result);
    expect(result.text).toContain("200 fils sur 290 candidats");
  });

  it("refuse un second scan simultane et libere le verrou ensuite", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mail.listThreads.mockImplementation(async () => {
      await gate;
      return [];
    });

    const first = scanAccreditationsTool.run({}, ctx);
    const second = await scanAccreditationsTool.run({}, ctx);

    assertToolError(second, /deja en cours/);

    release();
    const firstResult = await first;
    expect(firstResult.status).toBe("empty");

    const after = await scanAccreditationsTool.run({}, ctx);
    expect(after.status).toBe("empty");
  });
});
