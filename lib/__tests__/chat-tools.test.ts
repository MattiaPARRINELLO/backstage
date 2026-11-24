import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorage = {
  webSearch: vi.fn(),
  addReminder: vi.fn(),
  updateReminder: vi.fn(),
  fetchPageMeta: vi.fn(),
  getConcerts: vi.fn(),
  getAccreditations: vi.fn(),
  getReminders: vi.fn(),
  getMemory: vi.fn(),
  addAccreditation: vi.fn(),
  saveAccreditations: vi.fn(),
  prepareConcert: vi.fn(),
  getWeather: vi.fn(),
  getPhotoShoots: vi.fn(),
  addPhotoShoot: vi.fn(),
  updatePhotoShoot: vi.fn(),
  addIntention: vi.fn(),
  addMemoryFact: vi.fn(),
  findSimilarMemoryFacts: vi.fn(),
  touchMemoryFact: vi.fn(),
  isSafeFetchUrl: vi.fn().mockResolvedValue(true),
};

const mockGoogleActions = {
  fetchGmailMessages: vi.fn(),
  sendGmailReply: vi.fn(),
  createGoogleCalendarEvent: vi.fn(),
  fetchGoogleCalendarEvents: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
};

// get_schedule importe le module schedule dynamiquement
const mockSchedule = {
  getCourses: vi.fn(),
  formatCourse: vi.fn((c: { subject: string; room: string }) => `${c.subject} — ${c.room}`),
  getCoursesForDay: vi.fn(),
  getNextCourse: vi.fn(),
  getUpcomingCourses: vi.fn(),
};

