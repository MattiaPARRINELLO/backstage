import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../google-client", () => ({
  getCalendarClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
  getGmailClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
}));

import {
  extractBody,
  createGoogleCalendarEvent,
  fetchGmailMessages,
  fetchGmailThreads,
} from "../google-actions";
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

describe("fetchGmailThreads — fils complets", () => {
  type Thread = { id: string; messageIds: string[]; dates: string[] };

  function threadRoutes(threads: Thread[], broken: string[] = []): HttpDoubleRoute[] {
    return [
      {
        match: /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/threads/,
        response: (input) => {
          if (input.includes("/threads?")) {
            return jsonResponse({ threads: threads.map((t) => ({ id: t.id })) });
          }
          const id = /\/threads\/([^?]+)\?format=full/.exec(input)?.[1] ?? "";
          if (broken.includes(id)) return new Response("boom", { status: 500 });
          const thread = threads.find((t) => t.id === id);
          if (!thread) return new Response("not found", { status: 404 });
          return jsonResponse({
            id,
            messages: thread.messageIds.map((messageId, index) => ({
              id: messageId,
              threadId: id,
              labelIds: ["INBOX"],
              payload: {
                mimeType: "text/plain",
                headers: [
                  { name: "From", value: "presse@salle.fr" },
                  { name: "Subject", value: `Demande ${id}` },
                  { name: "Date", value: thread.dates[index] },
                ],
                body: { data: b64(`corps ${messageId}`) },
              },
            })),
          });
        },
      },
    ];
  }

  it("ramene tous les messages d'un fil, du plus recent au plus ancien", async () => {
    const routes = threadRoutes([
      {
        id: "t1",
        messageIds: ["demande", "reponse"],
        dates: ["Mon, 09 Nov 2026 08:00:00 +0000", "Tue, 10 Nov 2026 18:00:00 +0000"],
      },
    ]);

    const threads = await withHttpDouble(routes, () => fetchGmailThreads("accreditation", 10));

    expect(threads).toHaveLength(1);
    expect(threads[0]?.messages.map((m) => m.id)).toEqual(["reponse", "demande"]);
    expect(threads[0]?.messages[0]?.body).toBe("corps reponse");
  });

  it("trie les fils par message le plus recent", async () => {
    const routes = threadRoutes([
      { id: "vieux", messageIds: ["v1"], dates: ["Mon, 02 Nov 2026 08:00:00 +0000"] },
      { id: "recent", messageIds: ["r1", "r2"], dates: ["Tue, 10 Nov 2026 09:00:00 +0000", "Wed, 11 Nov 2026 09:00:00 +0000"] },
    ]);

    const threads = await withHttpDouble(routes, () => fetchGmailThreads("photo", 10));

    expect(threads.map((t) => t.id)).toEqual(["recent", "vieux"]);
  });

  it("isole un fil illisible sans faire echouer le lot", async () => {
    const routes = threadRoutes(
      [
        { id: "ok", messageIds: ["a"], dates: ["Tue, 10 Nov 2026 09:00:00 +0000"] },
        { id: "casse", messageIds: ["b"], dates: ["Tue, 10 Nov 2026 10:00:00 +0000"] },
      ],
      ["casse"]
    );

    const threads = await withHttpDouble(routes, () => fetchGmailThreads("photo", 10));

    expect(threads.map((t) => t.id)).toEqual(["ok"]);
  });

  it("retente un 429 de quota au lieu d'abandonner le fil", async () => {
    let threadCalls = 0;
    const routes: HttpDoubleRoute[] = [
      {
        match: /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/threads/,
        response: (input) => {
          if (input.includes("/threads?")) {
            return jsonResponse({ threads: [{ id: "t1" }] });
          }
          threadCalls += 1;
          if (threadCalls === 1) {
            return new Response("rateLimitExceeded", {
              status: 429,
              headers: { "retry-after": "0" },
            });
          }
          return jsonResponse({
            id: "t1",
            messages: [
              {
                id: "m1",
                threadId: "t1",
                labelIds: ["INBOX"],
                payload: {
                  mimeType: "text/plain",
                  headers: [{ name: "Date", value: "Tue, 10 Nov 2026 09:00:00 +0000" }],
                  body: { data: b64("corps") },
                },
              },
            ],
          });
        },
      },
    ];

    const threads = await withHttpDouble(routes, () =>
      fetchGmailThreads("photo", 1)
    );

    expect(threadCalls).toBe(2);
    expect(threads.map((t) => t.id)).toEqual(["t1"]);
  });

  it("echoue clairement quand tous les fils sont illisibles", async () => {
    const routes = threadRoutes(
      [{ id: "casse", messageIds: ["b"], dates: ["Tue, 10 Nov 2026 10:00:00 +0000"] }],
      ["casse"]
    );

    await expect(
      withHttpDouble(routes, () => fetchGmailThreads("photo", 10))
    ).rejects.toThrow(/Aucun fil Gmail lisible/);
  });

  it("renvoie une liste vide quand Gmail ne trouve aucun fil", async () => {
    await expect(
      withHttpDouble(threadRoutes([]), () => fetchGmailThreads("inexistant", 10))
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
