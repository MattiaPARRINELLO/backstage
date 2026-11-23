import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const failure = vi.hoisted(() => ({ suffix: null as string | null, trips: 0 }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: ((path: unknown, data: unknown, options?: unknown) => {
      const target = String(path);
      if (failure.suffix && target.endsWith(failure.suffix) && failure.trips > 0) {
        failure.trips -= 1;
        throw new Error(`EACCES simule sur ${target}`);
      }
      return (actual.writeFileSync as (...args: unknown[]) => void)(path, data, options);
    }) as typeof actual.writeFileSync,
  };
});

import { doctorModules, installModule } from "@/lib/kernel/module-install";

const script = join(process.cwd(), "scripts/module-install.ts");
const roots: string[] = [];

const COMPOSITION = [
  'import type { ModuleDefinition } from "@backstage/module-kit";',
  "",
  "export const modules: readonly ModuleDefinition[] = [];",
  "",
].join("\n");

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function configureGit(repo: string): void {
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
}

function manifest(options: {
  id?: string;
  apiVersion?: number;
  version?: string;
  label?: string;
}): string {
  return `export default {
  id: ${JSON.stringify(options.id ?? "demo")},
  apiVersion: ${options.apiVersion ?? 1},
  version: ${JSON.stringify(options.version ?? "1.0.0")},
  label: ${JSON.stringify(options.label ?? "Demo")},
  selectionDescription: "Module de test.",
  description: "Module de test pour la CLI.",
  capabilities: {},
};
`;
}

function initRepo(): string {
  const repo = tempDir("backstage-module-src-");
  git(repo, "init", "-q");
  configureGit(repo);
  return repo;
}

function commitModule(repo: string, content: string, ref: string): void {
  writeFileSync(join(repo, "module.ts"), content, "utf8");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", ref);
  git(repo, "tag", ref);
}

function createRoot(): string {
  const root = tempDir("backstage-cli-root-");
  mkdirSync(join(root, "modules"), { recursive: true });
  writeFileSync(join(root, "modules/index.ts"), COMPOSITION, "utf8");
  writeFileSync(join(root, "modules.config.json"), '{\n  "kernelApi": 1,\n  "modules": {}\n}\n', "utf8");
  writeFileSync(join(root, "modules.lock.json"), '{\n  "modules": {}\n}\n', "utf8");
  git(root, "init", "-q");
  configureGit(root);
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  return root;
}

interface RunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function run(root: string, ...args: string[]): RunResult {
  const result = spawnSync("bun", [script, ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function statusLines(root: string): string[] {
  return git(root, "status", "--porcelain")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .sort();
}

function expectNoTempDir(root: string): void {
  for (const line of statusLines(root)) {
    expect(line).not.toContain(".install-");
  }
  for (const entry of readdirSync(join(root, "modules"))) {
    expect(entry.startsWith(".install-")).toBe(false);
  }
}

function readJson(root: string, file: string): {
  modules: Record<string, unknown>;
} {
  return JSON.parse(readFileSync(join(root, file), "utf8")) as {
    modules: Record<string, unknown>;
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("module:list et module:doctor", () => {
  it("listent un module installe puis ne signalent aucun probleme", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();

    expect(run(root, "list").stdout).toContain("Aucun module externe installe.");
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);

    const list = run(root, "list");
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("demo");
    expect(list.stdout).toContain(`${repo}#v1.0.0`);

    const doctor = run(root, "doctor");
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain("aucun probleme detecte");
    expectNoTempDir(root);
  });
});

describe("module:update", () => {
  it("change de version, met a jour commit et installedAt, garde l'activation", () => {
    const repo = initRepo();
    commitModule(repo, manifest({ version: "1.0.0" }), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const before = readJson(root, "modules.lock.json").modules.demo as {
      installedAt: string;
      repo: string;
    };
    const statusBefore = statusLines(root);

    commitModule(repo, manifest({ version: "1.1.0", label: "Demo 2" }), "v1.1.0");
    const result = run(root, "update", "demo", "#v1.1.0");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Module "demo" mis a jour.');

    const entry = readJson(root, "modules.lock.json").modules.demo as {
      ref: string;
      commit: string;
      repo: string;
      installedAt: string;
    };
    expect(entry.ref).toBe("v1.1.0");
    expect(entry.commit).toBe(git(repo, "rev-parse", "v1.1.0^{commit}").trim());
    expect(entry.repo).toBe(repo);
    expect(entry.installedAt >= before.installedAt).toBe(true);
    expect(readFileSync(join(root, "modules/demo/module.ts"), "utf8")).toContain("Demo 2");
    expect(readJson(root, "modules.config.json").modules.demo).toEqual({ enabled: true });
    expect(statusLines(root)).toEqual(statusBefore);
    expectNoTempDir(root);
  });

  it("reinstalle la ref du lock quand aucune ref n'est donnee", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const commit = git(repo, "rev-parse", "v1.0.0^{commit}").trim();

    const result = run(root, "update", "demo");
    expect(result.status).toBe(0);
    const entry = readJson(root, "modules.lock.json").modules.demo as {
      ref: string;
      commit: string;
    };
    expect(entry.ref).toBe("v1.0.0");
    expect(entry.commit).toBe(commit);
  });

  it("refuse un module inconnu", () => {
    const root = createRoot();
    const result = run(root, "update", "fantome");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("inconnu");
    expect(statusLines(root)).toEqual([]);
  });

  it("refuse une version dont l'identifiant change", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const lockBefore = readFileSync(join(root, "modules.lock.json"), "utf8");

    commitModule(repo, manifest({ id: "autre" }), "v2.0.0");
    const result = run(root, "update", "demo", "#v2.0.0");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('declare "autre" au lieu de "demo"');
    expect(readFileSync(join(root, "modules.lock.json"), "utf8")).toBe(lockBefore);
    expect(existsSync(join(root, "modules/autre"))).toBe(false);
    expectNoTempDir(root);
  });

  it("refuse une apiVersion superieure au noyau", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);

    commitModule(repo, manifest({ apiVersion: 2 }), "v2.0.0");
    const result = run(root, "update", "demo", "#v2.0.0");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exige l'API de module 2");
    expectNoTempDir(root);
  });
});