// Le module watch-later est autonome depuis #208 : son store ne passe plus par
// `@/lib/storage`, et son contexte fournit un acces reseau controle.
const mockWatchLater = {
  addWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/storage/schedule", () => mockSchedule);
vi.mock("@/lib/google-actions", () => mockGoogleActions);
vi.mock("@/modules/watch-later/service", () => mockWatchLater);
vi.mock("@/lib/kernel/context", () => ({
  createModuleContext: (moduleId: string) => ({
    moduleId,
    log: () => {},
    emit: () => {},
    activity: vi.fn(),
    ai: {
      complete: async () => "",
      json: async () =>
        JSON.stringify({
          artist: "",
          venue: "",
          concertDate: "",
          status: "pending",
          contactEmail: "",
        }),
    },
    net: { isSafeUrl: async () => true, fetchText: async () => null },
  }),
}));

const {
  executeTool,
  runTool,
  ACTION_BLOCKED_PREFIX,
  toolPolicy,
  tools,
  pendingActionKey,
  registerPendingAction,
  hasPendingAction,
  consumePendingAction,
  clearPendingActions,
} = await import("@/lib/chat-tools");

describe("chat-tools — confirmation des actions IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
    mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
    mockStorage.getConcerts.mockResolvedValue({ events: [] });
    mockStorage.getPhotoShoots.mockResolvedValue({ shoots: [] });
  });

  it("liste les outils exigeant une confirmation (email + memoire)", () => {
    expect(toolPolicy("emails.reply").requiresConfirmation).toBe(true);
    expect(toolPolicy("send_email_response").requiresConfirmation).toBe(true);
    // Exception permanente : un fait piege est reinjecte dans le prompt des
    // tours suivants, donc add_memory_fact est gate lui aussi.
    expect(toolPolicy("add_memory_fact").requiresConfirmation).toBe(true);
    // Calendrier, rappels, scan, lectures : exécution directe sans confirmation.
    expect(toolPolicy("calendar.create").requiresConfirmation).toBe(false);
    expect(toolPolicy("calendar.update").requiresConfirmation).toBe(false);
    expect(toolPolicy("calendar.delete").requiresConfirmation).toBe(false);
    expect(toolPolicy("schedule_followup").requiresConfirmation).toBe(false);
    // Le scan des accréditations (analyse d'emails) et les lectures seules ne
    // demandent pas de confirmation.
    expect(toolPolicy("accreditations.scan").requiresConfirmation).toBe(false);
    // Les lectures seules ne demandent pas de confirmation.
    expect(toolPolicy("web_search").requiresConfirmation).toBe(false);
    expect(toolPolicy("list_reminders").requiresConfirmation).toBe(false);
  });

  it("déclare confirmable exactement ce que le chat peut mettre en attente", () => {
    // La politique est dérivée de la déclaration : toute écriture et toute
    // action qui exige une confirmation reste déblocable par l'utilisateur.
    for (const tool of tools) {
      const policy = toolPolicy(tool.name);
      if (policy.write || policy.requiresConfirmation) {
        expect(policy.confirmable, tool.name).toBe(true);
      }
    }
    // Les lectures ne deviennent jamais confirmables : pas de porte
    // d'exécution arbitraire via /api/chat/confirm[-batch].
    expect(toolPolicy("web_search").confirmable).toBe(false);
    expect(toolPolicy("list_reminders").confirmable).toBe(false);
  });

  it("bloque l'envoi d'email sans confirmation et n'exécute pas l'action", async () => {
    mockGoogleActions.sendGmailReply.mockResolvedValue("msg-1");
    const result = await executeTool("send_email_response", {
      email_id: "abc",
      response_text: "Bonjour",
    });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(true);
    expect(mockGoogleActions.sendGmailReply).not.toHaveBeenCalled();
  });

  it("exécute l'action quand la confirmation est fournie", async () => {
    mockGoogleActions.sendGmailReply.mockResolvedValue("msg-1");
    const result = await executeTool(
      "send_email_response",
      { email_id: "abc", response_text: "Bonjour" },
      true
    );
    expect(result).toContain("msg-1");
    expect(mockGoogleActions.sendGmailReply).toHaveBeenCalledWith("abc", "Bonjour");
  });

  it("exécute la création d'événement calendrier sans confirmation", async () => {
    mockGoogleActions.createGoogleCalendarEvent.mockResolvedValue("evt-1");
    const result = await executeTool("calendar.create", {
      title: "Réunion",
      start_time: "2026-08-10T10:00:00Z",
      end_time: "2026-08-10T11:00:00Z",
    });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockGoogleActions.createGoogleCalendarEvent).toHaveBeenCalledWith(
      "Réunion",
      "2026-08-10T10:00:00Z",
      "2026-08-10T11:00:00Z",
      undefined,
      undefined,
      undefined
    );
  });

  it("exécute la suppression d'événement calendrier sans confirmation", async () => {
    mockGoogleActions.deleteGoogleCalendarEvent.mockResolvedValue(undefined);
    const result = await executeTool("calendar.delete", { event_id: "evt-1" });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockGoogleActions.deleteGoogleCalendarEvent).toHaveBeenCalledWith("evt-1");
  });

  it("n'exécute pas un outil de lecture sans confirmation (aucun blocage)", async () => {
    mockStorage.webSearch.mockResolvedValue("Résultats");
    const result = await executeTool("web_search", { query: "test" });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockStorage.webSearch).toHaveBeenCalledWith("test");
  });

  it("exécute le scan des accréditations sans confirmation (analyse d'emails)", async () => {
    // Un email sans artiste détecté : le scan aboutit quand même (déclenché
    // immédiatement, jamais bloqué en attente de confirmation).
    mockGoogleActions.fetchGmailMessages.mockResolvedValue([
      { id: "m1", from: "a@b.fr", subject: "Re: accreditation", date: "2026-08-20", snippet: "confirme le pass presse" },
    ]);
    const result = await executeTool("accreditations.scan", {});
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(result).toContain("Scan termine");
    expect(mockGoogleActions.fetchGmailMessages).toHaveBeenCalled();
  });
});


