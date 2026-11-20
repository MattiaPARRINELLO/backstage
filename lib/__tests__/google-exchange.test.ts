import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  exchangeAuthorizationCode,
  GOOGLE_CODE_TIMEOUT_MS,
} from "../google-client";
import { jsonResponse, withHttpDouble } from "@/lib/http-double";

const ORIGINAL_ENV = { ...process.env };
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function tokenRoute(body: unknown, status = 200) {
  return [{ match: TOKEN_URL, response: jsonResponse(body, { status }) }];
}

describe("exchangeAuthorizationCode", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("should return tokens with a computed expiry", async () => {
    await withHttpDouble(
      tokenRoute({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
      async () => {
        const tokens = await exchangeAuthorizationCode("the-code", "https://app/cb");
        expect(tokens.access_token).toBe("at");
        expect(tokens.refresh_token).toBe("rt");
        expect(tokens.expiry_date).toBeGreaterThan(Date.now());
        expect(tokens.expiry_date).toBeLessThan(Date.now() + 4000 * 1000);
      }
    );
  });

  it("should throw a clean error when Google refuses the code", async () => {
    await withHttpDouble(
      tokenRoute({ error: "invalid_grant", error_description: "Code déjà utilisé" }, 400),
      async () => {
        await expect(exchangeAuthorizationCode("used-code", "https://app/cb")).rejects.toThrow(
          "Échange du code Google refusé : Code déjà utilisé"
        );
      }
    );
  });

  it("should send the code with a firm timeout signal (no silent hang)", async () => {
    await withHttpDouble(
      tokenRoute({ access_token: "at", refresh_token: "rt", expires_in: 300 }),
      async (double) => {
        await exchangeAuthorizationCode("c", "https://app/cb");

        const init = double.calls[0]?.init;
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(AbortSignal.timeout).toBeDefined();
        expect(GOOGLE_CODE_TIMEOUT_MS).toBeGreaterThan(0);
      }
    );
  });

  it("should pass exactly one grant_type=authorization_code body", async () => {
    await withHttpDouble(
      tokenRoute({ access_token: "at", refresh_token: "rt", expires_in: 300 }),
      async (double) => {
        await exchangeAuthorizationCode("c", "https://app/cb");

        const body = double.calls[0]?.init.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("code")).toBe("c");
        expect(body.get("redirect_uri")).toBe("https://app/cb");
      }
    );
  });
});
