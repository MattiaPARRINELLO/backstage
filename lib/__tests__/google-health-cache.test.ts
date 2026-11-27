import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

// Le test ecrivait dans le `data/` reel puis restaurait les fichiers : il suffit
// de faire pointer `process.cwd()` vers un dossier temporaire AVANT d'importer
// les modules qui figent leurs chemins au chargement (#302).
const TEST_DIR = path.join(os.tmpdir(), `backstage-google-health-${process.pid}-${Date.now()}`);
const DATA_DIR = path.join(TEST_DIR, "data");
const originalCwd = process.cwd;

let cache: typeof import("../server-cache");
let google: typeof import("../google-client");

describe("google health cache invalidation", () => {
  beforeAll(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    process.cwd = () => TEST_DIR;
    cache = await import("../server-cache");
    google = await import("../google-client");
  });

  afterAll(async () => {
    process.cwd = originalCwd;
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should invalidate the health endpoint cache when a break is recorded", async () => {
    cache.setServerCached("google:health", { gmail: { broken: false } }, 60_000);
    expect(cache.getServerCached("google:health")).toBeDefined();

    await google.markGoogleBroken("gmail");
    expect(cache.getServerCached("google:health")).toBeUndefined();
    expect(await google.getBrokenSince("gmail")).not.toBeNull();

    // La trace disque atterrit bien dans le dossier temporaire, pas dans data/.
    const healthFile = path.join(DATA_DIR, ".google-health.json");
    expect(JSON.parse(await fs.readFile(healthFile, "utf-8"))).toHaveProperty("gmail");

    await google.clearGoogleBroken("gmail");
    expect(await google.getBrokenSince("gmail")).toBeNull();
  });
});