describe("chat-tools — verification des ecritures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("add_watch_later confirme l'ecriture par relecture", async () => {
    mockWatchLater.addWatchLaterItem.mockResolvedValue({
      id: "w1",
      title: "Un article",
      source: "example.com",
    });
    mockWatchLater.getWatchLater.mockResolvedValue({ items: [{ id: "w1" }] });

    const out = await executeTool("add_watch_later", {
      url: "https://example.com/article",
      title: "Un article",
    });

    expect(out).toContain("A voir plus tard");
  });

  it("add_watch_later signale un echec si la relecture ne retrouve pas le lien", async () => {
    // Ecriture silencieusement perdue : sans verification, l'agent annoncerait
    // « ajoute » alors que rien n'existe.
    mockWatchLater.addWatchLaterItem.mockResolvedValue({
      id: "w1",
      title: "Un article",
      source: "example.com",
    });
    mockWatchLater.getWatchLater.mockResolvedValue({ items: [] });

    const out = await executeTool("add_watch_later", {
      url: "https://example.com/article",
      title: "Un article",
    });

    expect(out).toContain("ecriture non confirmee");
    expect(out.startsWith("Erreur")).toBe(true);
  });

  it("add_memory_fact retombe sur life si la categorie manque", async () => {
    // Parite avec l'ancien dispatch : une categorie absente ne doit pas
    // echanger une memorisation contre une erreur de validation.
    const { addMemoryFactTool } = await import("@/lib/kernel/core-tools");
    expect(addMemoryFactTool.params.parse({ content: "un fait" })).toEqual({
      content: "un fait",
      category: "life",
    });
  });

  it("add_memory_fact dedoublonne un fait deja connu au lieu de le recreer", async () => {
    // Sans dedoublonnage, le modele sature la memoire de doublons.
    mockStorage.findSimilarMemoryFacts.mockResolvedValue({
      id: "f1",
      content: "Utilise TypeScript",
      category: "dev",
      createdAt: "",
    });

    const out = await executeTool("add_memory_fact", {
      content: "Utilise TypeScript au quotidien",
      category: "dev",
    }, true);

    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
    expect(mockStorage.touchMemoryFact).toHaveBeenCalledWith("f1");
    // Rien de nouveau ecrit : le texte ne doit pas ressembler a un succes.
    expect(out).toContain("deja en memoire");
    expect(out).not.toContain("Fait memorise");
  });

  it("add_memory_fact enregistre un fait enrichi au lieu de le perdre dans le dedoublonnage", async () => {
    // Cas reel : « retiens que je bosse avec Rapstar, mon portfolio c'est
    // photo.mprnl.fr » ne doit pas etre absorbe par « Est photographe live &
    // concert » sous pretexte que les deux parlent de photo.
    mockStorage.findSimilarMemoryFacts.mockResolvedValue({
      id: "f1",
      content: "Est photographe live & concert",
      category: "photo",
      createdAt: "",
    });
    mockStorage.addMemoryFact.mockResolvedValue({
      id: "f9",
      content: "Collaboré avec Rapstar (@rapstar_france, ~21k abonnés)",
      category: "photo",
      createdAt: "",
    });
    mockStorage.getMemory.mockResolvedValue({
      facts: [{ id: "f9" }],
      relationships: [],
      profile: { name: "Mattia", preferences: [] },
    });

    const out = await executeTool("add_memory_fact", {
      content: "Collaboré avec Rapstar (@rapstar_france, ~21k abonnés)",
      category: "photo",
    }, true);

    expect(mockStorage.addMemoryFact).toHaveBeenCalledWith(
      "Collaboré avec Rapstar (@rapstar_france, ~21k abonnés)",
      "photo",
      { source: "tool" }
    );
    expect(out).toContain("Fait memorise");
  });

  it("add_memory_fact cree le fait avec la source tool", async () => {
    mockStorage.findSimilarMemoryFacts.mockResolvedValue(null);
    mockStorage.addMemoryFact.mockResolvedValue({
      id: "f2",
      content: "Aime photographier en 35mm",
      category: "photo",
      createdAt: "",
    });
    mockStorage.getMemory.mockResolvedValue({ facts: [{ id: "f2" }], relationships: [], profile: { name: "Mattia", preferences: [] } });

    const out = await executeTool("add_memory_fact", {
      content: "Aime photographier en 35mm",
      category: "photo",
    }, true);

    expect(mockStorage.addMemoryFact).toHaveBeenCalledWith("Aime photographier en 35mm", "photo", { source: "tool" });
    expect(out).toContain("Fait memorise");
  });

  it("add_memory_fact refuse un contenu vide", async () => {
    const out = await executeTool("add_memory_fact", { content: "   ", category: "dev" }, true);
    expect(out.startsWith("Erreur")).toBe(true);
    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
  });

  it("bloque add_memory_fact sans confirmation", async () => {
    const out = await executeTool("add_memory_fact", {
      content: "Aime photographier en 35mm",
      category: "photo",
    });
    expect(out.startsWith(ACTION_BLOCKED_PREFIX)).toBe(true);
    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
  });

  it("runTool renvoie le statut machine du resultat", async () => {
    mockWatchLater.addWatchLaterItem.mockResolvedValue({
      id: "w1",
      title: "Un article",
      source: "example.com",
    });
    mockWatchLater.getWatchLater.mockResolvedValue({ items: [{ id: "w1" }] });

    const run = await runTool("add_watch_later", {
      url: "https://example.com/article",
      title: "Un article",
    });

    expect(run.status).toBe("ok");
    expect(run.rendered.startsWith("[OK]")).toBe(true);
  });

  it("runTool propage une exception en statut error", async () => {
    mockWatchLater.addWatchLaterItem.mockRejectedValue(new Error("disque plein"));

    const run = await runTool("add_watch_later", {
      url: "https://example.com/article",
      title: "Un article",
    });

    expect(run.status).toBe("error");
    expect(run.rendered).toContain("disque plein");
  });
});

