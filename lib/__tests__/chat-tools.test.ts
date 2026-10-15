import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorage = {
  webSearch: vi.fn(),
  addReminder: vi.fn(),
  updateReminder: vi.fn(),
  addWatchLaterItem: vi.fn(),
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

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/storage/schedule", () => mockSchedule);
vi.mock("@/lib/google-actions", () => mockGoogleActions);

const { executeTool, runTool, REQUIRE_CONFIRMATION, ACTION_BLOCKED_PREFIX } = await import("@/lib/chat-tools");

describe("chat-tools — confirmation des actions IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
    mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
    mockStorage.getConcerts.mockResolvedValue({ events: [] });
    mockStorage.getPhotoShoots.mockResolvedValue({ shoots: [] });
  });

  it("liste les outils exigeant une confirmation (uniquement l'envoi d'emails)", () => {
    expect(REQUIRE_CONFIRMATION.has("send_email_response")).toBe(true);
    // Calendrier, rappels, scan, lectures : exécution directe sans confirmation.
    expect(REQUIRE_CONFIRMATION.has("create_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("update_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("delete_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("schedule_followup")).toBe(false);
    // Le scan des accréditations (analyse d'emails) et les lectures seules ne
    // demandent pas de confirmation.
    expect(REQUIRE_CONFIRMATION.has("scan_accreditations")).toBe(false);
    // Les lectures seules ne demandent pas de confirmation.
    expect(REQUIRE_CONFIRMATION.has("web_search")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("list_reminders")).toBe(false);
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
    const result = await executeTool("create_calendar_event", {
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
    const result = await executeTool("delete_calendar_event", { event_id: "evt-1" });
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
    const result = await executeTool("scan_accreditations", {});
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(result).toContain("Scan termine");
    expect(mockGoogleActions.fetchGmailMessages).toHaveBeenCalled();
  });
});


describe("chat-tools — verification des ecritures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("add_reminder confirme l'ecriture par relecture", async () => {
    mockStorage.addReminder.mockResolvedValue({
      id: "r1",
      title: "Envoyer le devis",
      dueAt: "2026-10-20T10:00:00.000Z",
      status: "pending",
    });
    mockStorage.getReminders.mockResolvedValue({ reminders: [{ id: "r1" }] });

    const out = await executeTool("add_reminder", { title: "Envoyer le devis", due_at: "2026-10-20T10:00:00.000Z" });

    expect(out).toContain("Rappel cree");
  });

  it("add_reminder signale un echec si la relecture ne retrouve pas le rappel", async () => {
    // Ecriture silencieusement perdue : sans verification, l'agent annoncerait
    // « rappel cree » alors qu'aucun rappel n'existe.
    mockStorage.addReminder.mockResolvedValue({
      id: "r1",
      title: "Envoyer le devis",
      dueAt: "2026-10-20T10:00:00.000Z",
      status: "pending",
    });
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });

    const out = await executeTool("add_reminder", { title: "Envoyer le devis", due_at: "2026-10-20T10:00:00.000Z" });

    expect(out).toContain("ecriture non confirmee");
    expect(out.startsWith("Erreur")).toBe(true);
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
    });

    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
    expect(mockStorage.touchMemoryFact).toHaveBeenCalledWith("f1");
    expect(out).toContain("deja connu");
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
    });

    expect(mockStorage.addMemoryFact).toHaveBeenCalledWith("Aime photographier en 35mm", "photo", { source: "tool" });
    expect(out).toContain("Fait memorise");
  });

  it("add_memory_fact refuse un contenu vide", async () => {
    const out = await executeTool("add_memory_fact", { content: "   ", category: "dev" });
    expect(out.startsWith("Erreur")).toBe(true);
    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
  });

  it("runTool renvoie le statut machine du resultat", async () => {
    mockStorage.addReminder.mockResolvedValue({
      id: "r1",
      title: "Rappel",
      dueAt: "2026-10-20T10:00:00.000Z",
      status: "pending",
    });
    mockStorage.getReminders.mockResolvedValue({ reminders: [{ id: "r1" }] });

    const run = await runTool("add_reminder", { title: "Rappel", due_at: "2026-10-20T10:00:00.000Z" });

    expect(run.status).toBe("ok");
    expect(run.rendered.startsWith("[OK]")).toBe(true);
  });

  it("runTool propage une exception en statut error", async () => {
    mockStorage.addReminder.mockRejectedValue(new Error("disque plein"));

    const run = await runTool("add_reminder", { title: "Rappel", due_at: "2026-10-20T10:00:00.000Z" });

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
