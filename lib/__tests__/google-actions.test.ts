import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../google-client", () => ({
  getCalendarClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
  getGmailClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
}));

import { extractBody, createGoogleCalendarEvent, fetchGmailMessages } from "../google-actions";
import { jsonResponse, withHttpDouble, type HttpDoubleRoute } from "@/lib/http-double";

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64");
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function captureEventBody(start: string, end: string) {
  let captured:
    | {
        start: { dateTime?: string; date?: string; timeZone?: string };
        end: { dateTime?: string; date?: string; timeZone?: string };
      }
    | undefined;

  await withHttpDouble(
    [
      {
        match: CALENDAR_URL,
        response: (_url, init) => {
          captured = JSON.parse(String(init.body));
          return jsonResponse({ id: "evt-1" });
        },
      },
    ],
    async () => {
      await createGoogleCalendarEvent("Réunion", start, end);
    }
  );

  if (!captured) throw new Error("le port HTTP n'a pas été appelé");
  return captured;
}

describe("extractBody", () => {
  it("renvoie le corps direct pour un email text/plain mono-part", () => {
    expect(extractBody(undefined, "text/plain", { data: b64("Bonjour Noann") })).toBe("Bonjour Noann");
  });

  it("extrait le texte d'un email HTML-only mono-part (pas de version texte)", () => {
    const html = "<html><body><p>Salut,</p><p>Rendez-vous demain à 14h.</p></body></html>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe("Salut,\nRendez-vous demain à 14h.");
  });

  it("priorise la version texte quand les deux existent", () => {
    const parts = [
      { mimeType: "text/plain", body: { data: b64("Version texte") } },
      { mimeType: "text/html", body: { data: b64("<p>Version HTML</p>") } },
    ];
    expect(extractBody(parts, "multipart/alternative", undefined)).toBe("Version texte");
  });

  it("trouve le HTML dans des parts imbriquées (multipart/related)", () => {
    const parts = [
      {
        mimeType: "multipart/related",
        parts: [
          { mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64("<p>Nested</p>") } }] },
        ],
      },
    ];
    expect(extractBody(parts, "multipart/mixed", undefined)).toBe("Nested");
  });

  it("supprime style/script et normalise les sauts de ligne du HTML", () => {
    const html = "<style>.x{color:red}</style><script>alert(1)</script><div>A<br>B</div>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe("A\nB");
  });

  it("décode les entités HTML courantes", () => {
    const html = "<p>a &amp; b &lt;c&gt; &nbsp; &quot;d&quot;</p>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe('a & b <c> "d"');
  });

  it("retourne une chaîne vide quand il n'y a aucun contenu", () => {
    expect(extractBody(undefined, "text/html", undefined)).toBe("");
    expect(extractBody([{ mimeType: "image/png", body: { data: b64("img") } }], "multipart/mixed", undefined)).toBe("");
  });
});

describe("fetchGmailMessages — tri deterministe et messages illisibles", () => {
  type Listed = { id: string; date: string };

  function gmailRoutes(list: Listed[], broken: string[] = []): HttpDoubleRoute[] {
    return [
      {
        match: /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages/,
        response: (input) => {
          if (input.includes("/messages?")) {
            return jsonResponse({ messages: list.map((m) => ({ id: m.id })) });
          }
          const id = /\/messages\/([^?]+)\?format=full/.exec(input)?.[1] ?? "";
          if (broken.includes(id)) {
            // Reponse MIME inexploitable : le message doit etre isole, pas le lot.
            return new Response("<html>erreur serveur</html>", { status: 500 });
          }
          const entry = list.find((m) => m.id === id);
          if (!entry) return new Response("not found", { status: 404 });
          return jsonResponse({
            id,
            threadId: `t-${id}`,
            labelIds: ["INBOX"],
            payload: {
              mimeType: "text/plain",
              headers: [
                { name: "From", value: "expediteur@exemple.fr" },
                { name: "Subject", value: `Sujet ${id}` },
                { name: "Date", value: entry.date },
              ],
              body: { data: b64(`corps ${id}`) },
            },
          });
        },
      },
    ];
  }

  it("trie par date decroissante, quel que soit l'ordre de l'API", async () => {
    const routes = gmailRoutes([
      { id: "vieux", date: "Mon, 09 Nov 2026 08:00:00 +0000" },
      { id: "recent", date: "Wed, 11 Nov 2026 18:00:00 +0000" },
      { id: "milieu", date: "Tue, 10 Nov 2026 12:00:00 +0000" },
    ]);

    const messages = await withHttpDouble(routes, () => fetchGmailMessages(undefined, 10));

    expect(messages.map((m) => m.id)).toEqual(["recent", "milieu", "vieux"]);
  });

  it("isole un message illisible sans faire echouer le lot", async () => {
    const list: Listed[] = [
      { id: "m1", date: "Tue, 10 Nov 2026 12:00:00 +0000" },
      { id: "casse", date: "Tue, 10 Nov 2026 11:00:00 +0000" },
      { id: "m2", date: "Tue, 10 Nov 2026 10:00:00 +0000" },
    ];
    const routes = gmailRoutes(list, ["casse"]);

    const messages = await withHttpDouble(routes, () => fetchGmailMessages(undefined, 10));

    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(messages.find((m) => m.id === "casse")).toBeUndefined();
    expect(messages.every((m) => m.subject.startsWith("Sujet"))).toBe(true);
  });

  it("renvoie la meme selection pour deux appels identiques", async () => {
    const list: Listed[] = [
      { id: "a", date: "Tue, 10 Nov 2026 12:00:00 +0000" },
      { id: "b", date: "Tue, 10 Nov 2026 12:00:00 +0000" },
      { id: "c", date: "Tue, 10 Nov 2026 09:00:00 +0000" },
    ];
    const routes = gmailRoutes(list);

    const { first, second } = await withHttpDouble(routes, async () => {
      const first = await fetchGmailMessages(undefined, 10);
      const second = await fetchGmailMessages(undefined, 10);
      return { first, second };
    });

    expect(first.map((m) => m.id)).toEqual(second.map((m) => m.id));
  });

  it("renvoie une liste vide quand Gmail ne trouve aucun message", async () => {
    const routes = gmailRoutes([]);

    await expect(
      withHttpDouble(routes, () => fetchGmailMessages("inexistant", 10))
    ).resolves.toEqual([]);
  });
});

describe("createGoogleCalendarEvent — fuseau horaire", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("ajoute le fuseau local pour une dateHeure naïve (sans décalage)", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00", "2026-08-22T18:00:00");
    expect(body.start).toEqual({
      dateTime: "2026-08-22T17:00:00",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    expect(body.end.timeZone).toBeDefined();
  });

  it("laisse intacte une dateHeure avec décalage explicite (Z)", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00Z", "2026-08-22T18:00:00Z");
    expect(body.start).toEqual({ dateTime: "2026-08-22T17:00:00Z" });
    expect(body.end).toEqual({ dateTime: "2026-08-22T18:00:00Z" });
  });

  it("laisse intacte une dateHeure avec décalage +02:00", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00+02:00", "2026-08-22T18:00:00+02:00");
    expect(body.start).toEqual({ dateTime: "2026-08-22T17:00:00+02:00" });
  });

  it("conserve le format jour-entier (all-day) sans timeZone", async () => {
    const body = await captureEventBody("2026-08-22", "2026-08-23");
    expect(body.start).toEqual({ date: "2026-08-22" });
    expect(body.end).toEqual({ date: "2026-08-23" });
  });
});