describe("chat-tools — get_schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedule.getCourses.mockResolvedValue([{ uuid: "u1", subject: "Analyse", room: "Amphi B" }]);
    mockSchedule.getUpcomingCourses.mockReturnValue([]);
    mockSchedule.getNextCourse.mockReturnValue({ uuid: "u1", subject: "Analyse", room: "Amphi B" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scope=tomorrow interroge le lendemain, pas la semaine", async () => {
    mockSchedule.getCoursesForDay.mockReturnValue([]);

    const out = await executeTool("get_schedule", { scope: "tomorrow" });

    expect(mockSchedule.getCoursesForDay).toHaveBeenCalledWith(expect.anything(), "2026-10-02");
    expect(out).toBe("Pas de cours demain.");
  });

  it("scope=tomorrow liste les seances du lendemain", async () => {
    mockSchedule.getCoursesForDay.mockReturnValue([
      { uuid: "u1", subject: "Analyse", room: "Amphi B" },
    ]);

    const out = await executeTool("get_schedule", { scope: "tomorrow" });

    expect(mockSchedule.getCoursesForDay).toHaveBeenCalledWith(expect.anything(), "2026-10-02");
    expect(out).toContain("Cours vendredi 2 octobre");
    expect(out).toContain("Analyse — Amphi B");
  });

  it("scope=next reste le defaut quand aucun scope n'est fourni", async () => {
    const out = await executeTool("get_schedule", {});

    expect(mockSchedule.getNextCourse).toHaveBeenCalled();
    expect(out).toContain("Prochain cours");
  });
});

describe("chat-tools — politique des outils de module", () => {
  it("derive la politique d'un outil de module depuis le registre", async () => {
    const { toolPolicy } = await import("@/lib/chat-tools");
    const policy = toolPolicy("reminders.add");
    expect(policy.write).toBe(true);
    expect(policy.confirmable).toBe(true);
    expect(policy.untrusted).toBe(false);
  });

  it("applique la meme politique a l'ancien nom d'outil", async () => {
    const { toolPolicy } = await import("@/lib/chat-tools");
    expect(toolPolicy("add_reminder")).toEqual(toolPolicy("reminders.add"));
  });

  it("une lecture de module n'est ni confirmable ni ecrite", async () => {
    const { toolPolicy } = await import("@/lib/chat-tools");
    const policy = toolPolicy("reminders.list");
    expect(policy.write).toBe(false);
    expect(policy.confirmable).toBe(false);
  });
});

