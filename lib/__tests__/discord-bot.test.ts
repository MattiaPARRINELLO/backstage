import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DISCORD_BOT_TOKEN = "bot-token-test";

// Etat partage du bot, comme le ferait data/discord-bot-state.json
const botState = { lastMessageId: "" };
const sent: string[] = [];
let messages: { id: string; content: string; author: { id: string } }[] = [];

vi.mock("@/lib/storage", () => ({
  readJsonSafe: vi.fn(async (file: string) =>
    file === "discord-bot-state.json" ? { ...botState } : {}
  ),
  writeJsonAtomic: vi.fn(),
}));

// Reproduit mutateJson : lecture du fichier courant, mutator, ecriture seulement
// si le mutator ne renvoie pas null (compare-and-set du curseur).
vi.mock("@/lib/storage-core", () => ({
  mutateJson: vi.fn(async (_file: string, fallback: unknown, mutator: (d: unknown) => unknown) => {
    const data = {
      lastMessageId: botState.lastMessageId || (fallback as { lastMessageId: string }).lastMessageId,
    };
    const result = mutator(data);
    if (result === null) return null;
    botState.lastMessageId = data.lastMessageId;
    return data;
  }),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(async () => ({
    models: { discordBot: "muse-spark-1.3-contributor" },
    features: { discordNotifications: true },
    discord: { userId: "42", alerts: true, bot: true },
  })),
}));

vi.mock("@/lib/ai-providers", () => ({
  chatCompletion: vi.fn(async () => ({
    content: '{"tool":"get_schedule","args":{"scope":"next"}}',
    toolCalls: [],
  })),
}));

vi.mock("@/lib/chat-tools", () => ({
  tools: [
    {
      name: "get_schedule",
      description: "Emploi du temps de l'utilisateur",
      parameters: { type: "object", properties: { scope: { type: "string" } } },
    },
    {
      name: "send_email_response",
      description: "Envoie un email",
      parameters: { type: "object", properties: {} },
    },
  ],
  executeTool: vi.fn(async () => "Prochain cours :\nAnalyse numérique — 10:15 — Amphi B"),
  // runTool renvoie le statut machine en plus du texte.
  runTool: vi.fn(async () => ({
    status: "ok",
    text: "Prochain cours :\nAnalyse numérique — 10:15 — Amphi B",
    rendered: `[OK] Prochain cours :\nAnalyse numérique — 10:15 — Amphi B`,
  })),
  REQUIRE_CONFIRMATION: new Set(["send_email_response"]),
}));

const { extractJsonObject, parseToolChoice, readOnlyCatalog, buildRouterMessages, formatReply } =
  await import("@/lib/discord/agent");
const { pollDiscordOnce, answerIncomingText } = await import("@/lib/discord/bot");
const { resetChannelCache } = await import("@/lib/discord/client");

function stubDiscord() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const target = String(url);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

      if (target.endsWith("/users/@me")) return json({ id: "bot-1" });
      if (target.endsWith("/users/@me/channels")) return json({ id: "chan-1" });
      if (target.includes("/channels/chan-1/messages")) {
        if (init?.method === "POST") {
          sent.push(JSON.parse(String(init.body)).content);
          return json({ id: "msg-1" });
        }
        // Discord ne renvoie que ce qui suit le curseur.
        const after = new URL(target).searchParams.get("after");
        return json(after ? messages.filter((m) => m.id > after) : messages);
      }
      return new Response("not found", { status: 404 });
    })
  );
}

beforeEach(() => {
  botState.lastMessageId = "";
  sent.length = 0;
  messages = [];
  resetChannelCache();
  vi.unstubAllGlobals();
});

describe("parseToolChoice", () => {
  it("lit un choix d'outil en JSON strict", () => {
    expect(parseToolChoice('{"tool":"get_schedule","args":{"scope":"next"}}')).toEqual({
      tool: "get_schedule",
      args: { scope: "next" },
    });
  });

  it("tolère une réponse entourée de texte ou de fences markdown", () => {
    const raw = 'Voici:\n```json\n{"tool":"get_weather","args":{"city":"Paris"}}\n```\nCordialement.';
    expect(parseToolChoice(raw)).toEqual({ tool: "get_weather", args: { city: "Paris" } });
  });

  it("neSyntaxe pas les accolades présentes dans les chaînes", () => {
    const raw = '{"tool":"list_reminders","args":{"note":"a } b","x":1}}';
    expect(parseToolChoice(raw)?.args).toEqual({ note: "a } b", x: 1 });
  });

  it("refuse un outil hors de la whitelist de lecture", () => {
    expect(parseToolChoice('{"tool":"send_email_response","args":{"email_id":"x"}}')).toBeNull();
  });

  it("refuse un nom d'outil inventé", () => {
    expect(parseToolChoice('{"tool":"drop_database","args":{}}')).toBeNull();
  });

  it("renvoie null si le JSON est invalide ou absent", () => {
    expect(parseToolChoice("pas de json ici")).toBeNull();
    expect(parseToolChoice('{"tool":')).toBeNull();
    expect(parseToolChoice('{"args":{}}')).toBeNull();
  });

  it("accepte un objet sans args (tool sans paramètre)", () => {
    expect(parseToolChoice('{"tool":"list_reminders"}')).toEqual({
      tool: "list_reminders",
      args: {},
    });
  });
});

