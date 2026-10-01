import { beforeEach, describe, expect, it, vi } from "vitest";

// getConfig() est mocké : les tests ne doivent pas dépendre de data/config.json.
const config = {
  features: { discordNotifications: true },
  discord: { userId: "424242424242424242", alerts: true },
};

vi.mock("@/lib/config", () => ({
  getConfig: async () => config,
}));

// Le rendu des cartes (next/og + WASM) ne survit pas au transform de vitest :
// il est couvert par scripts/discord-card-preview.tsx, on stub le contrat ici.
const { renderEventCard } = vi.hoisted(() => ({
  renderEventCard: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
}));

vi.mock("@/lib/discord/cards", () => ({ renderEventCard }));

process.env.DISCORD_BOT_TOKEN = "bot-token-test";

const { resetChannelCache, sendDirectMessage, verifyConnection } = await import(
  "@/lib/discord/client"
);
const { notifyDiscord, notifyDiscordAlert, redactSecrets, resetAlertThrottle } = await import(
  "@/lib/discord/notify"
);

const credentials = { token: "bot-token-test", userId: "424242424242424242", events: true, alerts: true };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function stubFetch(handler: (call: Call) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), init: init ?? {} };
      calls.push(call);
      return handler(call);
    })
  );
}

const embed = { title: "Titre", color: 0xd4a373 };
const image = { filename: "carte.png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };

beforeEach(() => {
  calls = [];
  resetChannelCache();
  resetAlertThrottle();
  vi.unstubAllGlobals();
});

describe("redactSecrets", () => {
  it("masque les jetons passés en paramètre d'URL", () => {
    const out = redactSecrets("echec https://api.test/refresh?access_token=abc123&x=1");
    expect(out).toContain("access_token=***");
    expect(out).not.toContain("abc123");
  });

  it("masque les longues séquences (jetons, clés, endpoints signés)", () => {
    expect(redactSecrets("push https://fcm.test/send/" + "a".repeat(60))).toContain("***");
  });
});

describe("sendDirectMessage", () => {
  it("ouvre le DM puis envoie l'embed et la carte en pièce jointe", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/users/@me/channels") ? jsonResponse({ id: "chan-1" }) : jsonResponse({ id: "msg-1" })
    );

    const result = await sendDirectMessage(credentials, { embed, image });

    expect(result.sent).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/users/@me/channels");
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bot bot-token-test" });

    const form = calls[1].init.body as FormData;
    const payload = JSON.parse(String(form.get("payload_json")));
    expect(payload.embeds[0].title).toBe("Titre");
    expect(payload.attachments).toEqual([{ id: 0, filename: "carte.png" }]);
    // Aucun ping possible, même si un titre contient @everyone.
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    const file = form.get("files[0]") as File;
    expect(file.name).toBe("carte.png");
    expect(file.type).toBe("image/png");
  });

  it("réutilise le salon DM déjà ouvert", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/users/@me/channels") ? jsonResponse({ id: "chan-1" }) : jsonResponse({ id: "msg-1" })
    );

    await sendDirectMessage(credentials, { embed, image: null });
    await sendDirectMessage(credentials, { embed, image: null });

    expect(calls.filter((c) => c.url.endsWith("/users/@me/channels"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith("/messages"))).toHaveLength(2);
  });

  it("réouvre le salon et retente quand Discord répond 404", async () => {
    let messageAttempts = 0;
    stubFetch(({ url }) => {
      if (url.endsWith("/users/@me/channels")) return jsonResponse({ id: "chan-1" });
      messageAttempts += 1;
      return messageAttempts === 1 ? jsonResponse({ message: "Unknown Channel" }, 404) : jsonResponse({});
    });

    const result = await sendDirectMessage(credentials, { embed, image: null });

    expect(result.sent).toBe(true);
    expect(messageAttempts).toBe(2);
  });

  it("remonte un échec sans lever d'exception", async () => {
    stubFetch(() => jsonResponse({ message: "Missing Permissions" }, 403));
    const result = await sendDirectMessage(credentials, { embed, image: null });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("Missing Permissions");
  });
});

describe("verifyConnection", () => {
  it("valide le bot et l'ouverture du DM", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/users/@me")
        ? jsonResponse({ username: "backstage-bot" })
        : jsonResponse({ id: "chan-1" })
    );
    const result = await verifyConnection(credentials);
    expect(result).toEqual({ ok: true, detail: "Connecte en tant que backstage-bot" });
  });

  it("signale un bot invalide", async () => {
    stubFetch(() => jsonResponse({ message: "401: Unauthorized" }, 401));
    const result = await verifyConnection(credentials);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("401: Unauthorized");
  });
});

describe("notifyDiscord", () => {
  it("n'envoie rien sans token", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    stubFetch(() => jsonResponse({}, 200));
    try {
      const result = await notifyDiscord({ kind: "test" });
      expect(result).toEqual({ sent: false, reason: "discord non configure" });
      expect(calls).toHaveLength(0);
    } finally {
      process.env.DISCORD_BOT_TOKEN = token;
    }
  });

  it("joint la carte générée au message", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/users/@me/channels") ? jsonResponse({ id: "chan-1" }) : jsonResponse({})
    );

    const result = await notifyDiscord({
      kind: "reminder",
      reminder: {
        id: "r1",
        title: "Appeler le CROUS",
        dueAt: new Date().toISOString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    });

    expect(result.sent).toBe(true);
    expect(renderEventCard).toHaveBeenCalled();
    const form = calls.find((c) => c.url.endsWith("/messages"))?.init.body as FormData;
    expect(JSON.parse(String(form.get("payload_json"))).embeds[0].title).toBe("Appeler le CROUS");
    expect((form.get("files[0]") as File).name).toBe("backstage-reminder.png");
  });

  it("envoie quand même l'embed si la carte échoue", async () => {
    renderEventCard.mockRejectedValueOnce(new Error("rendu casse"));
    stubFetch(({ url }) =>
      url.endsWith("/users/@me/channels") ? jsonResponse({ id: "chan-1" }) : jsonResponse({})
    );

    const result = await notifyDiscord({ kind: "test" });

    expect(result.sent).toBe(true);
    const call = calls.find((c) => c.url.endsWith("/messages"));
    expect(call?.init.body).not.toBeInstanceOf(FormData);
  });

  it("respecte le réglage de désactivation des événements", async () => {
    config.features.discordNotifications = false;
    stubFetch(() => jsonResponse({ id: "chan-1" }));
    const result = await notifyDiscord({ kind: "test" });
    config.features.discordNotifications = true;
    expect(result.sent).toBe(true); // le test de connexion ignore le réglage
  });

  it("déduplique les alertes répétées", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/users/@me/channels") ? jsonResponse({ id: "chan-1" }) : jsonResponse({})
    );

    await notifyDiscordAlert({ module: "scheduler", message: "Boom", level: "error" });
    await notifyDiscordAlert({ module: "scheduler", message: "Boom", level: "error" });

    expect(calls.filter((c) => c.url.endsWith("/messages"))).toHaveLength(1);
  });
});
