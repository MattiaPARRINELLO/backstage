import { describe, expect, it } from "vitest";

import {
  AppError,
  ERROR_CODES,
  errorLabel,
  errorStatus,
  isAppError,
  toErrorPayload,
} from "@/lib/errors";

describe("taxonomie d'erreurs", () => {
  it("associe un statut HTTP a chaque code", () => {
    expect(ERROR_CODES.map((code) => errorStatus(code))).toEqual([401, 403, 404, 400, 503, 500]);
  });

  it("donne un libelle francais non vide pour chaque code", () => {
    for (const code of ERROR_CODES) {
      expect(errorLabel(code).trim().length, code).toBeGreaterThan(0);
    }
  });

  it("reconnait une AppError et conserve son code", () => {
    const error = new AppError("not_found", "Rappel introuvable");

    expect(isAppError(error)).toBe(true);
    expect(toErrorPayload(error)).toEqual({
      code: "not_found",
      message: "Rappel introuvable",
      status: 404,
    });
  });

  it("ne divulgue jamais le message technique d'une erreur inconnue", () => {
    const payload = toErrorPayload(new Error("ECONNREFUSED 127.0.0.1:5432"));

    expect(payload.code).toBe("internal");
    expect(payload.status).toBe(500);
    expect(payload.message).not.toContain("ECONNREFUSED");
  });

  it("traduit une ZodError en validation", () => {
    const zodLike = new Error("invalide");
    zodLike.name = "ZodError";

    expect(toErrorPayload(zodLike).code).toBe("validation");
    expect(toErrorPayload(zodLike).status).toBe(400);
  });
});
