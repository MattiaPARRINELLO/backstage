import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const { apiRoute, authedRoute, errorResponse } = await import("@/lib/route");
const { AppError } = await import("@/lib/errors");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockResolvedValue({ userId: "owner" });
});

describe("apiRoute", () => {
  it("traduit une AppError en statut et code", async () => {
    const POST = apiRoute(async (): Promise<Response> => {
      throw new AppError("not_found", "Rappel introuvable");
    });

    const response = await POST();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Rappel introuvable", code: "not_found" });
  });

  it("masque le message technique d'une erreur inconnue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const POST = apiRoute(async (): Promise<Response> => {
      throw new Error("ECONNREFUSED 127.0.0.1:5432");
    });

    const response = await POST();
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe("internal");
    expect(body.error).not.toContain("ECONNREFUSED");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("authedRoute", () => {
  it("refuse sans session avec le code unauthenticated", async () => {
    mockRequireSession.mockRejectedValue(new AppError("unauthenticated", "Non authentifié"));
    const handler = vi.fn();
    const POST = authedRoute(handler);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("transmet la session au handler", async () => {
    const POST = authedRoute(async (session) => Response.json({ userId: session.userId }));

    expect(await (await POST()).json()).toEqual({ userId: "owner" });
  });
});

describe("errorResponse", () => {
  it("marque une dependance externe indisponible en 503", async () => {
    const response = errorResponse(new AppError("external_unavailable", "Gmail indisponible"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "external_unavailable" });
  });
});
