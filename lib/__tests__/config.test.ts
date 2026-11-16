import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertStartupConfig,
  configKeys,
  getConfigProblems,
  getStartupReport,
  isMockProvider,
  parseConfig,
} from "@/lib/config";

/** Configuration complete minimale : tout ce qui est requis pour demarrer. */
function baseEnv(): Record<string, string> {
  return {
    NODE_ENV: "development",
    AUTH_SECRET: "secret-auth-value",
    WEBAUTHN_RP_ID: "localhost",
    WEBAUTHN_ORIGIN: "http://localhost:3000",
    NEXT_PUBLIC_API_URL: "https://ai.example.com/v1",
    IA_API_KEY: "secret-api-key",
    SETUP_TOKEN: "setup-secret",
  };
}

function env(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const merged: Record<string, string> = { ...baseEnv() };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

describe("parseConfig", () => {
  it("normalise une variable vide en undefined", () => {
    const config = parseConfig(env({ IA_API_KEY: "   " }));
    expect(config.IA_API_KEY).toBeUndefined();
  });

  it("applique les defauts declares", () => {
    const config = parseConfig(env());
    expect(config.AI_PROVIDER).toBe("openai");
    expect(config.NEXT_PUBLIC_SITE_URL).toBe("https://backstage.mprnl.fr");
    expect(config.VAPID_SUBJECT).toBe("mailto:backstage@localhost");
    expect(config.CESAR_BASE).toBe("https://cesar.emineo-education.fr");
    expect(config.DEV_AUTH_BYPASS).toBe(false);
  });

  it("lit les drapeaux booleens sans dependre de la casse", () => {
    expect(parseConfig(env({ DEV_AUTH_BYPASS: "TRUE" })).DEV_AUTH_BYPASS).toBe(true);
    expect(parseConfig(env({ GOOGLE_TESTING_EXPIRY: "1" })).GOOGLE_TESTING_EXPIRY).toBe(true);
    expect(parseConfig(env({ DEV_AUTH_BYPASS: "non" })).DEV_AUTH_BYPASS).toBe(false);
  });

  it("lit un port numerique et ignore une valeur invalide", () => {
    expect(parseConfig(env({ PORT: "8423" })).PORT).toBe(8423);
    expect(parseConfig(env({ PORT: "abc" })).PORT).toBe(3000);
  });

  it("ne conserve jamais une chaine vide a la place d'une valeur absente", () => {
    const config = parseConfig(env({ NEXT_PUBLIC_API_URL: "" }));
    expect(config.NEXT_PUBLIC_API_URL).toBeUndefined();
  });

  it("detecte le provider mock", () => {
    expect(isMockProvider(parseConfig(env({ AI_PROVIDER: "mock" })))).toBe(true);
    expect(isMockProvider(parseConfig(env()))).toBe(false);
  });
});

describe("getStartupReport", () => {
  it("ne signale rien quand la configuration est complete", () => {
    expect(getStartupReport(env())).toEqual({ fatal: [], warnings: [] });
  });

  it("bloque le demarrage sans AUTH_SECRET", () => {
    const report = getStartupReport(env({ AUTH_SECRET: undefined }));

    expect(report.fatal).toHaveLength(1);
    expect(report.fatal[0]).toContain("AUTH_SECRET");
    expect(report.fatal[0]).toContain("bun run setup");
  });

  it("laisse demarrer sans configuration IA : /login reste atteignable", () => {
    const report = getStartupReport(
      env({ NEXT_PUBLIC_API_URL: undefined, IA_API_KEY: undefined })
    );

    expect(report.fatal).toEqual([]);
    expect(report.warnings).toHaveLength(2);
    expect(report.warnings[0]).toContain("NEXT_PUBLIC_API_URL");
    expect(report.warnings[1]).toContain("IA_API_KEY");
  });

  it("ignore la configuration IA en mode mock", () => {
    const report = getStartupReport(
      env({
        AI_PROVIDER: "mock",
        NEXT_PUBLIC_API_URL: undefined,
        IA_API_KEY: undefined,
      })
    );
    expect(report).toEqual({ fatal: [], warnings: [] });
  });

  it("tolere WEBAUTHN absent en developpement (origine derivee de la requete)", () => {
    const report = getStartupReport(env({ WEBAUTHN_ORIGIN: undefined, WEBAUTHN_RP_ID: undefined }));
    expect(report.fatal).toEqual([]);
  });

  it("exige WEBAUTHN_ORIGIN en production", () => {
    const report = getStartupReport(env({ NODE_ENV: "production", WEBAUTHN_ORIGIN: undefined }));
    expect(report.fatal).toHaveLength(1);
    expect(report.fatal[0]).toContain("WEBAUTHN_ORIGIN");
  });

  it("refuse un bypass dev en production", () => {
    const report = getStartupReport(
      env({
        NODE_ENV: "production",
        DEV_AUTH_BYPASS: "true",
        WEBAUTHN_ORIGIN: undefined,
      })
    );
    expect(report.fatal).toHaveLength(1);
  });

  it("signale une origine qui ne contient pas WEBAUTHN_RP_ID en production", () => {
    const report = getStartupReport(
      env({ NODE_ENV: "production", WEBAUTHN_ORIGIN: "https://autre.example.com" })
    );
    expect(report.fatal).toHaveLength(1);
    expect(report.fatal[0]).toContain("WEBAUTHN_RP_ID");
  });

  it("avertit pour SETUP_TOKEN absent en production seulement", () => {
    expect(getStartupReport(env({ SETUP_TOKEN: undefined })).warnings).toEqual([]);

    const production = getStartupReport(env({ NODE_ENV: "production", SETUP_TOKEN: undefined }));
    expect(production.warnings).toHaveLength(1);
    expect(production.warnings[0]).toContain("SETUP_TOKEN");
    expect(production.warnings[0]).toContain("503");
  });

  it("n'expose jamais la valeur des secrets dans les messages", () => {
    const joined = getConfigProblems(
      env({
        NODE_ENV: "production",
        SETUP_TOKEN: undefined,
        IA_API_KEY: undefined,
        AUTH_SECRET: undefined,
      })
    ).join("\n");

    expect(joined).not.toContain("secret-auth-value");
    expect(joined).not.toContain("secret-api-key");
    expect(joined).not.toContain("setup-secret");
  });
});

describe("assertStartupConfig", () => {
  it("leve une erreur lisible quand l'authentification est impossible", () => {
    expect(() => assertStartupConfig(env({ AUTH_SECRET: undefined }))).toThrowError(
      /Demarrage impossible[\s\S]*AUTH_SECRET/
    );
  });

  it("renvoie les avertissements quand seul le provider IA manque", () => {
    const warnings = assertStartupConfig(
      env({ NEXT_PUBLIC_API_URL: undefined, IA_API_KEY: undefined })
    );
    expect(warnings).toHaveLength(2);
  });
});

describe("coherence avec .env.example", () => {
  const example = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
  // Cles actives ou commentees (`# AI_PROVIDER=mock`) : les deux documentent.
  const documented = new Set(
    [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1])
  );
  const schema = new Set(configKeys());

  it("toute variable documentee existe dans le schema", () => {
    const unknown = [...documented].filter((key) => !schema.has(key));
    expect(unknown).toEqual([]);
  });

  it("toute variable sans defaut est documentee", () => {
    // Defauts declares : NODE_ENV, AI_PROVIDER, NEXT_PUBLIC_SITE_URL,
    // VAPID_SUBJECT, CESAR_BASE, DEV_AUTH_BYPASS, GOOGLE_TESTING_EXPIRY.
    const withDefault = new Set([
      "NODE_ENV",
      "AI_PROVIDER",
      "NEXT_PUBLIC_SITE_URL",
      "VAPID_SUBJECT",
      "CESAR_BASE",
      "DEV_AUTH_BYPASS",
      "GOOGLE_TESTING_EXPIRY",
      "PORT",
    ]);
    const undocumented = [...schema].filter(
      (key) => !withDefault.has(key) && !documented.has(key)
    );
    expect(undocumented).toEqual([]);
  });
});
