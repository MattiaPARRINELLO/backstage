import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockIsAuthorizedCron = vi.fn();
vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCron: mockIsAuthorizedCron }));

const mockJob = vi.fn();
const mockJobs: Array<{ moduleId: string; job: { id: string; cron: string } }> = [];
vi.mock("@/lib/kernel/registry", () => ({
  registry: { job: mockJob, jobs: mockJobs },
}));

const mockContext = { moduleId: "reminders" };
const mockCreateModuleContext = vi.fn(() => mockContext);
vi.mock("@/lib/kernel/context", () => ({
  createModuleContext: mockCreateModuleContext,
}));

const mockServerLog = vi.fn();
vi.mock("@/lib/logger", () => ({ serverLog: mockServerLog }));

const { POST } = await import("@/app/api/cron/[job]/route");
const { GET } = await import("@/app/api/cron/route");

function makeRequest(path = "/api/cron/reminders", method = "POST"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method });
}

function call(job: string, request = makeRequest()) {
  return POST(request, { params: Promise.resolve({ job }) });
}

describe("POST /api/cron/[job]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs.length = 0;
    mockIsAuthorizedCron.mockReturnValue(true);
    mockJob.mockReturnValue(undefined);
  });

  it("refuse sans secret cron valide (401)", async () => {
    mockIsAuthorizedCron.mockReturnValue(false);
    const res = await call("reminders");
    expect(res.status).toBe(401);
    expect(mockJob).not.toHaveBeenCalled();
  });

  it("repond 404 pour un job inconnu", async () => {
    const res = await call("inconnu");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Job inconnu" });
  });

  it("repond 404 pour un job d'un module desactive", async () => {
    // Le registre ne contient que les modules actives : un job desactive est
    // indiscernable d'un job inconnu, et c'est voulu.
    const res = await call("daily-brief");
    expect(res.status).toBe(404);
  });

  it("execute le handler une fois et repond success", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    mockJob.mockReturnValue({
      moduleId: "reminders",
      job: { id: "reminders", cron: "* * * * *", handler },
    });

    const res = await call("reminders");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(mockContext);
  });

  it("repond 500 et journalise quand le handler leve", async () => {
    const error = new Error("boom");
    mockJob.mockReturnValue({
      moduleId: "reminders",
      job: { id: "reminders", cron: "* * * * *", handler: vi.fn().mockRejectedValue(error) },
    });

    const res = await call("reminders");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
    expect(mockServerLog).toHaveBeenCalledWith(
      "cron/reminders",
      "error",
      "Echec du job",
      error
    );
  });
});

describe("GET /api/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs.length = 0;
    mockIsAuthorizedCron.mockReturnValue(true);
  });

  it("refuse sans secret cron valide (401)", async () => {
    mockIsAuthorizedCron.mockReturnValue(false);
    const res = await GET(makeRequest("/api/cron", "GET"));
    expect(res.status).toBe(401);
  });

  it("liste les jobs des modules actives, sans nom en dur", async () => {
    mockJobs.push(
      { moduleId: "reminders", job: { id: "reminders", cron: "* * * * *" } },
      { moduleId: "daily-brief", job: { id: "daily-brief", cron: "0 7 * * *" } }
    );
    const res = await GET(makeRequest("/api/cron", "GET"));
    expect(await res.json()).toEqual([
      { id: "reminders", cron: "* * * * *", moduleId: "reminders" },
      { id: "daily-brief", cron: "0 7 * * *", moduleId: "daily-brief" },
    ]);
  });
});