describe("module:remove", () => {
  it("retire dossier, config, composition et lock, a l'octet pres", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    const baseline = ["modules/index.ts", "modules.config.json", "modules.lock.json"].map(
      (file) => readFileSync(join(root, file), "utf8")
    );

    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const result = run(root, "remove", "demo");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Module "demo" retire');

    expect(existsSync(join(root, "modules/demo"))).toBe(false);
    expect(readJson(root, "modules.lock.json").modules.demo).toBeUndefined();
    expect(readJson(root, "modules.config.json").modules.demo).toBeUndefined();
    expect(
      ["modules/index.ts", "modules.config.json", "modules.lock.json"].map((file) =>
        readFileSync(join(root, file), "utf8")
      )
    ).toEqual(baseline);
    expect(statusLines(root)).toEqual([]);
    expectNoTempDir(root);
  });

  it("refuse un module inconnu", () => {
    const root = createRoot();
    const result = run(root, "remove", "fantome");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("inconnu");
  });

  it("reste sur quand le dossier a deja disparu", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    rmSync(join(root, "modules/demo"), { recursive: true, force: true });

    const result = run(root, "remove", "demo");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dossier deja absent");
    expect(readJson(root, "modules.lock.json").modules).toEqual({});
    expect(readJson(root, "modules.config.json").modules).toEqual({});
    expectNoTempDir(root);
  });
});

describe("module:enable et module:disable", () => {
  it("ne touchent que modules.config.json et pilotent doctor", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const lock = readFileSync(join(root, "modules.lock.json"), "utf8");
    const composition = readFileSync(join(root, "modules/index.ts"), "utf8");

    const disabled = run(root, "disable", "demo");
    expect(disabled.status).toBe(0);
    expect(readJson(root, "modules.config.json").modules.demo).toEqual({ enabled: false });
    expect(readFileSync(join(root, "modules.lock.json"), "utf8")).toBe(lock);
    expect(readFileSync(join(root, "modules/index.ts"), "utf8")).toBe(composition);

    const doctor = run(root, "doctor");
    expect(doctor.status).toBe(1);
    expect(doctor.stderr).toContain("installe mais desactive");

    const again = run(root, "disable", "demo");
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("deja desactive");

    const enabled = run(root, "enable", "demo");
    expect(enabled.status).toBe(0);
    expect(readJson(root, "modules.config.json").modules.demo).toEqual({ enabled: true });
    expect(run(root, "doctor").status).toBe(0);
    expectNoTempDir(root);
  });

  it("refuse d'activer un module inconnu", () => {
    const root = createRoot();
    const result = run(root, "enable", "fantome");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("inconnu");
  });
});