describe("chat-tools — registre des actions en attente", () => {
  let now = 1_700_000_000_000;

  beforeEach(() => {
    clearPendingActions();
    now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearPendingActions();
  });

  it("calcule une cle canonique insensible a l'ordre des cles et aux undefined", () => {
    const a = pendingActionKey("send_email_response", {
      email_id: "a",
      response_text: "ok",
    });
    const b = pendingActionKey("send_email_response", {
      response_text: "ok",
      email_id: "a",
      inutile: undefined,
    });
    expect(a).toBe(b);
    expect(pendingActionKey("web_search", { query: "x" })).not.toBe(a);
  });

  it("ne confond pas deux valeurs differentes", () => {
    expect(
      pendingActionKey("send_email_response", { email_id: "a", response_text: "ok" })
    ).not.toBe(
      pendingActionKey("send_email_response", { email_id: "b", response_text: "ok" })
    );
  });

  it("conserve la raison et ne consomme qu'une seule fois", () => {
    registerPendingAction("send_email_response", { email_id: "a" }, "provenance");
    expect(hasPendingAction("send_email_response", { email_id: "a" })).toBe(true);
    expect(consumePendingAction("send_email_response", { email_id: "a" })).toBe("provenance");
    expect(hasPendingAction("send_email_response", { email_id: "a" })).toBe(false);
    expect(consumePendingAction("send_email_response", { email_id: "a" })).toBeNull();
  });

  it("applique la raison policy par defaut", () => {
    registerPendingAction("send_email_response", { email_id: "a" });
    expect(consumePendingAction("send_email_response", { email_id: "a" })).toBe("policy");
  });

  it("expire une action apres 15 minutes", () => {
    registerPendingAction("send_email_response", { email_id: "a" });
    now += 15 * 60 * 1000 - 1;
    expect(hasPendingAction("send_email_response", { email_id: "a" })).toBe(true);
    now += 1;
    expect(hasPendingAction("send_email_response", { email_id: "a" })).toBe(false);
    expect(consumePendingAction("send_email_response", { email_id: "a" })).toBeNull();
  });

  it("plafonne le registre a 50 entrees en evacuant la plus ancienne", () => {
    for (let i = 0; i < 50; i++) {
      registerPendingAction("send_email_response", { email_id: `id-${i}` });
    }
    expect(hasPendingAction("send_email_response", { email_id: "id-0" })).toBe(true);
    registerPendingAction("send_email_response", { email_id: "id-50" });
    expect(hasPendingAction("send_email_response", { email_id: "id-0" })).toBe(false);
    expect(hasPendingAction("send_email_response", { email_id: "id-50" })).toBe(true);
  });

  it("purge les entrees expirees lors d'un nouvel enregistrement", () => {
    for (let i = 0; i < 50; i++) {
      registerPendingAction("send_email_response", { email_id: `id-${i}` });
    }
    now += 15 * 60 * 1000;
    registerPendingAction("send_email_response", { email_id: "neuf" });
    // Les 50 autres ont expiré : le plafond ne les compte plus.
    expect(hasPendingAction("send_email_response", { email_id: "neuf" })).toBe(true);
    expect(hasPendingAction("send_email_response", { email_id: "id-49" })).toBe(false);
  });
});

describe("chat-tools — statut de fetch_and_search_emails", () => {
  const message = (snippet: string) => ({
    id: "m1",
    threadId: "t1",
    from: "facturation@exemple.fr",
    to: "moi@exemple.fr",
    subject: "Erreur de facturation, abonnement expire",
    date: "Tue, 10 Nov 2026 10:00:00 +0000",
    snippet,
    body: snippet,
    unread: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reste ok quand un email legitime contient un mot d'echec", async () => {
    // Cause racine de #47 : ERROR_PATTERN cherchait « erreur » n'importe ou,
    // y compris dans le sujet ou l'extrait d'un mail. Le statut doit venir du
    // resultat de l'appel Gmail, pas du contenu externe.
    mockGoogleActions.fetchGmailMessages.mockResolvedValue([
      message("Le paiement a echoue : erreur 500, token expire."),
    ]);

    const result = await runTool("fetch_and_search_emails", { query: "facture" });

    expect(result.status).toBe("ok");
    expect(result.rendered.startsWith("[OK]")).toBe(true);
    expect(result.text).toContain("Erreur de facturation");
  });

  it("classe un lot vide en empty, jamais en error", async () => {
    mockGoogleActions.fetchGmailMessages.mockResolvedValue([]);

    const result = await runTool("fetch_and_search_emails", { query: "inexistant" });

    expect(result.status).toBe("empty");
    expect(result.rendered.startsWith("[VIDE]")).toBe(true);
  });

  it("classe un token OAuth expire en error avec le message fourni", async () => {
    mockGoogleActions.fetchGmailMessages.mockRejectedValue(
      new Error("Google access token manquant. Reconnecte ton compte Google.")
    );

    const result = await runTool("fetch_and_search_emails", {});

    expect(result.status).toBe("error");
    expect(result.text).toContain("Reconnecte ton compte Google");
  });

  it("classe un quota Gmail depasse (429) en error", async () => {
    mockGoogleActions.fetchGmailMessages.mockRejectedValue(
      new Error("Google API error 429: quota exceeded")
    );

    const result = await runTool("fetch_and_search_emails", {});

    expect(result.status).toBe("error");
    expect(result.text).toContain("429");
  });
});