describe("extractJsonObject", () => {
  it("renvoie null sans accolade ouvrante", () => {
    expect(extractJsonObject("rien")).toBeNull();
  });
});

describe("catalogue transmis au routeur", () => {
  it("n'expose que les outils de lecture", () => {
    expect(readOnlyCatalog().map((t) => t.name)).toEqual(["get_schedule"]);
  });

  it("inclut les schémas dans le prompt système", () => {
    const messages = buildRouterMessages("c'est quoi ma salle de maths ?");
    expect(messages[0].content).toContain("get_schedule");
    expect(messages[0].content).not.toContain("send_email_response");
    expect(messages[1].content).toBe("c'est quoi ma salle de maths ?");
  });

  it("borne la longueur du message utilisateur", () => {
    const long = "a".repeat(900);
    const messages = buildRouterMessages(long);
    expect(messages[1]?.content?.length).toBe(500);
  });
});

describe("formatReply", () => {
  it("retire les marqueurs internes", () => {
    expect(formatReply("ACTION_BLOCKED:send_email_response. Confirme.")).toBe(
      "send_email_response. Confirme."
    );
  });
});

describe("pollDiscordOnce", () => {
  it("répond à un nouveau message et avance le curseur", async () => {
    stubDiscord();
    messages = [{ id: "m1", content: "quelle est ma salle ?", author: { id: "42" } }];

    const result = await pollDiscordOnce();

    expect(result.handled).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("Amphi B");
    expect(botState.lastMessageId).toBe("m1");
  });

  it("ignore ses propres messages", async () => {
    stubDiscord();
    messages = [{ id: "m1", content: "Prochain cours : …", author: { id: "bot-1" } }];

    const result = await pollDiscordOnce();

    expect(result.handled).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("ne retraite pas un message déjà traité", async () => {
    stubDiscord();
    messages = [{ id: "m1", content: "salut", author: { id: "42" } }];

    await pollDiscordOnce();
    const second = await pollDiscordOnce();

    expect(second.handled).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("demande le salon au premier tour, puis uniquement ce qui suit le curseur", async () => {
    stubDiscord();
    messages = [{ id: "m1", content: "salut", author: { id: "42" } }];
    await pollDiscordOnce();

    const firstPollUrl = String(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => String(c[0]).includes("/messages") && c[1]?.method !== "POST"
      )?.[0]
    );
    expect(firstPollUrl).not.toContain("after=");

    messages = [{ id: "m2", content: "et maintenant ?", author: { id: "42" } }];
    await pollDiscordOnce();

    const secondPollUrl = String(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => String(c[0]).includes("/messages") && c[1]?.method !== "POST"
      ).at(-1)?.[0]
    );
    expect(secondPollUrl).toContain("after=m1");
  });

  it("conserve le message quand le routeur tombe en panne technique", async () => {
    stubDiscord();
    const { chatCompletion } = await import("@/lib/ai-providers");
    vi.mocked(chatCompletion).mockRejectedValueOnce(new Error("timeout") as never);
    messages = [{ id: "m1", content: "ma salle ?", author: { id: "42" } }];

    const result = await pollDiscordOnce();

    expect(result.handled).toBe(0);
    expect(sent).toHaveLength(0);
    expect(botState.lastMessageId).toBe(""); // rejoué au tour suivant
  });

  it("ne rejoue que le message en echec, pas tout le lot deja traite", async () => {
    stubDiscord();
    const { chatCompletion } = await import("@/lib/ai-providers");
    // Discord renvoie le plus recent d'abord : [m3, m2, m1] est traite dans
    // l'ordre chronologique m1 (succes) puis m2 (le routeur tombe).
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({ content: '{"tool":"get_schedule","args":{}}', toolCalls: [] } as never)
      .mockRejectedValueOnce(new Error("timeout") as never);
    messages = [
      { id: "m3", content: "et la meteo ?", author: { id: "42" } },
      { id: "m2", content: "et mes rappels ?", author: { id: "42" } },
      { id: "m1", content: "ma salle ?", author: { id: "42" } },
    ];

    const result = await pollDiscordOnce();

    expect(result.handled).toBe(1);
    expect(sent).toHaveLength(1);
    // Curseur sur m1 : seul m2 est retente. Revenir a "" aurait rejoue m1
    // (deja traite) et renvoye une deuxieme reponse pour le meme message.
    expect(botState.lastMessageId).toBe("m1");
  });

  it("reste inerte si le bot est désactivé", async () => {
    stubDiscord();
    const { getConfig } = await import("@/lib/config");
    vi.mocked(getConfig).mockResolvedValueOnce({
      models: { discordBot: "muse-spark-1.3-contributor" },
      features: { discordNotifications: true },
      discord: { userId: "42", alerts: true, bot: false },
    } as never);

    const result = await pollDiscordOnce();

    expect(result.handled).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

describe("answerIncomingText", () => {
  it("renvoie une aide quand le routeur ne choisit rien", async () => {
    const { chatCompletion } = await import("@/lib/ai-providers");
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: 'bonjour !',
      toolCalls: [],
    } as never);

    const reply = await answerIncomingText("bonjour");

    expect(reply).toContain("n'ai pas d'outil");
  });

  it("exécute l'outil choisi et renvoie son résultat", async () => {
    const reply = await answerIncomingText("quelle est ma salle ?");
    expect(reply).toContain("Prochain cours");
  });
});