describe("cas d'erreur de module:add", () => {
  it("refuse un depot absent sans rien ecrire", () => {
    const root = createRoot();
    const lock = readFileSync(join(root, "modules.lock.json"), "utf8");
    const result = run(root, "add", `${join(root, "depot-absent")}#v1.0.0`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Impossible de cloner");
    expect(readFileSync(join(root, "modules.lock.json"), "utf8")).toBe(lock);
    expect(statusLines(root)).toEqual([]);
    expectNoTempDir(root);
  });

  it("refuse une ref inconnue", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    const result = run(root, "add", `${repo}#v9.9.9`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Impossible de cloner");
    expect(readJson(root, "modules.lock.json").modules).toEqual({});
    expectNoTempDir(root);
  });

  it("refuse un tag present en local mais pas pousse", () => {
    const origin = tempDir("backstage-origin-");
    git(origin, "init", "--bare", "-q");
    const work = initRepo();
    commitModule(work, manifest({ version: "1.0.0" }), "v1.0.0");
    git(work, "remote", "add", "origin", origin);
    git(work, "push", "-q", "origin", "HEAD:refs/heads/main");
    git(work, "push", "-q", "--tags");
    commitModule(work, manifest({ version: "1.1.0" }), "v1.1.0");

    const root = createRoot();
    const result = run(root, "add", `${origin}#v1.1.0`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Impossible de cloner");
    expect(readJson(root, "modules.lock.json").modules).toEqual({});
    expectNoTempDir(root);

    // Le tag pousse, lui, reste installable : l'echec vient bien du tag manquant.
    expect(run(root, "add", `${origin}#v1.0.0`).status).toBe(0);
  });

  it("refuse un module deja installe", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    const lock = readFileSync(join(root, "modules.lock.json"), "utf8");

    const second = run(root, "add", `${repo}#v1.0.0`);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("deja present");
    expect(readFileSync(join(root, "modules.lock.json"), "utf8")).toBe(lock);
    expectNoTempDir(root);
  });

  it("refuse un conflit d'identifiant entre deux depots", () => {
    const first = initRepo();
    commitModule(first, manifest({}), "v1.0.0");
    const second = initRepo();
    commitModule(second, manifest({}), "v1.0.0");
    const root = createRoot();

    expect(run(root, "add", `${first}#v1.0.0`).status).toBe(0);
    const lock = readFileSync(join(root, "modules.lock.json"), "utf8");
    const result = run(root, "add", `${second}#v1.0.0`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('deja present dans modules/demo');
    expect(readFileSync(join(root, "modules.lock.json"), "utf8")).toBe(lock);
    expectNoTempDir(root);
  });

  it.each([
    ["sans id", manifest({}).replace('  id: "demo",\n', "")],
    ["sans apiVersion", manifest({}).replace("  apiVersion: 1,\n", "")],
    ["avec label vide", manifest({ label: "" })],
  ])("refuse un manifeste %s avant toute ecriture", (_label, content) => {
    const repo = initRepo();
    commitModule(repo, content, "v1.0.0");
    const root = createRoot();
    const config = readFileSync(join(root, "modules.config.json"), "utf8");
    const composition = readFileSync(join(root, "modules/index.ts"), "utf8");

    const result = run(root, "add", `${repo}#v1.0.0`);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /Manifeste invalide|Identifiant de module invalide|apiVersion|label est obligatoire/
    );
    expect(readJson(root, "modules.lock.json").modules).toEqual({});
    expect(readFileSync(join(root, "modules.config.json"), "utf8")).toBe(config);
    expect(readFileSync(join(root, "modules/index.ts"), "utf8")).toBe(composition);
    expectNoTempDir(root);
  });

  it("refuse une apiVersion superieure au noyau", () => {
    const repo = initRepo();
    commitModule(repo, manifest({ apiVersion: 2 }), "v1.0.0");
    const root = createRoot();
    const result = run(root, "add", `${repo}#v1.0.0`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exige l'API de module 2");
    expect(readJson(root, "modules.lock.json").modules).toEqual({});
    expectNoTempDir(root);
  });
});

describe("module:doctor en erreur", () => {
  it("signale un module absent du disque", () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    expect(run(root, "add", `${repo}#v1.0.0`).status).toBe(0);
    rmSync(join(root, "modules/demo"), { recursive: true, force: true });

    const doctor = run(root, "doctor");
    expect(doctor.status).toBe(1);
    expect(doctor.stderr).toContain("module absent de modules/demo");
  });

  it("signale un dossier .install-* orphelin", () => {
    const root = createRoot();
    mkdirSync(join(root, "modules/.install-install-999-1-abcd"), { recursive: true });

    const doctor = run(root, "doctor");
    expect(doctor.status).toBe(1);
    expect(doctor.stderr).toContain(".install-install-999-1-abcd");
    expect(doctor.stderr).toContain("temporaire");
  });
});

describe("rollback d'une installation", () => {
  it("restaure les trois fichiers et retire le dossier si la composition echoue", async () => {
    const repo = initRepo();
    commitModule(repo, manifest({}), "v1.0.0");
    const root = createRoot();
    const files = ["modules/index.ts", "modules.config.json", "modules.lock.json"].map(
      (file) => join(root, file)
    );
    const before = files.map((file) => readFileSync(file, "utf8"));

    failure.suffix = "modules/index.ts";
    failure.trips = 1;
    try {
      await expect(installModule({ root, source: `${repo}#v1.0.0` })).rejects.toThrow(
        /EACCES simule/
      );
    } finally {
      failure.suffix = null;
      failure.trips = 0;
    }

    expect(files.map((file) => readFileSync(file, "utf8"))).toEqual(before);
    expect(existsSync(join(root, "modules/demo"))).toBe(false);
    expect(readdirSync(join(root, "modules"))).toEqual(["index.ts"]);
    expect(statusLines(root)).toEqual([]);
    expect(await doctorModules(root)).toEqual([]);
  });
});
