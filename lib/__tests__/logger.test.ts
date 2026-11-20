import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redactSecrets, serverLog, timed, type LogEntry } from "@/lib/logger";

function lastLine(spy: ReturnType<typeof vi.spyOn>): LogEntry {
  const raw = spy.mock.calls.at(-1)?.[0];
  expect(typeof raw).toBe("string");
  return JSON.parse(String(raw)) as LogEntry;
}

describe("logger structure", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("ecrit une ligne JSON valide avec reqId et module", async () => {
    await serverLog("chat", "info", "turn started");

    const entry = lastLine(vi.mocked(console.info));
    expect(entry.level).toBe("info");
    expect(entry.module).toBe("chat");
    expect(entry.msg).toBe("turn started");
    expect(entry.reqId).toBe("bg");
    expect(Number.isNaN(Date.parse(entry.time))).toBe(false);
  });

  it("dirige warn et error vers leur flux, avec duree et marqueur externe", async () => {
    await serverLog("http", "warn", "retry", undefined, true, 12);
    const warn = lastLine(vi.mocked(console.warn));
    expect(warn.level).toBe("warn");
    expect(warn.durationMs).toBe(12);
    expect(warn.external).toBe(true);

    await serverLog("http", "error", "down", new Error("boom"), true, 30);
    const error = lastLine(vi.mocked(console.error));
    expect(error.level).toBe("error");
    expect(error.err).toEqual({ name: "Error", message: "boom" });
  });

  it("n'ecrit ni stack ni champs inconnus pour une erreur", async () => {
    const error = new Error("echec");
    error.stack = "SECRET_STACK";
    await serverLog("test", "error", "echec", error);

    const entry = lastLine(vi.mocked(console.error));
    expect(entry.err).toEqual({ name: "Error", message: "echec" });
    expect(JSON.stringify(entry)).not.toContain("SECRET_STACK");
    expect(entry).not.toHaveProperty("stack");
  });

  it("masque les secrets de configuration dans le message et l'erreur", async () => {
    process.env.IA_API_KEY = "cle-tres-secrete-123456";

    await serverLog("test", "info", "appel avec cle-tres-secrete-123456");
    expect(JSON.stringify(lastLine(vi.mocked(console.info)))).not.toContain(
      "cle-tres-secrete-123456"
    );
    expect(lastLine(vi.mocked(console.info)).msg).toContain("[redacte]");

    await serverLog("test", "error", "echec", new Error("token cle-tres-secrete-123456"));
    const entry = lastLine(vi.mocked(console.error));
    expect(JSON.stringify(entry)).not.toContain("cle-tres-secrete-123456");
    expect(entry.err?.message).toContain("[redacte]");
  });

  it("laisse intact un secret trop court pour etre une vraie cle", () => {
    process.env.IA_API_KEY = "court";
    expect(redactSecrets("la valeur court reste")).toBe("la valeur court reste");
  });
});

describe("timed", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne le resultat et journalise une duree info", async () => {
    const value = await timed("charger les rappels", async () => 42, { module: "storage" });

    expect(value).toBe(42);
    const entry = lastLine(vi.mocked(console.info));
    expect(entry.module).toBe("storage");
    expect(entry.msg).toBe("charger les rappels");
    expect(entry.level).toBe("info");
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("journalise l'echec en error puis propage la meme erreur", async () => {
    const failure = new Error("indisponible");

    await expect(
      timed("appel externe", async () => {
        throw failure;
      }, { module: "http", external: true })
    ).rejects.toBe(failure);

    const entry = lastLine(vi.mocked(console.error));
    expect(entry.level).toBe("error");
    expect(entry.external).toBe(true);
    expect(entry.err?.message).toBe("indisponible");
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });
});