describe("chat-tools — classement provenance des outils", () => {
  it("classe les lectures externes comme non fiables", async () => {
    // Meteo, GitHub, recherche web, concerts, calendrier et emails ont migre :
    // la provenance vient du manifeste.
    const { toolPolicy } = await import("@/lib/chat-tools");
    expect(toolPolicy("weather.get").untrusted).toBe(true);
    expect(toolPolicy("get_weather").untrusted).toBe(true);
    expect(toolPolicy("github.list_issues").untrusted).toBe(true);
    expect(toolPolicy("list_github_issues").untrusted).toBe(true);
    expect(toolPolicy("web.search").untrusted).toBe(true);
    expect(toolPolicy("web.page_meta").untrusted).toBe(true);
    expect(toolPolicy("web_search").untrusted).toBe(true);
    expect(toolPolicy("concerts.list").untrusted).toBe(true);
    expect(toolPolicy("concerts.prepare").untrusted).toBe(true);
    expect(toolPolicy("calendar.search").untrusted).toBe(true);
    expect(toolPolicy("search_calendar_events").untrusted).toBe(true);
    expect(toolPolicy("emails.search").untrusted).toBe(true);
    expect(toolPolicy("fetch_and_search_emails").untrusted).toBe(true);
    expect(toolPolicy("emails.triage").untrusted).toBe(true);
    expect(toolPolicy("triage_emails").untrusted).toBe(true);
    // Lecture de donnees locales : fiable.
    expect(toolPolicy("reminders.list").untrusted).toBe(false);
    expect(toolPolicy("get_schedule").untrusted).toBe(false);
  });

  it("classe toutes les ecritures, d'ou qu'elles viennent", async () => {
    const { toolPolicy } = await import("@/lib/chat-tools");
    // Les trois premiers vivent dans un module ; les suivants dans le noyau.
    // `toolPolicy` est la seule question a poser, la reponse ne depend plus de
    // l'origine de l'outil.
    for (const name of [
      "reminders.add",
      "reminders.update",
      "add_memory_fact",
      "add_watch_later",
      "photo.add",
      "photo.update",
      "accreditations.scan",
    ]) {
      expect(toolPolicy(name).write, name).toBe(true);
      expect(toolPolicy(name).confirmable, name).toBe(true);
    }
    // L'envoi d'email est external et confirme : confirmable, non ecriture.
    expect(toolPolicy("emails.reply").write).toBe(false);
    expect(toolPolicy("emails.reply").confirmable).toBe(true);
    expect(toolPolicy("emails.reply").requiresConfirmation).toBe(true);
    // La creation d'issue est external, confirmable, mais non confirmee par
    // defaut : le module a retire la confirmation (comportement historique).
    expect(toolPolicy("github.create_issue").write).toBe(false);
    expect(toolPolicy("github.create_issue").confirmable).toBe(true);
    expect(toolPolicy("github.create_issue").requiresConfirmation).toBe(false);
    // Les ecritures calendrier sont external : confirmables par provenance,
    // sans confirmation permanente (comportement historique).
    for (const name of ["calendar.create", "calendar.update", "calendar.delete"]) {
      expect(toolPolicy(name).write, name).toBe(false);
      expect(toolPolicy(name).confirmable, name).toBe(true);
      expect(toolPolicy(name).requiresConfirmation, name).toBe(false);
    }
    // Une relance est une ecriture de module : confirmable par provenance.
    expect(toolPolicy("followups.schedule").write).toBe(true);
    expect(toolPolicy("schedule_followup").write).toBe(true);
    // prepare ne fait que lire (meteo + infos salle).
    expect(toolPolicy("concerts.prepare").write).toBe(false);
  });
});
