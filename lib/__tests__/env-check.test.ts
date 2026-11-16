import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkDevEnv } from "../env-check";

function stubBaseEnv() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://ai.example.com/v1");
  vi.stubEnv("IA_API_KEY", "secret-api-key");
  vi.stubEnv("AUTH_SECRET", "secret-auth-value");
  vi.stubEnv("WEBAUTHN_RP_ID", "localhost");
  vi.stubEnv("WEBAUTHN_ORIGIN", "http://localhost:3000");
  vi.stubEnv("SETUP_TOKEN", "setup-secret");
  vi.stubEnv("AI_PROVIDER", "");
}

beforeEach(() => {
  stubBaseEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkDevEnv", () => {
  it("ne signale rien quand la configuration est complete", () => {
    expect(checkDevEnv()).toEqual([]);
  });

  it("signale NEXT_PUBLIC_API_URL absent sans AI_PROVIDER=mock", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("NEXT_PUBLIC_API_URL");
    expect(problems[0]).toContain("provider IA");
  });

  it("signale IA_API_KEY absent sans AI_PROVIDER=mock", () => {
    vi.stubEnv("IA_API_KEY", "");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("IA_API_KEY");
  });

  it("ignore la configuration IA en mode mock", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("IA_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(checkDevEnv()).toEqual([]);
  });

  it("signale AUTH_SECRET absent", () => {
    vi.stubEnv("AUTH_SECRET", "");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("AUTH_SECRET");
    expect(problems[0]).toContain("bun run setup");
  });

  it("signale WEBAUTHN_ORIGIN qui ne commence pas par http", () => {
    vi.stubEnv("WEBAUTHN_ORIGIN", "backstage.example.com");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("WEBAUTHN_ORIGIN");
    expect(problems[0]).toContain("http://");
  });

  it("signale WEBAUTHN_ORIGIN absent", () => {
    vi.stubEnv("WEBAUTHN_ORIGIN", "");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("WEBAUTHN_ORIGIN");
  });

  it("signale une origine qui ne contient pas WEBAUTHN_RP_ID", () => {
    vi.stubEnv("WEBAUTHN_ORIGIN", "https://autre.example.com");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("WEBAUTHN_RP_ID");
  });

  it("avertit pour SETUP_TOKEN absent en production seulement", () => {
    vi.stubEnv("SETUP_TOKEN", "");

    expect(checkDevEnv()).toEqual([]);

    vi.stubEnv("NODE_ENV", "production");
    const problems = checkDevEnv();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("SETUP_TOKEN");
    expect(problems[0]).toContain("503");
  });

  it("n'expose jamais la valeur des secrets dans les messages", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SETUP_TOKEN", "");
    vi.stubEnv("IA_API_KEY", "");
    vi.stubEnv("AUTH_SECRET", "");

    const joined = checkDevEnv().join("\n");
    expect(joined).not.toContain("secret-auth-value");
    expect(joined).not.toContain("secret-api-key");
    expect(joined).not.toContain("setup-secret");
  });
});
